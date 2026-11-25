"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Phone,
  School,
  UserCheck,
} from "lucide-react";
import { completeStudentOnboardingAction } from "@/application/auth/actions";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import {
  MotionMetricBar,
  MotionReveal,
  SPRING_EASE,
  TACTILE_SPRING,
} from "@/components/motion/MotionPrimitives";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { SchoolCatalogBundle } from "@/infrastructure/supabase/catalog";
import { cn } from "@/lib/utils";

export interface OnboardingWizardProps {
  readonly catalogs: readonly SchoolCatalogBundle[];
  readonly initialFullName?: string;
  readonly isAuthenticated: boolean;
}

/**
 * Dead-simple 2-step onboarding: (1) Student Name + Phone + School, (2) Baccalaureate Track.
 */
export function OnboardingWizard({
  catalogs,
  initialFullName = "",
  isAuthenticated,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2>(1);
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
    if (electives.length === 0 || !electives.some((e) => e.id === selectedElectiveSubjectId)) {
      setSelectedElectiveSubjectId("");
    }
    setErrorMsg(null);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (!selectedSchoolId || !selectedGradeId) {
      setErrorMsg("يرجى اختيار المدرسة والصف الدراسي.");
      return;
    }
    if (fullName.trim().length < 3) {
      setErrorMsg("يرجى كتابة اسمك الكامل (٣ أحرف على الأقل).");
      return;
    }
    if (!/^01[0125][0-9]{8}$/.test(phone.trim())) {
      setErrorMsg("يرجى كتابة رقم موبايل صحيح من ١١ رقماً يبدأ بـ 01.");
      return;
    }
    setStep(2);
  };

  const handleComplete = async () => {
    setErrorMsg(null);
    if (!activeBundle || !selectedGradeId || !selectedTrackId) {
      setErrorMsg("يرجى اختيار مسارك الدراسي أولاً.");
      return;
    }
    if (requiresElective && !selectedElectiveSubjectId) {
      setErrorMsg("يرجى اختيار اللغة الأجنبية الثانية.");
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
          title: "تعذر حفظ البيانات",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم حفظ مسارك بنجاح",
        description: "جاري فتح صفحة الحصص المتاحة لك.",
        variant: "success",
      });
      router.push(`/s/${result.data.schoolSlug}/student`);
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مجدداً.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <MotionReveal>
        <Card className="mx-auto max-w-lg rounded-3xl text-center">
          <CardHeader className="items-center">
            <div className="art-pedestal mb-2 h-24 w-24 overflow-hidden rounded-2xl p-1.5">
              <Image
                src="/images/step-school-3d.webp"
                alt="اختيار المدرسة والمسار الدراسي"
                width={96}
                height={96}
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <CardTitle className="text-2xl">سجّل دخولك أولاً لتحديد مسارك</CardTitle>
            <p className="text-base text-[var(--text-secondary)]">
              يلزم الدخول بحساب الطالب أو إنشاء حساب جديد قبل اختيار المسار الدراسي.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/login" className={buttonVariants({ variant: "emerald", size: "lg" })}>
              تسجيل الدخول
            </Link>
            <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg" })}>
              حساب طالب جديد
            </Link>
          </CardContent>
        </Card>
      </MotionReveal>
    );
  }

  return (
    <MotionReveal className="flex flex-col gap-5">
      {/* Animated 2-Step Progress Header */}
      <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift">
        <div className="flex items-center justify-between gap-2 text-base font-bold">
          <span>
            {step === 1 ? "الخطوة ١ من ٢: بياناتك والمدرسة" : "الخطوة ٢ من ٢: اختر مسارك الدراسي"}
          </span>
          <span className="text-[#0B63CE] dark:text-blue-400 tabular-nums">
            {step === 1 ? "50%" : "100%"}
          </span>
        </div>
        <MotionMetricBar
          percentage={step === 1 ? 50 : 100}
          trackClassName="mt-3 h-2.5"
          barClassName="bg-gradient-to-l from-[#254EDB] to-[#16A34A]"
        />
      </div>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3.5 text-base font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <motion.div
            key="onboarding-step-1"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28, ease: SPRING_EASE }}
          >
            <Card className="rounded-3xl">
              <CardHeader>
                <div className="flex items-center gap-3.5">
                  <div className="art-pedestal h-16 w-16 shrink-0 overflow-hidden rounded-2xl p-1">
                    <Image
                      src="/images/step-school-3d.webp"
                      alt="بيانات الطالب والمدرسة"
                      width={64}
                      height={64}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-xl">أدخل اسمك ورقم موبايلك</CardTitle>
                    <p className="mt-1 text-base text-[var(--text-secondary)]">
                      سيظهر اسمك في كشف الحضور لدى معلمي المدرسة
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-5">
                {catalogs.length > 1 ? (
                  <SelectInput
                    label="المدرسة"
                    inputSize="lg"
                    value={selectedSchoolId}
                    onChange={(e) => handleSchoolSelect(e.target.value)}
                  >
                    {catalogs.map((bundle) => (
                      <option key={bundle.school.id} value={bundle.school.id}>
                        {bundle.school.name_ar} — {bundle.school.governorate}
                      </option>
                    ))}
                  </SelectInput>
                ) : activeBundle ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4">
                    <School className="h-6 w-6 shrink-0 text-[#0B63CE] dark:text-blue-400" />
                    <div>
                      <p className="text-base font-bold text-[var(--text-primary)]">
                        {activeBundle.school.name_ar}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {activeBundle.school.governorate} — {activeBundle.school.directorate}
                      </p>
                    </div>
                  </div>
                ) : null}

                {availableGrades.length > 1 && (
                  <SelectInput
                    label="الصف الدراسي"
                    inputSize="lg"
                    value={selectedGradeId}
                    onChange={(e) => {
                      setSelectedGradeId(e.target.value);
                      setSelectedTrackId("");
                    }}
                  >
                    {availableGrades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name_ar}
                      </option>
                    ))}
                  </SelectInput>
                )}

                <Input
                  label="اسمك الكامل"
                  inputSize="lg"
                  required
                  minLength={3}
                  placeholder="اكتب اسمك الثلاثي بوضوح"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  startAdornment={<UserCheck className="h-5 w-5" />}
                />

                <Input
                  label="رقم الموبايل"
                  type="tel"
                  inputSize="lg"
                  required
                  dir="ltr"
                  placeholder="01000000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  startAdornment={<Phone className="h-5 w-5" />}
                />

                <Button
                  variant="emerald"
                  size="lg"
                  fullWidth
                  onClick={handleNextStep}
                  rightIcon={<ArrowLeft className="h-5 w-5" />}
                >
                  التالي: اختيار المسار الدراسي
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="onboarding-step-2"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.28, ease: SPRING_EASE }}
          >
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl">اختر مسارك في البكالوريا</CardTitle>
                <p className="text-base text-[var(--text-secondary)]">
                  ستُفتح لك تلقائياً حصص المواد المشتركة مع مواد المسار الذي تختاره
                </p>
              </CardHeader>

              <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableTracks.map((track) => {
                    const selected = selectedTrackId === track.id;
                    const subs = getTrackSubjects(track.id);

                    return (
                      <motion.button
                        key={track.id}
                        type="button"
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTrackSelect(track.id)}
                        className={cn(
                          "group flex flex-col items-start rounded-3xl border p-4 text-start transition-colors cursor-pointer",
                          selected
                            ? "border-[#0B63CE] bg-[#EEF5FF]/75 ring-2 ring-[#0B63CE]/20 shadow-sm dark:border-blue-400 dark:bg-blue-500/18"
                            : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <TrackArtwork
                            trackCode={track.code}
                            iconKey={track.icon_key}
                            size="md"
                          />
                          {selected && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={TACTILE_SPRING}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0B63CE] text-white shadow-xs"
                            >
                              <Check className="h-4 w-4" />
                            </motion.span>
                          )}
                        </div>

                        <p className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                          {track.name_ar}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {subs.core.map((s) => s.name_ar).join(" · ")}
                          {subs.electives.length > 0 ? " + لغة ثانية" : ""}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>

                {requiresElective && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-amber-200 bg-amber-50/75 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
                  >
                    <p className="mb-3 text-base font-bold text-[var(--text-primary)]">
                      اختر اللغة الأجنبية الثانية:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {activeTrackSubjects.electives.map((lang) => {
                        const active = selectedElectiveSubjectId === lang.id;
                        return (
                          <button
                            key={lang.id}
                            type="button"
                            onClick={() => setSelectedElectiveSubjectId(lang.id)}
                            className={cn(
                              "min-h-[48px] rounded-xl border px-4 text-base font-semibold transition-all active:scale-[0.98] cursor-pointer",
                              active
                                ? "border-[#16A34A] bg-[#16A34A] text-white shadow-xs"
                                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                            )}
                          >
                            {lang.name_ar}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {commonSubjects.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4">
                    <p className="mb-2 text-sm font-bold text-[var(--text-primary)]">
                      المواد المشتركة المضافة تلقائياً:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {commonSubjects.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1 text-sm font-medium text-[var(--text-primary)]"
                        >
                          {s.name_ar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setStep(1);
                      setErrorMsg(null);
                    }}
                    leftIcon={<ArrowRight className="h-5 w-5" />}
                  >
                    رجوع للبيانات
                  </Button>

                  <Button
                    variant="emerald"
                    size="lg"
                    loading={submitting}
                    onClick={handleComplete}
                    rightIcon={<CheckCircle2 className="h-5 w-5" />}
                  >
                    حفظ وفتح صفحة الحجز
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionReveal>
  );
}
