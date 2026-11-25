import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getPublicEnv } from "@/lib/env";
import type { Database, TableRow } from "./database.types";

export type SchoolRow = TableRow<"schools">;
export type AcademicGradeRow = TableRow<"academic_grades">;
export type AcademicTrackRow = TableRow<"academic_tracks">;
export type SubjectRow = TableRow<"subjects">;
export type TrackSubjectRow = TableRow<"track_subjects">;

export interface SchoolCatalogBundle {
  readonly school: SchoolRow;
  readonly grades: readonly AcademicGradeRow[];
  readonly tracks: readonly AcademicTrackRow[];
  readonly subjects: readonly SubjectRow[];
  readonly trackSubjects: readonly TrackSubjectRow[];
}

export const CATALOG_REVALIDATE_SECONDS = 300;

function createStatelessCatalogClient(): SupabaseClient<Database> {
  const env = getPublicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/** Fetches all active schools ordered alphabetically by Arabic name. */
export async function fetchActiveSchools(
  client: SupabaseClient<Database>
): Promise<readonly SchoolRow[]> {
  const { data, error } = await client
    .from("schools")
    .select("*")
    .eq("is_active", true)
    .order("name_ar", { ascending: true });

  if (error) {
    throw new Error(`Failed to load schools catalog: ${error.message}`);
  }

  return data ?? [];
}

/** Fetches an active school by its tenant slug, or returns null when absent. */
export async function fetchSchoolBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<SchoolRow | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const { data, error } = await client
    .from("schools")
    .select("*")
    .eq("slug", normalizedSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load school '${normalizedSlug}': ${error.message}`);
  }

  return data;
}

/** Fetches active academic grades for a school sorted by display order. */
export async function fetchAcademicGradesBySchool(
  client: SupabaseClient<Database>,
  schoolId: string
): Promise<readonly AcademicGradeRow[]> {
  const { data, error } = await client
    .from("academic_grades")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load academic grades: ${error.message}`);
  }

  return data ?? [];
}

/** Fetches active academic tracks for a school (optionally scoped to a specific grade). */
export async function fetchAcademicTracks(
  client: SupabaseClient<Database>,
  schoolId: string,
  gradeId?: string
): Promise<readonly AcademicTrackRow[]> {
  let query = client
    .from("academic_tracks")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (gradeId) {
    query = query.eq("grade_id", gradeId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load academic tracks: ${error.message}`);
  }

  return data ?? [];
}

/** Fetches active subjects for a school (optionally scoped to a specific grade). */
export async function fetchSubjects(
  client: SupabaseClient<Database>,
  schoolId: string,
  gradeId?: string
): Promise<readonly SubjectRow[]> {
  let query = client
    .from("subjects")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name_ar", { ascending: true });

  if (gradeId) {
    query = query.eq("grade_id", gradeId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load subjects catalog: ${error.message}`);
  }

  return data ?? [];
}

/** Fetches track-to-subject mapping rows for a school. */
export async function fetchTrackSubjectsBySchool(
  client: SupabaseClient<Database>,
  schoolId: string
): Promise<readonly TrackSubjectRow[]> {
  const { data, error } = await client
    .from("track_subjects")
    .select("*")
    .eq("school_id", schoolId);

  if (error) {
    throw new Error(`Failed to load track_subjects catalog: ${error.message}`);
  }

  return data ?? [];
}

/** Fetches a complete public catalog bundle for a school slug in parallel. */
export async function fetchSchoolCatalogBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<SchoolCatalogBundle | null> {
  const school = await fetchSchoolBySlug(client, slug);
  if (!school) {
    return null;
  }

  const [grades, tracks, subjects, trackSubjects] = await Promise.all([
    fetchAcademicGradesBySchool(client, school.id),
    fetchAcademicTracks(client, school.id),
    fetchSubjects(client, school.id),
    fetchTrackSubjectsBySchool(client, school.id),
  ]);

  return {
    school,
    grades,
    tracks,
    subjects,
    trackSubjects,
  };
}

const getActiveSchoolsCached = unstable_cache(
  async () => fetchActiveSchools(createStatelessCatalogClient()),
  ["catalog:schools:active"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog", "schools"] }
);

const getSchoolBySlugCached = unstable_cache(
  async (slug: string) => fetchSchoolBySlug(createStatelessCatalogClient(), slug),
  ["catalog:school:by-slug"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog", "schools"] }
);

const getAcademicGradesCached = unstable_cache(
  async (schoolId: string) =>
    fetchAcademicGradesBySchool(createStatelessCatalogClient(), schoolId),
  ["catalog:academic-grades:by-school"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog", "academic_grades"] }
);

const getAcademicTracksCached = unstable_cache(
  async (schoolId: string, gradeId?: string) =>
    fetchAcademicTracks(createStatelessCatalogClient(), schoolId, gradeId),
  ["catalog:academic-tracks:by-school"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog", "academic_tracks"] }
);

const getSubjectsCached = unstable_cache(
  async (schoolId: string, gradeId?: string) =>
    fetchSubjects(createStatelessCatalogClient(), schoolId, gradeId),
  ["catalog:subjects:by-school"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog", "subjects"] }
);

const getTrackSubjectsCached = unstable_cache(
  async (schoolId: string) =>
    fetchTrackSubjectsBySchool(createStatelessCatalogClient(), schoolId),
  ["catalog:track-subjects:by-school"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog", "track_subjects"] }
);

const getSchoolCatalogBySlugCached = unstable_cache(
  async (slug: string) => fetchSchoolCatalogBySlug(createStatelessCatalogClient(), slug),
  ["catalog:bundle:by-slug"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [
      "catalog",
      "schools",
      "academic_grades",
      "academic_tracks",
      "subjects",
      "track_subjects",
    ],
  }
);

export const getActiveSchools = cache(async () => getActiveSchoolsCached());
export const getSchoolBySlug = cache(async (slug: string) => getSchoolBySlugCached(slug));
export const getAcademicGradesBySchool = cache(async (schoolId: string) =>
  getAcademicGradesCached(schoolId)
);
export const getAcademicTracks = cache(async (schoolId: string, gradeId?: string) =>
  getAcademicTracksCached(schoolId, gradeId)
);
export const getSubjects = cache(async (schoolId: string, gradeId?: string) =>
  getSubjectsCached(schoolId, gradeId)
);
export const getTrackSubjectsBySchool = cache(async (schoolId: string) =>
  getTrackSubjectsCached(schoolId)
);
export const getSchoolCatalogBySlug = cache(async (slug: string) =>
  getSchoolCatalogBySlugCached(slug)
);
