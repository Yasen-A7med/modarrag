export type EducationStageKey =
  | "primary"
  | "preparatory"
  | "secondary_general"
  | "baccalaureate";

export interface K12StageMeta {
  readonly key: EducationStageKey;
  readonly labelAr: string;
  readonly shortLabelAr: string;
}

export const EDUCATION_STAGES: readonly K12StageMeta[] = [
  { key: "baccalaureate", labelAr: "البكالوريا المصرية (الثاني الثانوي)", shortLabelAr: "البكالوريا" },
  { key: "secondary_general", labelAr: "المرحلة الثانوية (الأول والثالث)", shortLabelAr: "الثانوية" },
  { key: "preparatory", labelAr: "المرحلة الإعدادية (١–٣ إعدادي)", shortLabelAr: "الإعدادية" },
  { key: "primary", labelAr: "المرحلة الابتدائية (١–٦ ابتدائي)", shortLabelAr: "الابتدائية" },
] as const;

export interface K12GradeTemplate {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly sortOrder: number;
  readonly stage: EducationStageKey;
  readonly defaultTrackNameAr: string;
  readonly defaultTrackCode: string;
  readonly coreSubjects: readonly { readonly code: string; readonly nameAr: string }[];
}

export const EGYPT_K12_EXTRA_GRADES: readonly K12GradeTemplate[] = [
  {
    code: "PRIM_1",
    nameAr: "الصف الأول الابتدائي",
    nameEn: "Primary 1",
    sortOrder: 1,
    stage: "primary",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الابتدائي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PRIM_2",
    nameAr: "الصف الثاني الابتدائي",
    nameEn: "Primary 2",
    sortOrder: 2,
    stage: "primary",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الابتدائي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PRIM_3",
    nameAr: "الصف الثالث الابتدائي",
    nameEn: "Primary 3",
    sortOrder: 3,
    stage: "primary",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الابتدائي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PRIM_4",
    nameAr: "الصف الرابع الابتدائي",
    nameEn: "Primary 4",
    sortOrder: 4,
    stage: "primary",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الابتدائي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "SCIENCE", nameAr: "العلوم" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PRIM_5",
    nameAr: "الصف الخامس الابتدائي",
    nameEn: "Primary 5",
    sortOrder: 5,
    stage: "primary",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الابتدائي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "SCIENCE", nameAr: "العلوم" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PRIM_6",
    nameAr: "الصف السادس الابتدائي",
    nameEn: "Primary 6",
    sortOrder: 6,
    stage: "primary",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الابتدائي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "SCIENCE", nameAr: "العلوم" },
      { code: "SOCIAL", nameAr: "الدراسات الاجتماعية" },
    ],
  },
  {
    code: "PREP_1",
    nameAr: "الصف الأول الإعدادي",
    nameEn: "Preparatory 1",
    sortOrder: 7,
    stage: "preparatory",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الإعدادي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "SCIENCE", nameAr: "العلوم" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PREP_2",
    nameAr: "الصف الثاني الإعدادي",
    nameEn: "Preparatory 2",
    sortOrder: 8,
    stage: "preparatory",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "المسار العام الإعدادي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "SCIENCE", nameAr: "العلوم" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "PREP_3",
    nameAr: "الصف الثالث الإعدادي (الشهادة الإعدادية)",
    nameEn: "Preparatory 3",
    sortOrder: 9,
    stage: "preparatory",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "الشهادة الإعدادية — عام",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "SCIENCE", nameAr: "العلوم" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
      { code: "SOCIAL", nameAr: "الدراسات الاجتماعية" },
    ],
  },
  {
    code: "SEC_1",
    nameAr: "الصف الأول الثانوي",
    nameEn: "Secondary 1",
    sortOrder: 10,
    stage: "secondary_general",
    defaultTrackCode: "GENERAL_TRACK",
    defaultTrackNameAr: "الشعبة العامة — أولى ثانوي",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "MATH", nameAr: "الرياضيات" },
      { code: "PHYSICS", nameAr: "الفيزياء" },
      { code: "CHEMISTRY", nameAr: "الكيمياء" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
  {
    code: "SEC_3_GEN",
    nameAr: "الصف الثالث الثانوي (الثانوية العامة)",
    nameEn: "Secondary 3",
    sortOrder: 12,
    stage: "secondary_general",
    defaultTrackCode: "SCI_MATH",
    defaultTrackNameAr: "علمي رياضة",
    coreSubjects: [
      { code: "ARABIC", nameAr: "اللغة العربية" },
      { code: "PHYSICS", nameAr: "الفيزياء" },
      { code: "CHEMISTRY", nameAr: "الكيمياء" },
      { code: "ENGLISH", nameAr: "اللغة الإنجليزية" },
    ],
  },
] as const;

export function classifyGradeStage(code: string): EducationStageKey {
  const upper = code.toUpperCase();
  if (upper.startsWith("PRIM_")) return "primary";
  if (upper.startsWith("PREP_")) return "preparatory";
  if (upper.includes("BACC") || upper === "SEC_2_BACC") return "baccalaureate";
  return "secondary_general";
}

export function pickPreferredDefaultGradeId<
  T extends { readonly id: string; readonly code: string }
>(grades: readonly T[]): string {
  return (
    grades.find((g) => g.code === "SEC_2_BACC")?.id ??
    grades[0]?.id ??
    ""
  );
}
