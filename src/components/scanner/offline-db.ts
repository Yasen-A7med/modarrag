import type { OfflineManifestEntry } from "@/application/attendance/actions";

const DB_NAME = "modarrag_offline_db" as const;
const DB_VERSION = 1 as const;
const STORE_MANIFESTS = "manifests" as const;
const STORE_SCAN_QUEUE = "scanQueue" as const;

export interface CachedSessionManifest {
  readonly sessionId: string;
  readonly schoolSlug: string;
  readonly downloadedAt: string;
  readonly entries: readonly OfflineManifestEntry[];
}

export interface QueuedOfflineScan {
  readonly id: string;
  readonly schoolSlug: string;
  readonly sessionId: string;
  readonly bookingId: string;
  readonly rawToken: string;
  readonly scannedAt: string;
  readonly studentLabel: string;
  readonly seatNumber: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_REGEX = /^[A-Za-z0-9_-]{16,128}$/;
const HMAC_REGEX = /^[A-Za-z0-9_-]{32,128}$/;

export interface ParsedClientQrStructure {
  readonly bookingId: string;
  readonly sessionId: string;
  readonly trimmedToken: string;
}

/**
 * Pure structural validator for `v1.{bookingId}.{sessionId}.{nonce}.{hmac}` tokens.
 * Allows instant offline syntax & session-mismatch detection before SHA-256 verification.
 */
export function parseClientQrStructure(
  rawToken: string
): ParsedClientQrStructure | null {
  const trimmed = rawToken.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(".");
  if (parts.length !== 5) {
    return null;
  }

  const [version, bookingId, sessionId, nonce, hmac] = parts;
  if (version !== "v1") {
    return null;
  }
  if (!bookingId || !UUID_REGEX.test(bookingId)) {
    return null;
  }
  if (!sessionId || !UUID_REGEX.test(sessionId)) {
    return null;
  }
  if (!nonce || !NONCE_REGEX.test(nonce)) {
    return null;
  }
  if (!hmac || !HMAC_REGEX.test(hmac)) {
    return null;
  }

  return {
    bookingId,
    sessionId,
    trimmedToken: trimmed,
  };
}

/** Computes lowercase SHA-256 hex digest in the browser using Web Crypto API. */
export async function sha256HexClient(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MANIFESTS)) {
        db.createObjectStore(STORE_MANIFESTS, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORE_SCAN_QUEUE)) {
        db.createObjectStore(STORE_SCAN_QUEUE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open modarrag_offline_db"));
  });
}

export async function saveOfflineManifest(
  manifest: CachedSessionManifest
): Promise<void> {
  const db = await openOfflineDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MANIFESTS, "readwrite");
      const store = tx.objectStore(STORE_MANIFESTS);
      store.put(manifest);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save manifest"));
    });
  } finally {
    db.close();
  }
}

export async function getOfflineManifest(
  sessionId: string
): Promise<CachedSessionManifest | null> {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return null;
  }
  const db = await openOfflineDatabase();
  try {
    return await new Promise<CachedSessionManifest | null>((resolve, reject) => {
      const tx = db.transaction(STORE_MANIFESTS, "readonly");
      const store = tx.objectStore(STORE_MANIFESTS);
      const req = store.get(sessionId);
      req.onsuccess = () =>
        resolve((req.result as CachedSessionManifest | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Failed to read manifest"));
    });
  } finally {
    db.close();
  }
}

export async function listQueuedOfflineScans(
  schoolSlug: string
): Promise<readonly QueuedOfflineScan[]> {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return [];
  }
  const db = await openOfflineDatabase();
  try {
    return await new Promise<readonly QueuedOfflineScan[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SCAN_QUEUE, "readonly");
      const store = tx.objectStore(STORE_SCAN_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as QueuedOfflineScan[] | undefined) ?? [];
        resolve(all.filter((item) => item.schoolSlug === schoolSlug));
      };
      req.onerror = () => reject(req.error ?? new Error("Failed to read offline queue"));
    });
  } finally {
    db.close();
  }
}

export async function enqueueOfflineScan(scan: QueuedOfflineScan): Promise<void> {
  const db = await openOfflineDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SCAN_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_SCAN_QUEUE);
      store.put(scan);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to enqueue scan"));
    });
  } finally {
    db.close();
  }
}

export async function removeQueuedScansByIds(
  ids: readonly string[]
): Promise<void> {
  if (ids.length === 0) return;
  const db = await openOfflineDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SCAN_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_SCAN_QUEUE);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete queued scans"));
    });
  } finally {
    db.close();
  }
}
