import { describe, expect, it } from "vitest";
import {
  evaluateCatalogEligibility,
  evaluateStudentSubjectEligibility,
  getEligibleSubjectIds,
} from "@/domain/academic/eligibility";
import {
  ELECTIVE_GROUPS,
  GRADE_CODES,
  TRACK_CODES,
  type AcademicTrack,
  type StudentEnrollment,
  type Subject,
  type TrackSubjectRule,
} from "@/domain/academic/schemas";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SCHOOL_ID = "22222222-2222-4222-8222-222222222222";
const GRADE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_GRADE_ID = "44444444-4444-4444-8444-444444444444";

const TRACK_IDS = {
  ENGINEERING: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  MEDICINE_LIFE: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  BUSINESS: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  ARTS_HUMANITIES: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
} as const;

const TRACKS: Record<keyof typeof TRACK_IDS, AcademicTrack> = {
  ENGINEERING: {
    id: TRACK_IDS.ENGINEERING,
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: TRACK_CODES.ENGINEERING,
    nameAr: "مسار الهندسة",
    isActive: true,
  },
  MEDICINE_LIFE: {
    id: TRACK_IDS.MEDICINE_LIFE,
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: TRACK_CODES.MEDICINE_LIFE,
    nameAr: "مسار طب وعلوم الحياة",
    isActive: true,
  },
  BUSINESS: {
    id: TRACK_IDS.BUSINESS,
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: TRACK_CODES.BUSINESS,
    nameAr: "مسار الأعمال",
    isActive: true,
  },
  ARTS_HUMANITIES: {
    id: TRACK_IDS.ARTS_HUMANITIES,
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: TRACK_CODES.ARTS_HUMANITIES,
    nameAr: "مسار الآداب والفنون",
    isActive: true,
  },
};

const SUBJECTS = {
  arabic: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "ARABIC",
    nameAr: "اللغة العربية",
    category: "COMMON",
    isActive: true,
  },
  english: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "ENGLISH",
    nameAr: "اللغة الإنجليزية",
    category: "COMMON",
    isActive: true,
  },
  history: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "HISTORY",
    nameAr: "التاريخ",
    category: "COMMON",
    isActive: true,
  },
  financialLiteracy: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "FIN_LIT",
    nameAr: "الثقافة المالية",
    category: "COMMON",
    isActive: true,
  },
  programming: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb05",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "PROGRAMMING",
    nameAr: "البرمجة",
    category: "TRACK_CORE",
    isActive: true,
  },
  chemistry: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb06",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "CHEMISTRY",
    nameAr: "الكيمياء",
    category: "TRACK_CORE",
    isActive: true,
  },
  mathematics: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb07",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "MATH",
    nameAr: "الرياضيات",
    category: "TRACK_CORE",
    isActive: true,
  },
  physics: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb08",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "PHYSICS",
    nameAr: "الفيزياء",
    category: "TRACK_CORE",
    isActive: true,
  },
  psychology: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb09",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "PSYCHOLOGY",
    nameAr: "علم النفس",
    category: "TRACK_CORE",
    isActive: true,
  },
  italian: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "LANG_IT",
    nameAr: "اللغة الإيطالية",
    category: "TRACK_ELECTIVE",
    isActive: true,
  },
  french: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "LANG_FR",
    nameAr: "اللغة الفرنسية",
    category: "TRACK_ELECTIVE",
    isActive: true,
  },
  german: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12",
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    code: "LANG_DE",
    nameAr: "اللغة الألمانية",
    category: "TRACK_ELECTIVE",
    isActive: true,
  },
} satisfies Record<string, Subject>;

const RULES: readonly TrackSubjectRule[] = [
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ENGINEERING,
    subjectId: SUBJECTS.programming.id,
    isElective: false,
    electiveGroup: null,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ENGINEERING,
    subjectId: SUBJECTS.chemistry.id,
    isElective: false,
    electiveGroup: null,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.MEDICINE_LIFE,
    subjectId: SUBJECTS.mathematics.id,
    isElective: false,
    electiveGroup: null,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.MEDICINE_LIFE,
    subjectId: SUBJECTS.physics.id,
    isElective: false,
    electiveGroup: null,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ARTS_HUMANITIES,
    subjectId: SUBJECTS.psychology.id,
    isElective: false,
    electiveGroup: null,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ARTS_HUMANITIES,
    subjectId: SUBJECTS.italian.id,
    isElective: true,
    electiveGroup: ELECTIVE_GROUPS.SECOND_LANG,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ARTS_HUMANITIES,
    subjectId: SUBJECTS.french.id,
    isElective: true,
    electiveGroup: ELECTIVE_GROUPS.SECOND_LANG,
  },
  {
    schoolId: SCHOOL_ID,
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ARTS_HUMANITIES,
    subjectId: SUBJECTS.german.id,
    isElective: true,
    electiveGroup: ELECTIVE_GROUPS.SECOND_LANG,
  },
];

function makeEnrollment(overrides: Partial<StudentEnrollment> = {}): StudentEnrollment {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    schoolId: SCHOOL_ID,
    studentId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    gradeId: GRADE_ID,
    trackId: TRACK_IDS.ENGINEERING,
    secondLanguageSubjectId: null,
    selectedElectives: {},
    isActive: true,
    ...overrides,
  };
}

describe("evaluateStudentSubjectEligibility", () => {
  it("allows common subjects across all academic tracks in SEC_2_BACC", () => {
    expect(GRADE_CODES.SEC_2_BACC).toBe("SEC_2_BACC");

    for (const trackKey of Object.keys(TRACK_IDS) as Array<keyof typeof TRACK_IDS>) {
      const enrollment = makeEnrollment({ trackId: TRACK_IDS[trackKey] });
      const decision = evaluateStudentSubjectEligibility({
        enrollment,
        subject: SUBJECTS.arabic,
        trackSubjectRules: RULES,
        track: TRACKS[trackKey],
      });

      expect(decision.eligible).toBe(true);
      expect(decision.reasonCode).toBe("COMMON_SUBJECT_ELIGIBLE");
    }
  });

  it("allows track-core subjects for matching track and denies other tracks", () => {
    const engineeringStudent = makeEnrollment({ trackId: TRACK_IDS.ENGINEERING });
    const medicineStudent = makeEnrollment({ trackId: TRACK_IDS.MEDICINE_LIFE });

    const engProg = evaluateStudentSubjectEligibility({
      enrollment: engineeringStudent,
      subject: SUBJECTS.programming,
      trackSubjectRules: RULES,
      track: TRACKS.ENGINEERING,
    });
    expect(engProg.eligible).toBe(true);
    expect(engProg.reasonCode).toBe("TRACK_CORE_ELIGIBLE");

    const medProg = evaluateStudentSubjectEligibility({
      enrollment: medicineStudent,
      subject: SUBJECTS.programming,
      trackSubjectRules: RULES,
      track: TRACKS.MEDICINE_LIFE,
    });
    expect(medProg.eligible).toBe(false);
    expect(medProg.reasonCode).toBe("TRACK_SUBJECT_NOT_ALLOWED");
  });

  it("enforces SECOND_LANG elective matching for Arts & Humanities students", () => {
    const artsStudentItalian = makeEnrollment({
      trackId: TRACK_IDS.ARTS_HUMANITIES,
      selectedElectives: { [ELECTIVE_GROUPS.SECOND_LANG]: SUBJECTS.italian.id },
    });

    const italianDecision = evaluateStudentSubjectEligibility({
      enrollment: artsStudentItalian,
      subject: SUBJECTS.italian,
      trackSubjectRules: RULES,
      track: TRACKS.ARTS_HUMANITIES,
    });
    expect(italianDecision.eligible).toBe(true);
    expect(italianDecision.reasonCode).toBe("TRACK_ELECTIVE_ELIGIBLE");

    const frenchDecision = evaluateStudentSubjectEligibility({
      enrollment: artsStudentItalian,
      subject: SUBJECTS.french,
      trackSubjectRules: RULES,
      track: TRACKS.ARTS_HUMANITIES,
    });
    expect(frenchDecision.eligible).toBe(false);
    expect(frenchDecision.reasonCode).toBe("ELECTIVE_MISMATCH");

    const artsStudentUnselected = makeEnrollment({
      trackId: TRACK_IDS.ARTS_HUMANITIES,
      selectedElectives: {},
    });
    const noSelectionDecision = evaluateStudentSubjectEligibility({
      enrollment: artsStudentUnselected,
      subject: SUBJECTS.german,
      trackSubjectRules: RULES,
      track: TRACKS.ARTS_HUMANITIES,
    });
    expect(noSelectionDecision.eligible).toBe(false);
    expect(noSelectionDecision.reasonCode).toBe("ELECTIVE_NOT_SELECTED");
  });

  it("supports legacy secondLanguageSubjectId fallback on StudentEnrollment", () => {
    const artsStudent = makeEnrollment({
      trackId: TRACK_IDS.ARTS_HUMANITIES,
      secondLanguageSubjectId: SUBJECTS.german.id,
      selectedElectives: {},
    });

    const decision = evaluateStudentSubjectEligibility({
      enrollment: artsStudent,
      subject: SUBJECTS.german,
      trackSubjectRules: RULES,
      track: TRACKS.ARTS_HUMANITIES,
    });

    expect(decision.eligible).toBe(true);
    expect(decision.reasonCode).toBe("TRACK_ELECTIVE_ELIGIBLE");
  });

  it("denies inactive enrollments, inactive subjects, cross-school, and cross-grade access", () => {
    const inactiveEnrollment = makeEnrollment({ isActive: false });
    expect(
      evaluateStudentSubjectEligibility({
        enrollment: inactiveEnrollment,
        subject: SUBJECTS.arabic,
        trackSubjectRules: RULES,
      }).reasonCode
    ).toBe("ENROLLMENT_INACTIVE");

    const inactiveSubject: Subject = { ...SUBJECTS.arabic, isActive: false };
    expect(
      evaluateStudentSubjectEligibility({
        enrollment: makeEnrollment(),
        subject: inactiveSubject,
        trackSubjectRules: RULES,
      }).reasonCode
    ).toBe("SUBJECT_INACTIVE");

    const otherSchoolSubject: Subject = { ...SUBJECTS.arabic, schoolId: OTHER_SCHOOL_ID };
    expect(
      evaluateStudentSubjectEligibility({
        enrollment: makeEnrollment(),
        subject: otherSchoolSubject,
        trackSubjectRules: RULES,
      }).reasonCode
    ).toBe("TENANT_MISMATCH");

    const otherGradeSubject: Subject = { ...SUBJECTS.arabic, gradeId: OTHER_GRADE_ID };
    expect(
      evaluateStudentSubjectEligibility({
        enrollment: makeEnrollment(),
        subject: otherGradeSubject,
        trackSubjectRules: RULES,
      }).reasonCode
    ).toBe("GRADE_MISMATCH");
  });

  it("filters full subject catalog accurately for an Arts & Humanities student", () => {
    const artsStudent = makeEnrollment({
      trackId: TRACK_IDS.ARTS_HUMANITIES,
      selectedElectives: { [ELECTIVE_GROUPS.SECOND_LANG]: SUBJECTS.french.id },
    });

    const catalog = Object.values(SUBJECTS);
    const eligibleIds = getEligibleSubjectIds({
      enrollment: artsStudent,
      subjects: catalog,
      trackSubjectRules: RULES,
      track: TRACKS.ARTS_HUMANITIES,
    });

    expect(eligibleIds).toEqual([
      SUBJECTS.arabic.id,
      SUBJECTS.english.id,
      SUBJECTS.history.id,
      SUBJECTS.financialLiteracy.id,
      SUBJECTS.psychology.id,
      SUBJECTS.french.id,
    ]);

    const fullEval = evaluateCatalogEligibility({
      enrollment: artsStudent,
      subjects: catalog,
      trackSubjectRules: RULES,
    });
    expect(fullEval).toHaveLength(catalog.length);
  });
});
