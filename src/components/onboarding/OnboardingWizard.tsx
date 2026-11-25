"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Globe,
  Phone,
  School,
  UserCheck,
} from "lucide-react";
import { completeStudentOnboardingAction } from "@/application/auth/actions";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { SchoolCatalogBundle } from "@/infrastructure/supabase/catalog";
import { getTrackStyle, MOTION_SPRINGS } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface OnboardingWizardProps {
  readonly catalogs: readonly SchoolCatalogBundle[];
  readonly initialFullName?: string;
  readonly isAuthenticated: boolean;
}

const STEP_META = [
  { step: 1, title: "المدرسة والبيانات", pct: 33, pctLabel: "٣٣٪" },
  { step: 2, title: "اختيار المسار", pct: 66, pctLabel: "٦٦٪" },
  { step: 3, title: "تأكيد القيد", pct: 100, pctLabel: "١٠٠٪" },
] as const;

/**
 * Bassthalk-inspired 3-step Mobile-First Onboarding Wizard.
 * Features 52px thumb inputs, visual Baccalaureate track picker,
 * smooth AnimatePresence Second Language pill drawer, and 4 common core summary.
 */
export function OnboardingWizard({
  catalogs,
  initialFullName = "",
  isAuthenticated,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedSchoolId, setSelectedSchoolId] = React.useState<string>(
    catalogs[0]?.school.id ?? ""
  );
  const activeBundle =
    catalogs.find((b) => b.school.id === selectedSchoolId) ?? catalogs[0];

  const [selectedGradeId, setSelectedGradeId] = React.useState<string>(
    activeBundle?.grades[0]?.id ?? ""
  );
  const [fullName, setFullName] = React.useState<string>(initialFullName);
  const [phone, setPhone] = React.useState<string>("");
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>("");
  const [selectedElectiveSubjectId, setSelectedElectiveSubjectId] =
    React.useState<string>("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  const availableGrades = activeBundle?.grades ?? [];
  const availableTracks = React.useMemo(
    () =>
      (activeBundle?.tracks ?? []).filter(
        (t) => !selectedGradeId || t.grade_id === selectedGradeId
      ),
    [activeBundle, selectedGradeId]
  );

  const selectedTrack = availableTracks.find((t) => t.id === selectedTrackId) ?? null;

  const commonSubjects = React.useMemo(
    () =>
      (activeBundle?.subjects ?? []).filter(
        (s) =>
          s.subject_type === "common" &&
          (!selectedGradeId || s.grade_id === selectedGradeId)
      ),
    [activeBundle, selectedGradeId]
  );

  const getTrackSubjects = React.useCallback(
    (trackId: string) => {
      if (!activeBundle) {
        return { core: [], electives: [] };
      }
      const mapped = activeBundle.trackSubjects
        .filter((ts) => ts.track_id === trackId)
        .map((ts) => activeBundle.subjects.find((s) => s.id === ts.subject_id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

      return {
        core: mapped.filter((s) => s.subject_type === "track_core"),
        electives: mapped.filter((s) => s.subject_type === "track_elective"),
      };
    },
    [activeBundle]
  );

  const activeTrackSubjects = selectedTrackId
    ? getTrackSubjects(selectedTrackId)
    : { core: [], electives: [] };
  const requiresElective = activeTrackSubjects.electives.length > 0;
  const selectedElective =
    activeTrackSubjects.electives.find((s) => s.id === selectedElectiveSubjectId) ??
    null;

  const handleSchoolSelect = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    const nextBundle = catalogs.find((b) => b.school.id === schoolId);
    setSelectedGradeId(nextBundle?.grades[0]?.id ?? "");
    setSelectedTrackId("");
    setSelectedElectiveSubjectId("");
    setErrorMsg(null);
  };

  const handleTrackSelect = (trackId: string) => {
    setSelectedTrackId(trackId);
    const { electives } = getTrackSubjects(trackId);
    if (electives.length === 0) {
      setSelectedElectiveSubjectId("");
    } else if (!electives.some((e) => e.id === selectedElectiveSubjectId)) {
      setSelectedElectiveSubjectId("");
    }
    setErrorMsg(null);
  };

  const handleNextStep = () => {
    setErrorMsg(null);

    if (step === 1) {
      if (!selectedSchoolId || !selectedGradeId) {
        setErrorMsg("يرجى اختيار المدرسة والصف الدراسي.");
        return;
      }
      if (fullName.trim().length < 3) {
        setErrorMsg("يرجى إدخال البيان التعريفي للطالب (٣ أحرف على الأقل).");
        return;
      }
      if (!/^01[0125][0-9]{8}$/.test(phone.trim())) {
        setErrorMsg("يرجى إدخال رقم هاتف مصري صحيح يبدأ بـ 01 ومكون من ١١ رقماً.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedTrackId) {
        setErrorMsg("يرجى اختيار مسارك الدراسي أولاً.");
        return;
      }
      if (requiresElective && !selectedElectiveSubjectId) {
        setErrorMsg("يرجى اختيار اللغة الأجنبية الثانية لهذا المسار.");
        return;
      }
      setStep(3);
    }
  };

  const handleComplete = async () => {
    setErrorMsg(null);
    if (!activeBundle || !selectedGradeId || !selectedTrackId) {
      setErrorMsg("بيانات القيد غير مكتملة.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await completeStudentOnboardingAction({
        schoolId: activeBundle.school.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        gradeId: selectedGradeId,
        trackId: selectedTrackId,
        selectedElectiveSubjectId: requiresElective
          ? selectedElectiveSubjectId
          : null,
      });

      if (!result.ok) {
        setErrorMsg(result.error.message);
        toast({
          title: "تعذر إتمام القيد",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم تأكيد القيد الدراسي",
        description: "جاري توجيهك لبوابة حجز الحصص.",
        variant: "success",
      });
      router.push(`/s/${result.data.schoolSlug}/student`);
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ أثناء حفظ القيد الدراسي.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentMeta = STEP_META[step - 1]!;

  if (!activeBundle) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          لا توجد مدارس مفعلة حالياً في الدليل.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {!isAuthenticated && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200">
          <span>يلزم تسجيل الدخول لحفظ القيد الدراسي في حسابك.</span>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            تسجيل الدخول
          </Link>
        </div>
      )}

      {/* Zeigarnik 3-Step Progress Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="primary">الخطوة {step} من ٣</Badge>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {currentMeta.title}
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-[#1E3A8A] tabular-nums dark:text-blue-400">
            {currentMeta.pctLabel}
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-md bg-[var(--bg-sunken)]">
          <motion.div
            className="h-full rounded-md bg-[#1E3A8A] dark:bg-blue-500"
            initial={false}
            animate={{ width: `${currentMeta.pct}%` }}
            transition={MOTION_SPRINGS.snappy}
          />
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">
            {step === 1 && "بيانات المدرسة والطالب"}
            {step === 2 && "اختر مسارك الدراسي"}
            {step === 3 && "ملخص القيد والمواد المشتركة"}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={MOTION_SPRINGS.subtle}
                className="flex flex-col gap-4"
              >
                {/* School Selection */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                    اختر المدرسة
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {catalogs.map((bundle) => {
                      const active = bundle.school.id === activeBundle.school.id;
                      return (
                        <button
                          key={bundle.school.id}
                          type="button"
                          onClick={() => handleSchoolSelect(bundle.school.id)}
                          className={cn(
                            "flex min-h-[60px] items-center justify-between gap-3 rounded-xl border p-3 text-start transition-colors cursor-pointer",
                            active
                              ? "border-[#1E3A8A] bg-blue-50/60 dark:border-blue-500 dark:bg-blue-500/15"
                              : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                bundle.school.logo_url ||
                                "/tenants/ali-bin-abi-talib/logo.svg"
                              }
                              alt={bundle.school.name_ar}
                              className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1 object-contain"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                                {bundle.school.name_ar}
                              </p>
                              <p className="truncate text-xs text-[var(--text-muted)]">
                                {bundle.school.governorate} · {bundle.school.directorate}
                              </p>
                            </div>
                          </div>
                          {active && (
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1E3A8A] text-white dark:bg-blue-500">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <SelectInput
                  label="الصف الدراسي"
                  inputSize="lg"
                  value={selectedGradeId}
                  onChange={(e) => {
                    setSelectedGradeId(e.target.value);
                    setSelectedTrackId("");
                    setSelectedElectiveSubjectId("");
                  }}
                >
                  {availableGrades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name_ar}
                    </option>
                  ))}
                </SelectInput>

                <Input
                  label="الاسم أو الرمز التعريفي للطالب"
                  inputSize="lg"
                  required
                  placeholder="مثال: طالب ٢ بكالوريا — كود S-205"
                  hint="اكتب البيان التعريفي للطالب كما في سجل المدرسة"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  startAdornment={<UserCheck className="h-4 w-4" />}
                />

                <Input
                  label="رقم الهاتف المحمول"
                  type="tel"
                  inputMode="tel"
                  inputSize="lg"
                  dir="ltr"
                  required
                  placeholder="01012345678"
                  hint="رقم الطالب المصري (١١ رقماً يبدأ بـ 01)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  startAdornment={<Phone className="h-4 w-4" />}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={MOTION_SPRINGS.subtle}
                className="flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableTracks.map((track) => {
                    const active = track.id === selectedTrackId;
                    const style = getTrackStyle(track.code);
                    const { core, electives } = getTrackSubjects(track.id);

                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => handleTrackSelect(track.id)}
                        className={cn(
                          "flex flex-col items-start justify-between gap-3 rounded-xl border p-4 text-start transition-colors cursor-pointer",
                          active
                            ? cn(
                                "bg-[var(--bg-sunken)]",
                                style.activeBorderClass
                              )
                            : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <TrackIcon
                            trackCode={track.code}
                            iconKey={track.icon_key}
                            size="md"
                          />
                          {active && (
                            <Badge variant="primary" size="sm">
                              محدد
                            </Badge>
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {track.name_ar}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {core.map((subj) => (
                              <span
                                key={subj.id}
                                className={cn(
                                  "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                  style.badgeClass
                                )}
                              >
                                {subj.name_ar}
                              </span>
                            ))}
                            {electives.length > 0 && (
                              <span className="rounded-md border border-dashed border-[var(--border-strong)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                                + لغة ثانية
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Smooth AnimatePresence Second Language Pill Drawer */}
                <AnimatePresence initial={false}>
                  {requiresElective && (
                    <motion.div
                      key="elective-drawer"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={MOTION_SPRINGS.drawer}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-violet-300 bg-violet-50/60 p-4 dark:border-violet-500/35 dark:bg-violet-500/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-violet-900 dark:text-violet-200">
                            <Globe className="h-4 w-4" />
                            <span>اختر اللغة الأجنبية الثانية</span>
                          </div>
                          <Badge variant="mono" dir="ltr">
                            SECOND_LANG
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {activeTrackSubjects.electives.map((lang) => {
                            const selected = lang.id === selectedElectiveSubjectId;
                            return (
                              <button
                                key={lang.id}
                                type="button"
                                onClick={() => setSelectedElectiveSubjectId(lang.id)}
                                className={cn(
                                  "flex min-h-[48px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors cursor-pointer",
                                  selected
                                    ? "border-violet-700 bg-violet-700 text-white dark:border-violet-500 dark:bg-violet-600"
                                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-violet-400"
                                )}
                              >
                                {selected && <Check className="h-4 w-4 shrink-0" />}
                                <span>{lang.name_ar}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={MOTION_SPRINGS.subtle}
                className="flex flex-col gap-4"
              >
                {/* Enrollment Overview */}
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
                    <div className="flex items-center gap-2.5">
                      <School className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {activeBundle.school.name_ar}
                      </span>
                    </div>
                    <Badge variant="mono" dir="ltr">
                      2026-2027
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-[var(--text-muted)]">البيان التعريفي</span>
                      <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                        {fullName}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">رقم الهاتف</span>
                      <p
                        className="mt-0.5 font-mono font-semibold text-[var(--text-primary)]"
                        dir="ltr"
                      >
                        {phone}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">المسار المختار</span>
                      <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                        {selectedTrack?.name_ar}
                      </p>
                    </div>
                    {selectedElective && (
                      <div>
                        <span className="text-[var(--text-muted)]">اللغة الثانية</span>
                        <p className="mt-0.5 font-semibold text-violet-700 dark:text-violet-300">
                          {selectedElective.name_ar}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 Common Core Pills Summary */}
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>المواد المشتركة المفعلة (٤ مواد)</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {commonSubjects.map((subj) => (
                      <Badge key={subj.id} variant="primary" size="md">
                        {subj.name_ar}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Wizard Action Bar */}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-4">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setErrorMsg(null);
                  setStep((prev) => (prev === 3 ? 2 : 1));
                }}
                leftIcon={<ArrowRight className="h-4 w-4" />}
                className="h-[50px]"
              >
                السابق
              </Button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleNextStep}
                rightIcon={<ArrowLeft className="h-4 w-4" />}
                className="h-[50px] min-w-[140px]"
              >
                التالي
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={!isAuthenticated || submitting}
                onClick={handleComplete}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                className="h-[52px] min-w-[170px]"
              >
                تأكيد القيد
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
