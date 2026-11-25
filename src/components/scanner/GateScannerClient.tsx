"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  CloudDownload,
  Flashlight,
  KeyRound,
  Play,
  QrCode,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  XCircle,
} from "lucide-react";
import {
  getOfflineManifestAction,
  syncOfflineCheckinsAction,
  verifyAndCheckinQrAction,
  type ScannerSessionData,
} from "@/application/attendance/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { MOTION_SPRINGS } from "@/lib/design-tokens";
import {
  formatArabicNumber,
  formatCairoTime,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { OfflineQueueBadge } from "./OfflineQueueBadge";
import {
  enqueueOfflineScan,
  getOfflineManifest,
  listQueuedOfflineScans,
  parseClientQrStructure,
  removeQueuedScansByIds,
  saveOfflineManifest,
  sha256HexClient,
  type CachedSessionManifest,
  type QueuedOfflineScan,
} from "./offline-db";
import { playScannerBeep } from "./scanner-audio";

export interface GateScannerClientProps {
  readonly schoolSlug: string;
  readonly schoolNameAr: string;
  readonly initialData: ScannerSessionData;
}

type ScanOutcomeKind =
  | "checked_in"
  | "already_checked_in"
  | "wrong_session"
  | "invalid_token"
  | "cancelled";

interface ScanOutcomeBanner {
  readonly id: string;
  readonly result: ScanOutcomeKind;
  readonly messageAr: string;
  readonly studentLabel?: string;
  readonly seatNumber?: string | null;
  readonly modeLabel: string;
  readonly latencyMs: number;
  readonly isSimulatedDemo?: boolean;
}

type CameraStatus = "idle" | "starting" | "scanning" | "denied" | "unavailable";

const SCANNER_CONTAINER_ID = "modarrag-gate-qr-reader";

function subscribeOnlineStatus(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

function getOutcomePresentation(result: ScanOutcomeKind) {
  switch (result) {
    case "checked_in":
      return {
        tone: "success" as const,
        sound: "success" as const,
        wrapperClass:
          "border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-100",
        icon: CheckCircle2,
        iconClass: "text-emerald-600 dark:text-emerald-400",
        titleAr: "دخول مسموح",
      };
    case "already_checked_in":
    case "wrong_session":
      return {
        tone: "warning" as const,
        sound: "warning" as const,
        wrapperClass:
          "border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100",
        icon: AlertTriangle,
        iconClass: "text-amber-600 dark:text-amber-400",
        titleAr: result === "already_checked_in" ? "تذكرة مستخدمة مسبقاً" : "قاعة أو حصة خاطئة",
      };
    case "invalid_token":
    case "cancelled":
    default:
      return {
        tone: "danger" as const,
        sound: "error" as const,
        wrapperClass:
          "border-red-500 bg-red-50 text-red-950 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-100",
        icon: XCircle,
        iconClass: "text-red-600 dark:text-red-400",
        titleAr: result === "cancelled" ? "تذكرة ملغاة" : "تذكرة غير صالحة",
      };
  }
}

/**
 * Gate QR Scanner Kiosk Console:
 * - Dynamic `html5-qrcode` camera capture with torch support and graceful camera fallback
 * - IndexedDB (`modarrag_offline_db`) Kiosk Sync Pack & client SHA-256 offline verification
 * - Auto-sync on reconnection + Web Audio chimes + Ministry simulator demo bar
 */
export function GateScannerClient({
  schoolSlug,
  schoolNameAr,
  initialData,
}: GateScannerClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const browserOnline = React.useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );

  const [offlineTestMode, setOfflineTestMode] = React.useState(false);
  const effectiveOnline = browserOnline && !offlineTestMode;

  const sessions = initialData.sessions;
  const [addedCheckins, setAddedCheckins] = React.useState<
    ScannerSessionData["recentCheckins"]
  >([]);
  const recentCheckins = React.useMemo(() => {
    const seen = new Set<string>();
    const combined: Array<ScannerSessionData["recentCheckins"][number]> = [];
    for (const item of [...addedCheckins, ...initialData.recentCheckins]) {
      if (!seen.has(item.bookingId)) {
        seen.add(item.bookingId);
        combined.push(item);
      }
    }
    return combined;
  }, [addedCheckins, initialData.recentCheckins]);

  const [selectedSessionIdRaw, setSelectedSessionIdRaw] = React.useState<string>(
    initialData.sessions[0]?.id ?? ""
  );
  const selectedSessionId = sessions.some((s) => s.id === selectedSessionIdRaw)
    ? selectedSessionIdRaw
    : (sessions[0]?.id ?? "");
  const [manualToken, setManualToken] = React.useState("");
  const [processingScan, setProcessingScan] = React.useState(false);
  const [downloadingManifest, setDownloadingManifest] = React.useState(false);
  const [syncingQueue, setSyncingQueue] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [showAllSessionsCheckins, setShowAllSessionsCheckins] = React.useState(false);

  const [cachedManifest, setCachedManifest] =
    React.useState<CachedSessionManifest | null>(null);
  const [queuedScans, setQueuedScans] = React.useState<readonly QueuedOfflineScan[]>(
    []
  );
  const [outcome, setOutcome] = React.useState<ScanOutcomeBanner | null>(null);

  // Camera state & refs
  const [cameraStatus, setCameraStatus] = React.useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [torchSupported, setTorchSupported] = React.useState(false);
  const [torchOn, setTorchOn] = React.useState(false);

  const scannerInstanceRef = React.useRef<
    import("html5-qrcode").Html5Qrcode | null
  >(null);
  const lastCameraScanRef = React.useRef<{ token: string; at: number } | null>(
    null
  );
  const lastValidTokenRef = React.useRef<string | null>(null);
  const manualInputRef = React.useRef<HTMLInputElement | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load IndexedDB queue and selected session manifest
  React.useEffect(() => {
    let active = true;
    async function loadOfflineState() {
      try {
        const [queue, manifest] = await Promise.all([
          listQueuedOfflineScans(schoolSlug),
          selectedSessionId
            ? getOfflineManifest(selectedSessionId)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setQueuedScans(queue);
        setCachedManifest(manifest);
      } catch {
        // IndexedDB unavailable in restricted environments
      }
    }
    void loadOfflineState();
    return () => {
      active = false;
    };
  }, [schoolSlug, selectedSessionId]);

  const activeSession = React.useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const emitOutcome = React.useCallback(
    (banner: ScanOutcomeBanner) => {
      setOutcome(banner);
      if (!muted) {
        const meta = getOutcomePresentation(banner.result);
        playScannerBeep(meta.sound);
      }
    },
    [muted]
  );

  const handleSyncQueue = React.useCallback(async () => {
    if (!effectiveOnline || syncingQueue) return;

    const currentQueue = await listQueuedOfflineScans(schoolSlug).catch(
      () => queuedScans
    );
    if (currentQueue.length === 0) {
      setQueuedScans([]);
      return;
    }

    setSyncingQueue(true);
    try {
      const grouped = new Map<string, QueuedOfflineScan[]>();
      for (const item of currentQueue) {
        const existing = grouped.get(item.sessionId);
        if (existing) {
          existing.push(item);
        } else {
          grouped.set(item.sessionId, [item]);
        }
      }

      const syncedIds: string[] = [];
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const [sessionId, items] of grouped.entries()) {
        const response = await syncOfflineCheckinsAction({
          schoolSlug,
          sessionId,
          scans: items.map((item) => ({
            bookingId: item.bookingId,
            rawToken: item.rawToken,
            scannedAt: item.scannedAt,
          })),
        });

        if (!response.ok) {
          totalFailed += items.length;
          continue;
        }

        totalSuccess += response.data.successCount;
        totalFailed += response.data.failedCount;

        for (const r of response.data.results) {
          if (r.success) {
            syncedIds.push(`${sessionId}:${r.bookingId}`);
          }
        }
      }

      if (syncedIds.length > 0) {
        await removeQueuedScansByIds(syncedIds);
        const remaining = await listQueuedOfflineScans(schoolSlug);
        setQueuedScans(remaining);
      }

      if (totalSuccess > 0) {
        toast({
          title: `تمت مزامنة ${formatArabicNumber(totalSuccess)} تذكرة بنجاح`,
          description:
            totalFailed > 0
              ? `تعذر مزامنة ${formatArabicNumber(totalFailed)} تذكرة.`
              : "تم تحديث سجلات الحضور في قاعدة البيانات.",
          variant: totalFailed > 0 ? "warning" : "success",
        });
        router.refresh();
      } else if (totalFailed > 0) {
        toast({
          title: "تعذر مزامنة بعض التذاكر",
          description: "تحقق من اتصال الإنترنت وحاول مجدداً.",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "خطأ أثناء المزامنة",
        description: "سيبقى الطابور محفوظاً محلياً للمحاولة مرة أخرى.",
        variant: "error",
      });
    } finally {
      setSyncingQueue(false);
    }
  }, [effectiveOnline, syncingQueue, schoolSlug, queuedScans, toast, router]);

  // Auto-sync queued scans whenever connection returns
  const prevEffectiveOnlineRef = React.useRef(effectiveOnline);
  React.useEffect(() => {
    const wasOffline = !prevEffectiveOnlineRef.current;
    prevEffectiveOnlineRef.current = effectiveOnline;
    if (effectiveOnline && (wasOffline || queuedScans.length > 0)) {
      if (wasOffline && queuedScans.length > 0) {
        void handleSyncQueue();
      }
    }
  }, [effectiveOnline, queuedScans.length, handleSyncQueue]);

  const handleDownloadManifest = async () => {
    if (!selectedSessionId) return;
    setDownloadingManifest(true);
    try {
      const result = await getOfflineManifestAction(schoolSlug, selectedSessionId);
      if (!result.ok) {
        toast({
          title: "تعذر تحميل كشف الأوفلاين",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      const manifest: CachedSessionManifest = {
        sessionId: selectedSessionId,
        schoolSlug,
        downloadedAt: new Date().toISOString(),
        entries: result.data,
      };
      await saveOfflineManifest(manifest);
      setCachedManifest(manifest);
      toast({
        title: "تم حفظ كشف الحصة أوفلاين",
        description: `${formatArabicNumber(manifest.entries.length)} تذكرة جاهزة للتحقق المحلي بدون إنترنت.`,
        variant: "success",
      });
    } catch {
      toast({
        title: "تعذر حفظ الكشف محلياً",
        description: "تأكد من السماح بتخزين IndexedDB في المتصفح.",
        variant: "error",
      });
    } finally {
      setDownloadingManifest(false);
    }
  };

  const verifyOfflineLocally = React.useCallback(
    async (
      rawToken: string,
      targetSessionId: string,
      startedAtMs: number
    ): Promise<ScanOutcomeBanner> => {
      const parsed = parseClientQrStructure(rawToken);
      if (!parsed) {
        return {
          id: `${Date.now()}`,
          result: "invalid_token",
          messageAr: "صيغة رمز QR غير صالحة أو تالفة.",
          modeLabel: "أوفلاين محلي",
          latencyMs: Math.round(performance.now() - startedAtMs),
        };
      }

      if (parsed.sessionId !== targetSessionId) {
        return {
          id: `${Date.now()}`,
          result: "wrong_session",
          messageAr: "هذه التذكرة تخص قاعة أو حصة أخرى.",
          modeLabel: "أوفلاين محلي",
          latencyMs: Math.round(performance.now() - startedAtMs),
        };
      }

      const manifest =
        cachedManifest && cachedManifest.sessionId === targetSessionId
          ? cachedManifest
          : await getOfflineManifest(targetSessionId);

      if (!manifest) {
        return {
          id: `${Date.now()}`,
          result: "invalid_token",
          messageAr:
            "لا يوجد كشف أوفلاين محفوظ لهذه الحصة. يرجى حفظ الكشف أثناء توفر الإنترنت.",
          modeLabel: "أوفلاين محلي",
          latencyMs: Math.round(performance.now() - startedAtMs),
        };
      }

      const tokenHash = await sha256HexClient(parsed.trimmedToken);
      const entry = manifest.entries.find(
        (item) =>
          item.bookingId === parsed.bookingId &&
          item.qrTokenHash?.toLowerCase() === tokenHash.toLowerCase()
      );

      if (!entry) {
        return {
          id: `${Date.now()}`,
          result: "invalid_token",
          messageAr: "التذكرة غير مدرجة في كشف الحصة أو تم إلغاؤها.",
          modeLabel: "أوفلاين محلي",
          latencyMs: Math.round(performance.now() - startedAtMs),
        };
      }

      if (entry.status !== "confirmed") {
        return {
          id: `${Date.now()}`,
          result: "cancelled",
          messageAr: "التذكرة في قائمة الانتظار أو غير مؤكدة للدخول.",
          studentLabel: entry.studentLabel,
          seatNumber: entry.seatNumber,
          modeLabel: "أوفلاين محلي",
          latencyMs: Math.round(performance.now() - startedAtMs),
        };
      }

      const queueId = `${targetSessionId}:${entry.bookingId}`;
      const alreadyQueued = queuedScans.some((q) => q.id === queueId);
      const alreadyCheckedInList = recentCheckins.some(
        (c) => c.bookingId === entry.bookingId && c.sessionId === targetSessionId
      );

      if (alreadyQueued || alreadyCheckedInList) {
        return {
          id: `${Date.now()}`,
          result: "already_checked_in",
          messageAr: "تم تسجيل حضور هذه التذكرة مسبقاً.",
          studentLabel: entry.studentLabel,
          seatNumber: entry.seatNumber,
          modeLabel: "أوفلاين محلي",
          latencyMs: Math.round(performance.now() - startedAtMs),
        };
      }

      const scannedAt = new Date().toISOString();
      const queueItem: QueuedOfflineScan = {
        id: queueId,
        schoolSlug,
        sessionId: targetSessionId,
        bookingId: entry.bookingId,
        rawToken: parsed.trimmedToken,
        scannedAt,
        studentLabel: entry.studentLabel,
        seatNumber: entry.seatNumber,
      };

      await enqueueOfflineScan(queueItem);
      setQueuedScans((prev) => [
        queueItem,
        ...prev.filter((item) => item.id !== queueId),
      ]);
      setAddedCheckins((prev) => [
        {
          bookingId: entry.bookingId,
          studentLabel: entry.studentLabel,
          seatNumber: entry.seatNumber,
          checkedInAt: scannedAt,
          sessionId: targetSessionId,
        },
        ...prev,
      ]);

      return {
        id: `${Date.now()}`,
        result: "checked_in",
        messageAr: "تم التحقق محلياً وإضافة الحضور لطابور المزامنة.",
        studentLabel: entry.studentLabel,
        seatNumber: entry.seatNumber,
        modeLabel: "أوفلاين (SHA-256)",
        latencyMs: Math.round(performance.now() - startedAtMs),
      };
    },
    [cachedManifest, queuedScans, recentCheckins, schoolSlug]
  );

  const processScanToken = React.useCallback(
    async (rawToken: string, overrideSessionId?: string) => {
      const targetSessionId = overrideSessionId ?? selectedSessionId;
      const trimmed = rawToken.trim();
      if (!targetSessionId || !trimmed || processingScan) {
        return;
      }

      const startedAtMs = performance.now();
      setProcessingScan(true);

      try {
        if (!effectiveOnline) {
          const offlineOutcome = await verifyOfflineLocally(
            trimmed,
            targetSessionId,
            startedAtMs
          );
          if (offlineOutcome.result === "checked_in") {
            lastValidTokenRef.current = trimmed;
          }
          emitOutcome(offlineOutcome);
          return;
        }

        const response = await verifyAndCheckinQrAction({
          schoolSlug,
          sessionId: targetSessionId,
          rawToken: trimmed,
        });

        const latencyMs = Math.round(performance.now() - startedAtMs);

        if (!response.ok) {
          emitOutcome({
            id: `${Date.now()}`,
            result: "invalid_token",
            messageAr: response.error.message,
            modeLabel: "تحقق مباشر",
            latencyMs,
          });
          return;
        }

        const data = response.data;
        if (data.result === "checked_in") {
          lastValidTokenRef.current = trimmed;
          const newCheckin = {
            bookingId: data.bookingId ?? `${Date.now()}`,
            studentLabel: data.studentLabel ?? "طالب مقيد",
            seatNumber: data.seatNumber ?? null,
            checkedInAt: data.checkedInAt ?? new Date().toISOString(),
            sessionId: targetSessionId,
          };
          setAddedCheckins((prev) => [
            newCheckin,
            ...prev.filter((item) => item.bookingId !== newCheckin.bookingId),
          ]);
        } else if (data.result === "already_checked_in") {
          lastValidTokenRef.current = trimmed;
        }

        emitOutcome({
          id: `${Date.now()}`,
          result: data.result,
          messageAr: data.messageAr,
          studentLabel: data.studentLabel,
          seatNumber: data.seatNumber,
          modeLabel: "تحقق مباشر",
          latencyMs,
        });
      } catch {
        // Fallback transparently to offline verifier if online call throws due to dropped network
        const offlineOutcome = await verifyOfflineLocally(
          trimmed,
          targetSessionId,
          startedAtMs
        );
        emitOutcome(offlineOutcome);
      } finally {
        setProcessingScan(false);
      }
    },
    [
      selectedSessionId,
      processingScan,
      effectiveOnline,
      verifyOfflineLocally,
      emitOutcome,
      schoolSlug,
    ]
  );

  const processScanRef = React.useRef(processScanToken);
  React.useEffect(() => {
    processScanRef.current = processScanToken;
  }, [processScanToken]);

  const stopCamera = React.useCallback(async () => {
    const instance = scannerInstanceRef.current;
    scannerInstanceRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);

    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch {
        // Ignore stop error if stream already terminated
      }
      try {
        instance.clear();
      } catch {
        // Ignore DOM clear error
      }
    }

    if (mountedRef.current) {
      setCameraStatus("idle");
    }
  }, []);

  React.useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    if (cameraStatus === "starting" || cameraStatus === "scanning") {
      return;
    }
    setCameraError(null);
    setCameraStatus("starting");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mountedRef.current) return;

      const cameras = await Html5Qrcode.getCameras();
      if (!mountedRef.current) return;

      if (!cameras || cameras.length === 0) {
        setCameraStatus("unavailable");
        setCameraError(
          "لم يتم العثور على كاميرا متصلة. يمكنك استخدام الإدخال اليدوي أو قارئ الباركود USB."
        );
        return;
      }

      const instance = new Html5Qrcode(SCANNER_CONTAINER_ID, {
        verbose: false,
      });
      scannerInstanceRef.current = instance;

      const preferredCamera =
        cameras.find(
          (cam) =>
            cam.label.toLowerCase().includes("back") ||
            cam.label.toLowerCase().includes("environment")
        ) ?? cameras[cameras.length - 1];

      const cameraTarget = preferredCamera
        ? preferredCamera.id
        : { facingMode: "environment" };

      await instance.start(
        cameraTarget,
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.333,
        },
        (decodedText) => {
          const now = Date.now();
          const last = lastCameraScanRef.current;
          if (last && last.token === decodedText && now - last.at < 2500) {
            return;
          }
          lastCameraScanRef.current = { token: decodedText, at: now };
          void processScanRef.current(decodedText);
        },
        () => {
          // Per-frame decode miss is expected while aiming QR code
        }
      );

      if (!mountedRef.current) {
        await stopCamera();
        return;
      }

      setCameraStatus("scanning");

      try {
        const capabilities = instance.getRunningTrackCameraCapabilities();
        const torchFeature = capabilities.torchFeature();
        setTorchSupported(torchFeature.isSupported());
      } catch {
        setTorchSupported(false);
      }
    } catch (err) {
      await stopCamera();
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("permission") || msg.includes("notallowed")) {
        setCameraStatus("denied");
        setCameraError(
          "تم رفض إذن الكاميرا من المتصفح. اسمح بالوصول للكاميرا أو استخدم الإدخال اليدوي أدناه."
        );
      } else {
        setCameraStatus("unavailable");
        setCameraError(
          "تعذر تشغيل الكاميرا على هذا الجهاز. يمكنك فحص التذاكر عبر الإدخال اليدوي أو شريط المحاكاة."
        );
      }
    }
  };

  const handleToggleTorch = async () => {
    const instance = scannerInstanceRef.current;
    if (!instance || !torchSupported) return;
    try {
      const capabilities = instance.getRunningTrackCameraCapabilities();
      const torchFeature = capabilities.torchFeature();
      const next = !torchOn;
      await torchFeature.apply(next);
      setTorchOn(next);
    } catch {
      toast({
        title: "تعذر التحكم في الكشاف",
        variant: "warning",
      });
    }
  };

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await processScanToken(manualToken);
  };

  const handleSimulatorAction = async (kind: ScanOutcomeKind) => {
    const candidateToken =
      manualToken.trim() || lastValidTokenRef.current || "";

    if (kind === "invalid_token") {
      await processScanToken(
        "v1.00000000-0000-4000-8000-000000000000.00000000-0000-4000-8000-000000000000.invalidnoncedemo1234.invalidsignaturedemo1234567890abcdef123456"
      );
      return;
    }

    if (kind === "checked_in") {
      if (candidateToken) {
        await processScanToken(candidateToken);
        return;
      }
      emitOutcome({
        id: `${Date.now()}`,
        result: "checked_in",
        messageAr: "تم تسجيل الحضور بنجاح (محاكاة العرض التجريبي)",
        studentLabel: "كود S-201",
        seatNumber: "S-001",
        modeLabel: "محاكاة عرض",
        latencyMs: 18,
        isSimulatedDemo: true,
      });
      return;
    }

    if (kind === "already_checked_in") {
      if (lastValidTokenRef.current || manualToken.trim()) {
        await processScanToken(lastValidTokenRef.current ?? manualToken.trim());
        return;
      }
      emitOutcome({
        id: `${Date.now()}`,
        result: "already_checked_in",
        messageAr: "تم استخدام هذه التذكرة مسبقاً (محاكاة العرض التجريبي)",
        studentLabel: "كود S-201",
        seatNumber: "S-001",
        modeLabel: "محاكاة عرض",
        latencyMs: 14,
        isSimulatedDemo: true,
      });
      return;
    }

    if (kind === "wrong_session") {
      const otherSession = sessions.find((s) => s.id !== selectedSessionId);
      if (candidateToken && otherSession) {
        await processScanToken(candidateToken, otherSession.id);
        return;
      }
      emitOutcome({
        id: `${Date.now()}`,
        result: "wrong_session",
        messageAr: "هذه التذكرة تخص قاعة أو حصة أخرى (محاكاة العرض التجريبي)",
        modeLabel: "محاكاة عرض",
        latencyMs: 12,
        isSimulatedDemo: true,
      });
    }
  };

  const sessionCheckins = React.useMemo(
    () =>
      showAllSessionsCheckins
        ? recentCheckins
        : recentCheckins.filter((c) => c.sessionId === selectedSessionId),
    [recentCheckins, selectedSessionId, showAllSessionsCheckins]
  );

  const selectedSessionCheckinCount = React.useMemo(
    () => recentCheckins.filter((c) => c.sessionId === selectedSessionId).length,
    [recentCheckins, selectedSessionId]
  );

  if (sessions.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl p-6 text-center">
        <QrCode className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
        <h1 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
          لا توجد حصص مجدولة لليوم في {schoolNameAr}
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
          يظهر هنا جدول حصص اليوم لتفعيل مسح تذاكر QR عند بوابات القاعات. تأكد من جدولة حصة ليومنا الحالي أو العودة لبوابة المدرسة.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href={`/s/${schoolSlug}`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            العودة لبوابة المدرسة
          </Link>
          <Link
            href={`/s/${schoolSlug}/teacher/book-hall`}
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            جدولة حصة جديدة
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Kiosk Header & Session Controls */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">
                  بوابة التوثيق
                </Badge>
                <span className="text-xs text-[var(--text-muted)]">{schoolNameAr}</span>
              </div>
              <h1 className="mt-1.5 text-lg font-bold text-[var(--text-primary)] sm:text-xl">
                ماسح تذاكر الدخول بالبوابة
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={offlineTestMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => setOfflineTestMode((prev) => !prev)}
                leftIcon={<WifiOff className="h-3.5 w-3.5" />}
                className="min-h-[44px]"
              >
                {offlineTestMode ? "إنهاء محاكاة الأوفلاين" : "اختبار أوفلاين"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMuted((prev) => !prev)}
                aria-label={muted ? "تشغيل التنبيه الصوتي" : "كتم التنبيه الصوتي"}
                leftIcon={
                  muted ? (
                    <VolumeX className="h-4 w-4 text-[var(--text-muted)]" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                  )
                }
                className="min-h-[44px]"
              >
                {muted ? "صامت" : "الصوت مفعل"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <SelectInput
                label="الحصة النشطة عند هذه البوابة"
                inputSize="lg"
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionIdRaw(e.target.value);
                  setOutcome(null);
                }}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.titleAr} — {session.hallCode} (
                    {formatCairoTime(session.startsAt)})
                  </option>
                ))}
              </SelectInput>
            </div>

            <div className="lg:col-span-5">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={downloadingManifest}
                disabled={!effectiveOnline || !selectedSessionId}
                onClick={handleDownloadManifest}
                leftIcon={<CloudDownload className="h-4 w-4" />}
                className="h-[52px]"
              >
                حفظ كشف الحصة أوفلاين
              </Button>
            </div>
          </div>

          <OfflineQueueBadge
            isOnline={effectiveOnline}
            pendingCount={queuedScans.length}
            manifestCount={cachedManifest ? cachedManifest.entries.length : null}
            syncing={syncingQueue}
            onSyncNow={() => void handleSyncQueue()}
          />
        </div>
      </Card>

      {/* Main 2-Column Scanner Workspace */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Right/Primary Column: Camera, Outcome Banner, Manual Input, Simulator */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* <1s Full Outcome Banner */}
          <AnimatePresence mode="wait">
            {outcome && (
              <motion.div
                key={outcome.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={MOTION_SPRINGS.subtle}
              >
                {(() => {
                  const meta = getOutcomePresentation(outcome.result);
                  const Icon = meta.icon;
                  return (
                    <div
                      role="status"
                      aria-live="assertive"
                      className={cn(
                        "rounded-xl border-2 p-4 hairline-lift",
                        meta.wrapperClass
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <Icon
                            className={cn("mt-0.5 h-6 w-6 shrink-0", meta.iconClass)}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-bold">{meta.titleAr}</p>
                              {outcome.isSimulatedDemo && (
                                <Badge variant="mono" size="sm">
                                  محاكاة العرض
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-medium">
                              {outcome.messageAr}
                            </p>
                            {(outcome.studentLabel || outcome.seatNumber) && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {outcome.studentLabel && (
                                  <Badge variant="neutral" size="md">
                                    {outcome.studentLabel}
                                  </Badge>
                                )}
                                {outcome.seatNumber && (
                                  <Badge variant="mono" size="md" dir="ltr">
                                    مقعد {outcome.seatNumber}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="mono" size="sm">
                            {outcome.modeLabel}
                          </Badge>
                          <span
                            className="font-mono text-[11px] opacity-80 tabular-nums"
                            dir="ltr"
                          >
                            {outcome.latencyMs} ms
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Camera QR Scanner Card (16px ceiling frame) */}
          <Card variant="frame" className="overflow-hidden">
            <CardHeader className="border-b border-[var(--border-hairline)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                  <CardTitle className="text-sm">كاميرا فحص QR المباشرة</CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {torchSupported && cameraStatus === "scanning" && (
                    <Button
                      variant={torchOn ? "primary" : "outline"}
                      size="sm"
                      onClick={() => void handleToggleTorch()}
                      leftIcon={<Flashlight className="h-3.5 w-3.5" />}
                      className="min-h-[44px]"
                    >
                      {torchOn ? "إطفاء الكشاف" : "تشغيل الكشاف"}
                    </Button>
                  )}

                  {cameraStatus === "scanning" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void stopCamera()}
                      leftIcon={<CameraOff className="h-3.5 w-3.5" />}
                      className="min-h-[44px]"
                    >
                      إيقاف الكاميرا
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={cameraStatus === "starting"}
                      onClick={() => void startCamera()}
                      leftIcon={<Camera className="h-3.5 w-3.5" />}
                      className="min-h-[44px]"
                    >
                      تشغيل الكاميرا
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="relative overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
                <div
                  id={SCANNER_CONTAINER_ID}
                  className={cn(
                    "w-full",
                    cameraStatus === "scanning" ? "min-h-[260px]" : "hidden"
                  )}
                />

                {cameraStatus !== "scanning" && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
                      {cameraStatus === "denied" || cameraStatus === "unavailable" ? (
                        <CameraOff className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <QrCode className="h-6 w-6" />
                      )}
                    </span>
                    <div className="max-w-sm">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {cameraStatus === "denied"
                          ? "تعذر الوصول إلى الكاميرا"
                          : cameraStatus === "unavailable"
                            ? "الكاميرا غير متاحة على هذا الجهاز"
                            : "الكاميرا في وضع الاستعداد"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        {cameraError ??
                          "اضغط «تشغيل الكاميرا» لمسح تذاكر الطلاب، أو استخدم الإدخال اليدوي وقارئ الباركود USB أدناه."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Raw Token Input / Hardware Scanner Wedge */}
              <form
                onSubmit={handleManualSubmit}
                className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end"
              >
                <Input
                  ref={manualInputRef}
                  label="إدخال رمز التذكرة يدوياً أو عبر قارئ USB"
                  placeholder="v1.<bookingId>.<sessionId>.<nonce>.<hmac>"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  inputSize="lg"
                  dir="ltr"
                  className="font-mono text-xs"
                  containerClassName="flex-1 min-w-0"
                  startAdornment={<KeyRound className="h-4 w-4" />}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={processingScan}
                  disabled={!manualToken.trim()}
                  className="h-[52px] shrink-0 sm:px-6"
                >
                  فحص التذكرة
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Ministry Demonstration Simulator Demo Bar */}
          <Card variant="sunken">
            <CardHeader className="p-4 pb-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                  <CardTitle className="text-sm">شريط محاكاة البوابة (عرض الوزارة)</CardTitle>
                </div>
                <Badge variant="mono" size="sm">
                  Simulator Bar
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                يستخدم الرمز المدخل يدوياً أو آخر تذكرة ممسوحة لاختبار حالات الدخول الحقيقية، أو يعرض محاكاة فورية عند عدم توفر رمز.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2">
              <Button
                variant="outline"
                size="md"
                loading={processingScan}
                onClick={() => void handleSimulatorAction("checked_in")}
                className="min-h-[44px] justify-start border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                leftIcon={<CheckCircle2 className="h-4 w-4 shrink-0" />}
              >
                محاكاة مسح تذكرة صحيحة
              </Button>
              <Button
                variant="outline"
                size="md"
                loading={processingScan}
                onClick={() => void handleSimulatorAction("already_checked_in")}
                className="min-h-[44px] justify-start border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10"
                leftIcon={<AlertTriangle className="h-4 w-4 shrink-0" />}
              >
                محاكاة تذكرة مكررة
              </Button>
              <Button
                variant="outline"
                size="md"
                loading={processingScan}
                onClick={() => void handleSimulatorAction("wrong_session")}
                className="min-h-[44px] justify-start border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10"
                leftIcon={<AlertTriangle className="h-4 w-4 shrink-0" />}
              >
                محاكاة قاعة خاطئة
              </Button>
              <Button
                variant="outline"
                size="md"
                loading={processingScan}
                onClick={() => void handleSimulatorAction("invalid_token")}
                className="min-h-[44px] justify-start border-red-200 text-red-800 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                leftIcon={<XCircle className="h-4 w-4 shrink-0" />}
              >
                محاكاة تذكرة غير صالحة
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Left/Secondary Column: Active Session Telemetry + Recent Check-ins Log */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {activeSession && (
            <Card>
              <CardHeader className="p-4 pb-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="primary" size="sm">
                    {activeSession.subjectCode}
                  </Badge>
                  <Badge variant="mono" dir="ltr">
                    {activeSession.hallCode}
                  </Badge>
                </div>
                <CardTitle className="mt-2 text-base">
                  {activeSession.titleAr}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 px-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="tabular-nums">
                    {formatCairoTimeRange(
                      activeSession.startsAt,
                      activeSession.endsAt
                    )}
                  </span>
                  <span>
                    معلم المادة · كود{" "}
                    <span className="font-mono" dir="ltr">
                      {activeSession.teacherCode}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5 text-center">
                    <p className="text-[11px] text-[var(--text-muted)]">الحضور</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {formatArabicNumber(selectedSessionCheckinCount)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5 text-center">
                    <p className="text-[11px] text-[var(--text-muted)]">المحجوز</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-[var(--text-primary)] tabular-nums">
                      {formatArabicNumber(activeSession.bookedSeatsCount)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5 text-center">
                    <p className="text-[11px] text-[var(--text-muted)]">السعة</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-[var(--text-primary)] tabular-nums">
                      {formatArabicNumber(activeSession.maxCapacity)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Check-ins Table */}
          <Card className="flex-1">
            <CardHeader className="border-b border-[var(--border-hairline)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                  <CardTitle className="text-sm">سجل الحضور الفوري</CardTitle>
                  <Badge variant="success" size="sm">
                    {formatArabicNumber(sessionCheckins.length)}
                  </Badge>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllSessionsCheckins((prev) => !prev)}
                  className="inline-flex min-h-[44px] items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showAllSessionsCheckins ? "الحصة المختارة فقط" : "كل حصص اليوم"}
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {sessionCheckins.length === 0 ? (
                <div className="p-6 text-center">
                  <ShieldCheck className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
                  <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">
                    لم يتم تسجيل حضور أي طالب في هذه القائمة حتى الآن.
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[11px] text-[var(--text-muted)]">
                      <tr>
                        <th className="px-4 py-2.5 text-start font-medium">الطالب</th>
                        <th className="px-3 py-2.5 text-start font-medium">المقعد</th>
                        <th className="px-4 py-2.5 text-end font-medium">وقت الدخول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                      {sessionCheckins.map((item) => (
                        <tr
                          key={`${item.bookingId}-${item.checkedInAt}`}
                          className="hover:bg-[var(--bg-sunken)]/60"
                        >
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)] tabular-nums">
                            {item.studentLabel}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="mono" size="sm" dir="ltr">
                              {item.seatNumber ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-end text-[var(--text-muted)] tabular-nums">
                            {item.checkedInAt
                              ? formatCairoTime(item.checkedInAt)
                              : "الآن"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
