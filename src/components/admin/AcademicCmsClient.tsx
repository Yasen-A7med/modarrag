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
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { pickPreferredDefaultGradeId } from "@/domain/academic/k12";
import type { SubjectType } from "@/infrastructure/supabase/database.types";
import { SUBJECT_TYPE_TONES, type BadgeTone } from "@/lib/design-tokens";
import { formatArabicNumber, SUBJECT_TYPE_LABELS } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const TRACK_COLORS = [
  "#2563EB",
  "#0A1F44",
  "#16A34A",
  "#D97706",
  "#0F766E",
  "#7C3AED",
] as const;

const TRACK_ICON_OPTIONS = [
  { key: "cpu", label: "الهندسة والتقنية" },
  { key: "microscope", label: "الطب وعلوم الحياة" },
  { key: "briefcase", label: "الأعمال والاقتصاد" },
  { key: "book-open", label: "الآداب واللغات" },
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
 * Slide 7 Blueprint: Academic Matrix CMS supporting K-12 grades, Baccalaureate
 * tracks, subjects, and 1-click Royal Blue checkmark matrix assignment.
 */
export function AcademicCmsClient({ schoolSlug, data }: AcademicCmsClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<CmsTab>("matrix");
  const [selectedGradeFilter, setSelectedGradeFilter] = React.useState<string>(
    () => pickPreferredDefaultGradeId(data.grades)
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
  const [trackGradeId, setTrackGradeId] = React.useState(selectedGradeFilter);
  const [trackCode, setTrackCode] = React.useState("");
  const [trackNameAr, setTrackNameAr] = React.useState("");
  const [trackColorHex, setTrackColorHex] = React.useState<string>("#2563EB");
  const [trackIconKey, setTrackIconKey] = React.useState("cpu");
  const [savingTrack, setSavingTrack] = React.useState(false);

  // Subject Dialog state
  const [subjectModalOpen, setSubjectModalOpen] = React.useState(false);
  const [subjectEditId, setSubjectEditId] = React.useState<string | undefined>(undefined);
  const [subjectGradeId, setSubjectGradeId] = React.useState(selectedGradeFilter);
  const [subjectCode, setSubjectCode] = React.useState("");
  const [subjectNameAr, setSubjectNameAr] = React.useState("");
  const [subjectType, setSubjectType] = React.useState<SubjectType>("track_core");
  const [electiveGroupCode, setElectiveGroupCode] = React.useState("SECOND_LANG");
  const [savingSubject, setSavingSubject] = React.useState(false);

  const visibleTracks = React.useMemo(
    () =>
      data.tracks.filter(
        (t) => !selectedGradeFilter || t.gradeId === selectedGradeFilter
      ),
    [data.tracks, selectedGradeFilter]
  );

  const visibleSubjects = React.useMemo(
    () =>
      data.subjects.filter(
        (s) => !selectedGradeFilter || s.gradeId === selectedGradeFilter
      ),
    [data.subjects, selectedGradeFilter]
  );

  const assignedSet = React.useMemo(() => {
    const set = new Set<string>();
    for (const ts of data.trackSubjects) {
      set.add(`${ts.trackId}:${ts.subjectId}`);
    }
    return set;
  }, [data.trackSubjects]);

  const handleToggleAssignment = async (
    trackId: string,
    subjectId: string,
    currentlyAssigned: boolean
  ) => {
    const key = `${trackId}:${subjectId}`;
    setTogglingKey(key);
    try {
      const res = await toggleTrackSubjectAction({
        schoolSlug,
        trackId,
        subjectId,
        isMandatory: true,
        assign: !currentlyAssigned,
      });

      if (!res.ok) {
        toast({
          title: "تعذر تحديث المصفوفة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: !currentlyAssigned ? "تم ربط المادة بالمسار ✓" : "تم إلغاء الربط",
        variant: "success",
      });
      router.refresh();
    } finally {
      setTogglingKey(null);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingGrade(true);
    try {
      const res = await upsertGradeAction({
        schoolSlug,
        ...(gradeEditId ? { id: gradeEditId } : {}),
        code: gradeCode.trim().toUpperCase(),
        nameAr: gradeNameAr.trim(),
        ...(gradeNameEn.trim() ? { nameEn: gradeNameEn.trim() } : {}),
        sortOrder: Number.parseInt(gradeSortOrder, 10) || 1,
        isActive: gradeIsActive,
      });

      if (!res.ok) {
        toast({
          title: "تعذر حفظ الصف",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم حفظ الصف الدراسي ✓", variant: "success" });
      setGradeModalOpen(false);
      router.refresh();
    } finally {
      setSavingGrade(false);
    }
  };

  const handleSaveTrack = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingTrack(true);
    try {
      const res = await upsertTrackAction({
        schoolSlug,
        ...(trackEditId ? { id: trackEditId } : {}),
        gradeId: trackGradeId || selectedGradeFilter,
        code: trackCode.trim().toUpperCase(),
        nameAr: trackNameAr.trim(),
        colorHex: trackColorHex,
        iconKey: trackIconKey,
        sortOrder: visibleTracks.length + 1,
        isActive: true,
      });

      if (!res.ok) {
        toast({
          title: "تعذر حفظ المسار",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم حفظ المسار ✓", variant: "success" });
      setTrackModalOpen(false);
      router.refresh();
    } finally {
      setSavingTrack(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingSubject(true);
    try {
      const res = await upsertSubjectAction({
        schoolSlug,
        ...(subjectEditId ? { id: subjectEditId } : {}),
        gradeId: subjectGradeId || selectedGradeFilter,
        code: subjectCode.trim().toUpperCase(),
        nameAr: subjectNameAr.trim(),
        subjectType,
        electiveGroupCode:
          subjectType === "track_elective"
            ? electiveGroupCode.trim().toUpperCase() || "SECOND_LANG"
            : null,
        colorHex: "#2563EB",
        isActive: true,
      });

      if (!res.ok) {
        toast({
          title: "تعذر حفظ المادة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم حفظ المادة الدراسية ✓", variant: "success" });
      setSubjectModalOpen(false);
      router.refresh();
    } finally {
      setSavingSubject(false);
    }
  };

  const tabItems: readonly { readonly id: CmsTab; readonly label: string; readonly icon: typeof Grid3X3 }[] = [
    { id: "matrix", label: "مصفوفة المسارات", icon: Grid3X3 },
    { id: "subjects", label: "المواد الدراسية", icon: BookOpen },
    { id: "tracks", label: "المسارات والشعب", icon: Route },
    { id: "grades", label: "كافة الصفوف K-12", icon: Layers },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-[2rem]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <Badge variant="primary" size="md">
              النظام الأكاديمي الشامل K-12
            </Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
              المناهج والمسارات الدراسية
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              توزيع ديناميكي للمواد على الصفوف من ١ ابتدائي حتى ٣ ثانوي والبكالوريا
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectInput
              aria-label="اختر الصف الدراسي"
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              containerClassName="min-w-[220px]"
            >
              {data.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>
      </Card>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1.5">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-colors cursor-pointer",
                  active
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setGradeEditId(undefined);
              setGradeCode("");
              setGradeNameAr("");
              setGradeNameEn("");
              setGradeSortOrder(String(data.grades.length + 1));
              setGradeIsActive(true);
              setGradeModalOpen(true);
            }}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            إضافة صف
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTrackEditId(undefined);
              setTrackGradeId(selectedGradeFilter);
              setTrackCode("");
              setTrackNameAr("");
              setTrackModalOpen(true);
            }}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            إضافة مسار
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSubjectEditId(undefined);
              setSubjectGradeId(selectedGradeFilter);
              setSubjectCode("");
              setSubjectNameAr("");
              setSubjectType("track_core");
              setSubjectModalOpen(true);
            }}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            إضافة مادة
          </Button>
        </div>
      </div>

      {/* Slide 7 Blueprint: Academic Matrix Table */}
      {activeTab === "matrix" && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
            <CardTitle className="text-base font-extrabold">
              مصفوفة ربط المواد بالمسارات ({formatArabicNumber(visibleSubjects.length)} مادة ×{" "}
              {formatArabicNumber(visibleTracks.length)} مسار)
            </CardTitle>
          </CardHeader>

          <div
            tabIndex={0}
            role="region"
            aria-label="مصفوفة المواد والمسارات"
            className="table-wrapper"
          >
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
                  <th className="sticky start-0 z-10 bg-[var(--bg-sunken)] px-4 py-3 text-start font-extrabold text-[var(--text-primary)]">
                    المادة الدراسية
                  </th>
                  {visibleTracks.map((track) => (
                    <th
                      key={track.id}
                      className="px-3 py-3 text-center font-extrabold text-[var(--text-primary)]"
                    >
                      {track.nameAr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {visibleSubjects.map((subject) => {
                  const typeMeta = resolveSubjectTypeMeta(subject.subjectType);
                  const isCommon = subject.subjectType === "common";
                  return (
                    <tr key={subject.id} className="hover:bg-[var(--bg-sunken)]/50">
                      <th className="sticky start-0 z-10 bg-[var(--bg-surface)] px-4 py-3 text-start">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[var(--text-primary)]">
                            {subject.nameAr}
                          </span>
                          <Badge variant={typeMeta.tone} size="sm">
                            {typeMeta.label}
                          </Badge>
                        </div>
                      </th>
                      {visibleTracks.map((track) => {
                        const assigned =
                          isCommon || assignedSet.has(`${track.id}:${subject.id}`);
                        const key = `${track.id}:${subject.id}`;
                        const busy = togglingKey === key;

                        return (
                          <td key={track.id} className="p-2.5 text-center">
                            <button
                              type="button"
                              disabled={isCommon || busy}
                              onClick={() =>
                                handleToggleAssignment(track.id, subject.id, assigned)
                              }
                              aria-label={`${subject.nameAr} في ${track.nameAr}`}
                              className={cn(
                                "mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer disabled:cursor-default",
                                assigned
                                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-xs"
                                  : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-transparent hover:border-[#2563EB]/50",
                                isCommon && "opacity-75"
                              )}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin text-current" />
                              ) : (
                                <Check className="h-4 w-4" />
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
        </Card>
      )}

      {activeTab === "subjects" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSubjects.map((s) => {
            const typeMeta = resolveSubjectTypeMeta(s.subjectType);
            return (
              <Card key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <Badge variant={typeMeta.tone}>{typeMeta.label}</Badge>
                  <p className="mt-1.5 text-base font-bold text-[var(--text-primary)]">
                    {s.nameAr}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="تعديل المادة"
                  onClick={() => {
                    setSubjectEditId(s.id);
                    setSubjectGradeId(s.gradeId);
                    setSubjectCode(s.code);
                    setSubjectNameAr(s.nameAr);
                    setSubjectType(s.subjectType as SubjectType);
                    setSubjectModalOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "tracks" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleTracks.map((t) => (
            <Card key={t.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <TrackIcon trackCode={t.code} />
                <div>
                  <p className="text-base font-bold text-[var(--text-primary)]">{t.nameAr}</p>
                  <Badge variant={t.isActive ? "success" : "neutral"} size="sm">
                    {t.isActive ? "مفعل" : "متوقف"}
                  </Badge>
                </div>
              </div>
              <Button
                size="icon"
                variant="outline"
                aria-label="تعديل المسار"
                onClick={() => {
                  setTrackEditId(t.id);
                  setTrackGradeId(t.gradeId);
                  setTrackCode(t.code);
                  setTrackNameAr(t.nameAr);
                  setTrackColorHex(t.colorHex);
                  setTrackModalOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "grades" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.grades.map((g) => (
            <Card key={g.id} className="flex items-center justify-between p-4">
              <div>
                <Badge variant={g.isActive ? "success" : "neutral"} size="sm">
                  {g.isActive ? "مفعل" : "متوقف"}
                </Badge>
                <p className="mt-1.5 text-base font-bold text-[var(--text-primary)]">
                  {g.nameAr}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedGradeFilter(g.id);
                  setActiveTab("matrix");
                }}
              >
                المصفوفة
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={gradeModalOpen} onOpenChange={setGradeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gradeEditId ? "تعديل الصف" : "إضافة صف دراسي"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveGrade} className="mt-4 flex flex-col gap-3">
            <Input
              label="اسم الصف بالعربية"
              required
              placeholder="مثال: الصف الثاني الإعدادي"
              value={gradeNameAr}
              onChange={(e) => setGradeNameAr(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="الكود"
                required
                dir="ltr"
                placeholder="PREP_2"
                value={gradeCode}
                onChange={(e) => setGradeCode(e.target.value)}
              />
              <Input
                label="الترتيب"
                type="number"
                dir="ltr"
                value={gradeSortOrder}
                onChange={(e) => setGradeSortOrder(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGradeModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={savingGrade}>
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={trackModalOpen} onOpenChange={setTrackModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{trackEditId ? "تعديل المسار" : "إضافة مسار أو شعبة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTrack} className="mt-4 flex flex-col gap-3">
            <Input
              label="اسم المسار / الشعبة"
              required
              placeholder="مثال: مسار الهندسة والتقنية"
              value={trackNameAr}
              onChange={(e) => setTrackNameAr(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="الكود"
                required
                dir="ltr"
                placeholder="ENG_TRACK"
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
              />
              <SelectInput
                label="الأيقونة"
                value={trackIconKey}
                onChange={(e) => setTrackIconKey(e.target.value)}
              >
                {TRACK_ICON_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="flex gap-2">
              {TRACK_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setTrackColorHex(hex)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 cursor-pointer",
                    trackColorHex === hex ? "border-white ring-2 ring-[#2563EB]" : "border-transparent"
                  )}
                  style={{ backgroundColor: hex }}
                  aria-label={`لون ${hex}`}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTrackModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={savingTrack}>
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectModalOpen} onOpenChange={setSubjectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subjectEditId ? "تعديل المادة" : "إضافة مادة دراسية"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSubject} className="mt-4 flex flex-col gap-3">
            <Input
              label="اسم المادة بالعربية"
              required
              placeholder="مثال: الفيزياء"
              value={subjectNameAr}
              onChange={(e) => setSubjectNameAr(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="كود المادة"
                required
                dir="ltr"
                placeholder="PHYSICS"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
              />
              <SelectInput
                label="التصنيف"
                value={subjectType}
                onChange={(e) => setSubjectType(e.target.value as SubjectType)}
              >
                <option value="common">مادة مشتركة</option>
                <option value="track_core">مادة تخصص</option>
                <option value="track_elective">لغة ثانية</option>
              </SelectInput>
            </div>
            {subjectType === "track_elective" && (
              <Input
                label="مجموعة الاختيار"
                dir="ltr"
                value={electiveGroupCode}
                onChange={(e) => setElectiveGroupCode(e.target.value)}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubjectModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={savingSubject}>
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
