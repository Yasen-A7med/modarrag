"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  Grid3X3,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Route,
} from "lucide-react";
import {
  toggleTrackSubjectAction,
  upsertGradeAction,
  upsertSubjectAction,
  upsertTrackAction,
  type SchoolAdminDashboardData,
} from "@/application/academic/actions";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { SubjectType } from "@/infrastructure/supabase/database.types";
import { SUBJECT_TYPE_TONES, type BadgeTone } from "@/lib/design-tokens";
import { formatArabicNumber, SUBJECT_TYPE_LABELS } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const TRACK_COLORS = [
  "#1E3A8A",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#0F766E",
  "#BE123C",
] as const;

const TRACK_ICON_OPTIONS = [
  { key: "cpu", label: "الهندسة والتقنية (CPU)" },
  { key: "microscope", label: "الطب وعلوم الحياة (Microscope)" },
  { key: "briefcase", label: "الأعمال والاقتصاد (Briefcase)" },
  { key: "book-open", label: "الآداب واللغات (Book)" },
] as const;

function resolveSubjectTypeMeta(type: string): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  if (type in SUBJECT_TYPE_LABELS) {
    const typed = type as SubjectType;
    return {
      label: SUBJECT_TYPE_LABELS[typed].ar,
      tone: SUBJECT_TYPE_TONES[typed],
    };
  }
  return { label: type, tone: "neutral" };
}

type CmsTab = "matrix" | "subjects" | "tracks" | "grades";

export interface AcademicCmsClientProps {
  readonly schoolSlug: string;
  readonly data: SchoolAdminDashboardData;
}

/**
 * Dynamic Curriculum CMS for Grades, Baccalaureate Tracks, Subjects,
 * and interactive Track-Subject assignment matrix.
 */
export function AcademicCmsClient({ schoolSlug, data }: AcademicCmsClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<CmsTab>("matrix");
  const [selectedGradeFilter, setSelectedGradeFilter] = React.useState<string>(
    data.grades[0]?.id ?? ""
  );
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);

  // Grade Dialog state
  const [gradeModalOpen, setGradeModalOpen] = React.useState(false);
  const [gradeEditId, setGradeEditId] = React.useState<string | undefined>(undefined);
  const [gradeCode, setGradeCode] = React.useState("");
  const [gradeNameAr, setGradeNameAr] = React.useState("");
  const [gradeNameEn, setGradeNameEn] = React.useState("");
  const [gradeSortOrder, setGradeSortOrder] = React.useState("1");
  const [gradeIsActive, setGradeIsActive] = React.useState(true);
  const [savingGrade, setSavingGrade] = React.useState(false);

  // Track Dialog state
  const [trackModalOpen, setTrackModalOpen] = React.useState(false);
  const [trackEditId, setTrackEditId] = React.useState<string | undefined>(undefined);
  const [trackGradeId, setTrackGradeId] = React.useState(data.grades[0]?.id ?? "");
  const [trackCode, setTrackCode] = React.useState("");
  const [trackNameAr, setTrackNameAr] = React.useState("");
  const [trackNameEn, setTrackNameEn] = React.useState("");
  const [trackColorHex, setTrackColorHex] = React.useState("#1E3A8A");
  const [trackIconKey, setTrackIconKey] = React.useState("cpu");
  const [trackSortOrder, setTrackSortOrder] = React.useState("1");
  const [trackIsActive, setTrackIsActive] = React.useState(true);
  const [savingTrack, setSavingTrack] = React.useState(false);

  // Subject Dialog state
  const [subjectModalOpen, setSubjectModalOpen] = React.useState(false);
  const [subjectEditId, setSubjectEditId] = React.useState<string | undefined>(undefined);
  const [subjectGradeId, setSubjectGradeId] = React.useState(data.grades[0]?.id ?? "");
  const [subjectCode, setSubjectCode] = React.useState("");
  const [subjectNameAr, setSubjectNameAr] = React.useState("");
  const [subjectNameEn, setSubjectNameEn] = React.useState("");
  const [subjectType, setSubjectType] = React.useState<SubjectType>("track_core");
  const [subjectElectiveGroup, setSubjectElectiveGroup] = React.useState("");
  const [subjectColorHex, setSubjectColorHex] = React.useState("#1E3A8A");
  const [subjectIsActive, setSubjectIsActive] = React.useState(true);
  const [savingSubject, setSavingSubject] = React.useState(false);

  const gradeNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of data.grades) {
      map[g.id] = g.nameAr;
    }
    return map;
  }, [data.grades]);

  const activeGradeTracks = React.useMemo(() => {
    if (!selectedGradeFilter) return data.tracks;
    return data.tracks.filter((t) => t.gradeId === selectedGradeFilter);
  }, [data.tracks, selectedGradeFilter]);

  const activeGradeSubjects = React.useMemo(() => {
    if (!selectedGradeFilter) return data.subjects;
    return data.subjects.filter((s) => s.gradeId === selectedGradeFilter);
  }, [data.subjects, selectedGradeFilter]);

  const assignmentMap = React.useMemo(() => {
    const map: Record<string, SchoolAdminDashboardData["trackSubjects"][number]> = {};
    for (const ts of data.trackSubjects) {
      map[`${ts.trackId}:${ts.subjectId}`] = ts;
    }
    return map;
  }, [data.trackSubjects]);

  // Open Grade modal
  const openCreateGrade = () => {
    setGradeEditId(undefined);
    setGradeCode("");
    setGradeNameAr("");
    setGradeNameEn("");
    setGradeSortOrder(String(data.grades.length + 1));
    setGradeIsActive(true);
    setGradeModalOpen(true);
  };

  const openEditGrade = (g: SchoolAdminDashboardData["grades"][number]) => {
    setGradeEditId(g.id);
    setGradeCode(g.code);
    setGradeNameAr(g.nameAr);
    setGradeNameEn("");
    setGradeSortOrder(String(g.sortOrder));
    setGradeIsActive(g.isActive);
    setGradeModalOpen(true);
  };

  const handleSaveGrade = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingGrade(true);
    try {
      const sortNum = Number.parseInt(gradeSortOrder, 10);
      const result = await upsertGradeAction({
        schoolSlug,
        ...(gradeEditId ? { id: gradeEditId } : {}),
        code: gradeCode.trim().toUpperCase(),
        nameAr: gradeNameAr.trim(),
        ...(gradeNameEn.trim() ? { nameEn: gradeNameEn.trim() } : {}),
        sortOrder: Number.isNaN(sortNum) ? 0 : Math.max(0, sortNum),
        isActive: gradeIsActive,
      });
      if (!result.ok) {
        toast({ title: "تعذر حفظ الصف الدراسي", description: result.error.message, variant: "error" });
        return;
      }
      toast({ title: "تم حفظ الصف الدراسي", variant: "success" });
      setGradeModalOpen(false);
      router.refresh();
    } finally {
      setSavingGrade(false);
    }
  };

  // Open Track modal
  const openCreateTrack = () => {
    setTrackEditId(undefined);
    setTrackGradeId(selectedGradeFilter || data.grades[0]?.id || "");
    setTrackCode("");
    setTrackNameAr("");
    setTrackNameEn("");
    setTrackColorHex("#1E3A8A");
    setTrackIconKey("cpu");
    setTrackSortOrder(String(data.tracks.length + 1));
    setTrackIsActive(true);
    setTrackModalOpen(true);
  };

  const openEditTrack = (t: SchoolAdminDashboardData["tracks"][number]) => {
    setTrackEditId(t.id);
    setTrackGradeId(t.gradeId);
    setTrackCode(t.code);
    setTrackNameAr(t.nameAr);
    setTrackNameEn("");
    setTrackColorHex(t.colorHex);
    setTrackIconKey("cpu");
    setTrackSortOrder("1");
    setTrackIsActive(t.isActive);
    setTrackModalOpen(true);
  };

  const handleSaveTrack = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingTrack(true);
    try {
      const sortNum = Number.parseInt(trackSortOrder, 10);
      const result = await upsertTrackAction({
        schoolSlug,
        ...(trackEditId ? { id: trackEditId } : {}),
        gradeId: trackGradeId,
        code: trackCode.trim().toUpperCase(),
        nameAr: trackNameAr.trim(),
        ...(trackNameEn.trim() ? { nameEn: trackNameEn.trim() } : {}),
        colorHex: trackColorHex,
        iconKey: trackIconKey,
        sortOrder: Number.isNaN(sortNum) ? 0 : Math.max(0, sortNum),
        isActive: trackIsActive,
      });
      if (!result.ok) {
        toast({ title: "تعذر حفظ المسار", description: result.error.message, variant: "error" });
        return;
      }
      toast({ title: "تم حفظ المسار الدراسي", variant: "success" });
      setTrackModalOpen(false);
      router.refresh();
    } finally {
      setSavingTrack(false);
    }
  };

  // Open Subject modal
  const openCreateSubject = () => {
    setSubjectEditId(undefined);
    setSubjectGradeId(selectedGradeFilter || data.grades[0]?.id || "");
    setSubjectCode("");
    setSubjectNameAr("");
    setSubjectNameEn("");
    setSubjectType("track_core");
    setSubjectElectiveGroup("");
    setSubjectColorHex("#1E3A8A");
    setSubjectIsActive(true);
    setSubjectModalOpen(true);
  };

  const openEditSubject = (s: SchoolAdminDashboardData["subjects"][number]) => {
    setSubjectEditId(s.id);
    setSubjectGradeId(s.gradeId);
    setSubjectCode(s.code);
    setSubjectNameAr(s.nameAr);
    setSubjectNameEn("");
    setSubjectType((s.subjectType as SubjectType) || "track_core");
    setSubjectElectiveGroup("");
    setSubjectColorHex("#1E3A8A");
    setSubjectIsActive(s.isActive);
    setSubjectModalOpen(true);
  };

  const handleSaveSubject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSubject(true);
    try {
      const result = await upsertSubjectAction({
        schoolSlug,
        ...(subjectEditId ? { id: subjectEditId } : {}),
        gradeId: subjectGradeId,
        code: subjectCode.trim().toUpperCase(),
        nameAr: subjectNameAr.trim(),
        ...(subjectNameEn.trim() ? { nameEn: subjectNameEn.trim() } : {}),
        subjectType,
        electiveGroupCode:
          subjectType === "track_elective" && subjectElectiveGroup.trim()
            ? subjectElectiveGroup.trim().toUpperCase()
            : null,
        colorHex: subjectColorHex,
        isActive: subjectIsActive,
      });
      if (!result.ok) {
        toast({ title: "تعذر حفظ المادة", description: result.error.message, variant: "error" });
        return;
      }
      toast({ title: "تم حفظ المادة الدراسية", variant: "success" });
      setSubjectModalOpen(false);
      router.refresh();
    } finally {
      setSavingSubject(false);
    }
  };

  const handleToggleTrackSubject = async (
    trackId: string,
    subject: SchoolAdminDashboardData["subjects"][number]
  ) => {
    const key = `${trackId}:${subject.id}`;
    const currentlyAssigned = Boolean(assignmentMap[key]);
    setTogglingKey(key);

    try {
      const result = await toggleTrackSubjectAction({
        schoolSlug,
        trackId,
        subjectId: subject.id,
        isMandatory: subject.subjectType !== "track_elective",
        electiveGroupCode:
          subject.subjectType === "track_elective" ? "SECOND_LANG" : null,
        assign: !currentlyAssigned,
      });

      if (!result.ok) {
        toast({
          title: "تعذر تعديل مصفوفة المواد",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: result.data.assigned
          ? `تم ربط "${subject.nameAr}" بالمسار`
          : `تم فك ربط "${subject.nameAr}" من المسار`,
        variant: "success",
      });
      router.refresh();
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header & CMS Section Switcher */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              إدارة المناهج والمسارات الديناميكية
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-muted)]">
              تخصيص الصفوف، مسارات البكالوريا المصرية، المواد التخصصية والاختيارية، ومصفوفة الأهلية
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="md"
              className="min-h-[44px]"
              onClick={openCreateGrade}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              صف دراسي
            </Button>
            <Button
              variant="outline"
              size="md"
              className="min-h-[44px]"
              onClick={openCreateTrack}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              مسار
            </Button>
            <Button
              variant="primary"
              size="md"
              className="min-h-[44px]"
              onClick={openCreateSubject}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              مادة جديدة
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-4 py-2.5 sm:px-5">
          <div className="flex max-w-full items-center gap-1.5 overflow-x-auto">
            {(
              [
                { key: "matrix", label: "مصفوفة المسار والمادة", icon: Grid3X3 },
                {
                  key: "subjects",
                  label: `المواد (${formatArabicNumber(data.subjects.length)})`,
                  icon: BookOpen,
                },
                {
                  key: "tracks",
                  label: `المسارات (${formatArabicNumber(data.tracks.length)})`,
                  icon: Route,
                },
                {
                  key: "grades",
                  label: `الصفوف (${formatArabicNumber(data.grades.length)})`,
                  icon: Layers,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    activeTab === tab.key
                      ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {data.grades.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">الصف:</span>
              <select
                aria-label="تصفية حسب الصف الدراسي"
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="h-10 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
              >
                <option value="">جميع الصفوف</option>
                {data.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* TAB 1: Interactive Track-Subject Matrix */}
      {activeTab === "matrix" && (
        <Card>
          <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
            <CardTitle className="text-base">مصفوفة ربط المواد بالمسارات</CardTitle>
            <p className="text-xs text-[var(--text-muted)]">
              انقر على أي خلية لتفعيل أو إلغاء إتاحة المادة لطلاب المسار التخصصي (يتم تطبيقه فوراً على محرك الأهلية).
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {activeGradeTracks.length === 0 || activeGradeSubjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                أضف مساراً ومادة واحدة على الأقل لهذا الصف لتظهر المصفوفة التفاعلية.
              </div>
            ) : (
              <>
                {/* Mobile Track Cards (< md) */}
                <div className="divide-y divide-[var(--border-hairline)] md:hidden">
                  {activeGradeTracks.map((track) => (
                    <div key={track.id} className="p-4">
                      <div className="flex items-center gap-2.5">
                        <TrackIcon trackCode={track.code} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {track.nameAr}
                          </p>
                          <p className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                            {track.code}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-1.5">
                        {activeGradeSubjects.map((subj) => {
                          const key = `${track.id}:${subj.id}`;
                          const assigned = Boolean(assignmentMap[key]);
                          const busy = togglingKey === key;
                          return (
                            <button
                              key={subj.id}
                              type="button"
                              disabled={busy}
                              onClick={() => handleToggleTrackSubject(track.id, subj)}
                              className={cn(
                                "flex min-h-[44px] items-center justify-between rounded-lg border px-3 py-2 text-start text-xs font-medium cursor-pointer transition-colors",
                                assigned
                                  ? "border-emerald-300 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                                  : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                              )}
                            >
                              <span>{subj.nameAr}</span>
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : assigned ? (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <span className="text-[11px] text-[var(--text-muted)]">غير مرتبط</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Matrix Table (>= md) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
                        <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--text-muted)]">
                          المادة الدراسية
                        </th>
                        {activeGradeTracks.map((track) => (
                          <th key={track.id} className="px-3 py-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: track.colorHex }}
                                />
                                <span className="text-xs font-bold text-[var(--text-primary)]">
                                  {track.nameAr}
                                </span>
                              </div>
                              <span
                                className="font-mono text-[10px] text-[var(--text-muted)]"
                                dir="ltr"
                              >
                                {track.code}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                      {activeGradeSubjects.map((subj) => {
                        const typeMeta = resolveSubjectTypeMeta(subj.subjectType);
                        return (
                          <tr
                            key={subj.id}
                            className="hover:bg-[var(--bg-sunken)]/40"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                                    {subj.nameAr}
                                  </p>
                                  <p
                                    className="font-mono text-[11px] text-[var(--text-muted)]"
                                    dir="ltr"
                                  >
                                    {subj.code}
                                  </p>
                                </div>
                                <Badge variant={typeMeta.tone} size="sm">
                                  {typeMeta.label}
                                </Badge>
                              </div>
                            </td>

                            {activeGradeTracks.map((track) => {
                              const key = `${track.id}:${subj.id}`;
                              const entry = assignmentMap[key];
                              const assigned = Boolean(entry);
                              const busy = togglingKey === key;

                              return (
                                <td key={track.id} className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      handleToggleTrackSubject(track.id, subj)
                                    }
                                    aria-label={`${assigned ? "إزالة" : "إضافة"} ${subj.nameAr} إلى ${track.nameAr}`}
                                    className={cn(
                                      "inline-flex h-11 min-w-[72px] items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors cursor-pointer",
                                      assigned
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                                        : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                                    )}
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : assigned ? (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        <span>{entry?.isMandatory ? "إلزامي" : "اختياري"}</span>
                                      </>
                                    ) : (
                                      <span>—</span>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Subjects Table */}
      {activeTab === "subjects" && (
        <Card>
          <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">قائمة المواد الدراسية</CardTitle>
              <Button
                variant="primary"
                size="sm"
                className="min-h-[40px]"
                onClick={openCreateSubject}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                إضافة مادة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border-hairline)]">
              {activeGradeSubjects.map((subj) => {
                const typeMeta = resolveSubjectTypeMeta(subj.subjectType);
                return (
                  <div
                    key={subj.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {subj.nameAr}
                        </span>
                        <Badge variant="mono" dir="ltr">
                          {subj.code}
                        </Badge>
                        <Badge variant={typeMeta.tone}>{typeMeta.label}</Badge>
                        {!subj.isActive && <Badge variant="neutral">معطلة</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        الصف: {gradeNameById[subj.gradeId] ?? "—"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[40px]"
                      onClick={() => openEditSubject(subj)}
                      leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    >
                      تعديل
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Tracks Grid */}
      {activeTab === "tracks" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activeGradeTracks.map((track) => (
            <Card key={track.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TrackIcon trackCode={track.code} size="md" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {track.nameAr}
                      </h3>
                      <Badge variant={track.isActive ? "success" : "neutral"}>
                        {track.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: track.colorHex }}
                      />
                      <span className="font-mono" dir="ltr">
                        {track.code}
                      </span>
                      <span>· {gradeNameById[track.gradeId] ?? ""}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[40px]"
                  onClick={() => openEditTrack(track)}
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                >
                  تعديل
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 4: Grades List */}
      {activeTab === "grades" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.grades.map((grade) => (
            <Card key={grade.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {grade.nameAr}
                    </h3>
                    <Badge variant={grade.isActive ? "success" : "neutral"}>
                      {grade.isActive ? "نشط" : "معطل"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="font-mono" dir="ltr">
                      {grade.code}
                    </span>
                    <span className="tabular-nums">
                      · الترتيب: {formatArabicNumber(grade.sortOrder)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[40px]"
                  onClick={() => openEditGrade(grade)}
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                >
                  تعديل
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Grade Modal */}
      <Dialog open={gradeModalOpen} onOpenChange={setGradeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {gradeEditId ? "تعديل الصف الدراسي" : "إضافة صف دراسي جديد"}
            </DialogTitle>
            <DialogDescription>
              تحديد رمز الصف واسمه ليظهر في بوابة الطلاب والمسارات.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveGrade} className="mt-4 flex flex-col gap-3">
            <Input
              label="كود الصف (رمز إنجليزي مختصر)"
              dir="ltr"
              required
              minLength={2}
              maxLength={32}
              placeholder="SEC_2_BACC"
              value={gradeCode}
              onChange={(e) => setGradeCode(e.target.value)}
            />
            <Input
              label="اسم الصف بالعربية"
              required
              maxLength={120}
              placeholder="الثانوية العامة — البكالوريا"
              value={gradeNameAr}
              onChange={(e) => setGradeNameAr(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="الاسم بالإنجليزية (اختياري)"
                dir="ltr"
                maxLength={120}
                placeholder="Secondary Year 2"
                value={gradeNameEn}
                onChange={(e) => setGradeNameEn(e.target.value)}
              />
              <Input
                label="ترتيب العرض"
                type="number"
                min={0}
                max={999}
                value={gradeSortOrder}
                onChange={(e) => setGradeSortOrder(e.target.value)}
              />
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={gradeIsActive}
                onChange={(e) => setGradeIsActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>الصف مفعل ومتاح لاختيار الطلاب</span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setGradeModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={savingGrade}
                className="min-h-[44px]"
              >
                حفظ الصف
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Track Modal */}
      <Dialog open={trackModalOpen} onOpenChange={setTrackModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {trackEditId ? "تعديل المسار التخصصي" : "إضافة مسار تخصصي"}
            </DialogTitle>
            <DialogDescription>
              تحديد المسار (مثل الهندسة أو الطب) واللون المميز وأيقونة العرض.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTrack} className="mt-4 flex flex-col gap-3">
            <SelectInput
              label="الصف الدراسي"
              required
              value={trackGradeId}
              onChange={(e) => setTrackGradeId(e.target.value)}
            >
              {data.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </SelectInput>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="كود المسار"
                dir="ltr"
                required
                minLength={2}
                maxLength={32}
                placeholder="ENG_TRACK"
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
              />
              <Input
                label="اسم المسار بالعربية"
                required
                maxLength={120}
                placeholder="الهندسة وعلوم الحاسب"
                value={trackNameAr}
                onChange={(e) => setTrackNameAr(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectInput
                label="أيقونة المسار"
                value={trackIconKey}
                onChange={(e) => setTrackIconKey(e.target.value)}
              >
                {TRACK_ICON_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </SelectInput>
              <Input
                label="ترتيب العرض"
                type="number"
                min={0}
                max={999}
                value={trackSortOrder}
                onChange={(e) => setTrackSortOrder(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                اللون المميز (Hex)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {TRACK_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setTrackColorHex(hex)}
                    className={cn(
                      "h-8 w-8 rounded-md border-2 cursor-pointer",
                      trackColorHex.toUpperCase() === hex
                        ? "border-slate-900 dark:border-white"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: hex }}
                    aria-label={hex}
                  />
                ))}
                <Input
                  dir="ltr"
                  value={trackColorHex}
                  onChange={(e) => setTrackColorHex(e.target.value)}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  containerClassName="w-28"
                />
              </div>
            </div>

            <label className="flex min-h-[44px] items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={trackIsActive}
                onChange={(e) => setTrackIsActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>المسار مفعل ومتاح للاختيار</span>
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setTrackModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={savingTrack}
                className="min-h-[44px]"
              >
                حفظ المسار
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subject Modal */}
      <Dialog open={subjectModalOpen} onOpenChange={setSubjectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subjectEditId ? "تعديل المادة الدراسية" : "إضافة مادة دراسية"}
            </DialogTitle>
            <DialogDescription>
              حدد تصنيف المادة (مشتركة / تخصصية / اختيارية) ليطبقها نظام الحجز تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSubject} className="mt-4 flex flex-col gap-3">
            <SelectInput
              label="الصف الدراسي"
              required
              value={subjectGradeId}
              onChange={(e) => setSubjectGradeId(e.target.value)}
            >
              {data.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </SelectInput>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="كود المادة"
                dir="ltr"
                required
                minLength={2}
                maxLength={40}
                placeholder="CS_PROG"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
              />
              <Input
                label="اسم المادة بالعربية"
                required
                maxLength={120}
                placeholder="البرمجة وعلوم الحاسب"
                value={subjectNameAr}
                onChange={(e) => setSubjectNameAr(e.target.value)}
              />
            </div>

            <SelectInput
              label="نوع المادة"
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value as SubjectType)}
            >
              <option value="common">مادة مشتركة لجميع المسارات</option>
              <option value="track_core">مادة تخصصية أساسية للمسار</option>
              <option value="track_elective">مادة اختيارية (مثل اللغة الثانية)</option>
            </SelectInput>

            {subjectType === "track_elective" && (
              <Input
                label="رمز مجموعة الاختيار (اختياري)"
                dir="ltr"
                maxLength={32}
                placeholder="SECOND_LANG"
                value={subjectElectiveGroup}
                onChange={(e) => setSubjectElectiveGroup(e.target.value)}
              />
            )}

            <label className="flex min-h-[44px] items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={subjectIsActive}
                onChange={(e) => setSubjectIsActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>المادة مفعلة في الجدول</span>
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setSubjectModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={savingSubject}
                className="min-h-[44px]"
              >
                حفظ المادة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
