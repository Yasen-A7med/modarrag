import { z } from "zod";

export const GRADE_CODES = {
  SEC_2_BACC: "SEC_2_BACC",
} as const;

export const TRACK_CODES = {
  ENGINEERING: "ENGINEERING",
  MEDICINE_LIFE: "MEDICINE_LIFE",
  BUSINESS: "BUSINESS",
  ARTS_HUMANITIES: "ARTS_HUMANITIES",
} as const;

export const ELECTIVE_GROUPS = {
  SECOND_LANG: "SECOND_LANG",
} as const;

export const SubjectCategorySchema = z.enum(["COMMON", "TRACK_CORE", "TRACK_ELECTIVE"]);
export type SubjectCategory = z.infer<typeof SubjectCategorySchema>;

export const GradeCodeSchema = z.string().min(2).max(32);
export const TrackCodeSchema = z.string().min(2).max(32);
export const ElectiveGroupSchema = z.string().min(1).max(32).nullable();

export const AcademicGradeSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  code: GradeCodeSchema,
  nameAr: z.string().min(1),
  nameEn: z.string().min(1).optional(),
  isActive: z.boolean().default(true),
});
export type AcademicGrade = z.infer<typeof AcademicGradeSchema>;

export const AcademicTrackSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  gradeId: z.string().uuid(),
  code: TrackCodeSchema,
  nameAr: z.string().min(1),
  nameEn: z.string().min(1).optional(),
  isActive: z.boolean().default(true),
});
export type AcademicTrack = z.infer<typeof AcademicTrackSchema>;

export const SubjectSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  gradeId: z.string().uuid(),
  code: z.string().min(2).max(40),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1).optional(),
  category: SubjectCategorySchema,
  isActive: z.boolean().default(true),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const TrackSubjectRuleSchema = z
  .object({
    schoolId: z.string().uuid(),
    gradeId: z.string().uuid(),
    trackId: z.string().uuid(),
    subjectId: z.string().uuid(),
    isElective: z.boolean().default(false),
    electiveGroup: ElectiveGroupSchema.default(null),
  })
  .refine((rule) => !rule.isElective || rule.electiveGroup !== null, {
    message: "Elective track subject rules must specify an electiveGroup",
    path: ["electiveGroup"],
  });
export type TrackSubjectRule = z.infer<typeof TrackSubjectRuleSchema>;

export const StudentEnrollmentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  gradeId: z.string().uuid(),
  trackId: z.string().uuid(),
  secondLanguageSubjectId: z.string().uuid().nullable().optional(),
  selectedElectives: z.record(z.string().min(1), z.string().uuid()).default({}),
  isActive: z.boolean().default(true),
});
export type StudentEnrollment = z.infer<typeof StudentEnrollmentSchema>;
