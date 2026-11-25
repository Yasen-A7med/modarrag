import {
  ELECTIVE_GROUPS,
  type AcademicTrack,
  type StudentEnrollment,
  type Subject,
  type TrackSubjectRule,
} from "./schemas";

export type EligibilityReasonCode =
  | "COMMON_SUBJECT_ELIGIBLE"
  | "TRACK_CORE_ELIGIBLE"
  | "TRACK_ELECTIVE_ELIGIBLE"
  | "ENROLLMENT_INACTIVE"
  | "SUBJECT_INACTIVE"
  | "TRACK_INACTIVE"
  | "TENANT_MISMATCH"
  | "GRADE_MISMATCH"
  | "TRACK_MISMATCH"
  | "TRACK_SUBJECT_NOT_ALLOWED"
  | "INVALID_ELECTIVE_RULE"
  | "ELECTIVE_NOT_SELECTED"
  | "ELECTIVE_MISMATCH";

export interface EligibilityDecision {
  readonly eligible: boolean;
  readonly reasonCode: EligibilityReasonCode;
  readonly reason: string;
}

export interface EvaluateEligibilityInput {
  readonly enrollment: StudentEnrollment;
  readonly subject: Subject;
  readonly trackSubjectRules: readonly TrackSubjectRule[];
  readonly track?: AcademicTrack;
}

function getSelectedElectiveForGroup(
  enrollment: StudentEnrollment,
  electiveGroup: string
): string | undefined {
  const fromMap = enrollment.selectedElectives[electiveGroup];
  if (fromMap) {
    return fromMap;
  }
  if (electiveGroup === ELECTIVE_GROUPS.SECOND_LANG && enrollment.secondLanguageSubjectId) {
    return enrollment.secondLanguageSubjectId;
  }
  return undefined;
}

/**
 * Pure domain policy determining whether an enrolled student is eligible to book
 * a session for a specific subject under common, track-core, or elective rules.
 */
export function evaluateStudentSubjectEligibility(
  input: EvaluateEligibilityInput
): EligibilityDecision {
  const { enrollment, subject, trackSubjectRules, track } = input;

  if (!enrollment.isActive) {
    return {
      eligible: false,
      reasonCode: "ENROLLMENT_INACTIVE",
      reason: "Student enrollment is inactive.",
    };
  }

  if (!subject.isActive) {
    return {
      eligible: false,
      reasonCode: "SUBJECT_INACTIVE",
      reason: "Subject is currently inactive.",
    };
  }

  if (subject.schoolId !== enrollment.schoolId) {
    return {
      eligible: false,
      reasonCode: "TENANT_MISMATCH",
      reason: "Subject does not belong to the student's enrolled school.",
    };
  }

  if (subject.gradeId !== enrollment.gradeId) {
    return {
      eligible: false,
      reasonCode: "GRADE_MISMATCH",
      reason: "Subject does not match the student's enrolled academic grade.",
    };
  }

  if (track) {
    if (!track.isActive) {
      return {
        eligible: false,
        reasonCode: "TRACK_INACTIVE",
        reason: "Student's academic track is inactive.",
      };
    }
    if (track.schoolId !== enrollment.schoolId) {
      return {
        eligible: false,
        reasonCode: "TENANT_MISMATCH",
        reason: "Academic track belongs to a different school tenant.",
      };
    }
    if (track.gradeId !== enrollment.gradeId) {
      return {
        eligible: false,
        reasonCode: "GRADE_MISMATCH",
        reason: "Academic track belongs to a different academic grade.",
      };
    }
    if (track.id !== enrollment.trackId) {
      return {
        eligible: false,
        reasonCode: "TRACK_MISMATCH",
        reason: "Provided academic track does not match student enrollment.",
      };
    }
  }

  if (subject.category === "COMMON") {
    return {
      eligible: true,
      reasonCode: "COMMON_SUBJECT_ELIGIBLE",
      reason: "Common curriculum subject is open to all tracks in this grade.",
    };
  }

  const rule = trackSubjectRules.find(
    (candidate) =>
      candidate.schoolId === enrollment.schoolId &&
      candidate.gradeId === enrollment.gradeId &&
      candidate.trackId === enrollment.trackId &&
      candidate.subjectId === subject.id
  );

  if (!rule) {
    return {
      eligible: false,
      reasonCode: "TRACK_SUBJECT_NOT_ALLOWED",
      reason: "Subject is not assigned to the student's enrolled academic track.",
    };
  }

  const requiresElectiveMatch = subject.category === "TRACK_ELECTIVE" || rule.isElective;
  if (!requiresElectiveMatch) {
    return {
      eligible: true,
      reasonCode: "TRACK_CORE_ELIGIBLE",
      reason: "Subject is a core requirement of the student's academic track.",
    };
  }

  if (!rule.electiveGroup) {
    return {
      eligible: false,
      reasonCode: "INVALID_ELECTIVE_RULE",
      reason: "Elective rule is missing an elective group identifier.",
    };
  }

  const selectedSubjectId = getSelectedElectiveForGroup(enrollment, rule.electiveGroup);
  if (!selectedSubjectId) {
    return {
      eligible: false,
      reasonCode: "ELECTIVE_NOT_SELECTED",
      reason: `Student has not selected an elective for group ${rule.electiveGroup}.`,
    };
  }

  if (selectedSubjectId !== subject.id) {
    return {
      eligible: false,
      reasonCode: "ELECTIVE_MISMATCH",
      reason: `Student selected a different subject for elective group ${rule.electiveGroup}.`,
    };
  }

  return {
    eligible: true,
    reasonCode: "TRACK_ELECTIVE_ELIGIBLE",
    reason: `Subject matches student's selected elective in group ${rule.electiveGroup}.`,
  };
}

export interface SubjectEligibilityEntry {
  readonly subject: Subject;
  readonly decision: EligibilityDecision;
}

/** Evaluates eligibility across a full catalog of subjects for a given student enrollment. */
export function evaluateCatalogEligibility(input: {
  readonly enrollment: StudentEnrollment;
  readonly subjects: readonly Subject[];
  readonly trackSubjectRules: readonly TrackSubjectRule[];
  readonly track?: AcademicTrack;
}): readonly SubjectEligibilityEntry[] {
  return input.subjects.map((subject) => ({
    subject,
    decision: evaluateStudentSubjectEligibility({
      enrollment: input.enrollment,
      subject,
      trackSubjectRules: input.trackSubjectRules,
      track: input.track,
    }),
  }));
}

/** Returns only the subject IDs eligible for the enrolled student. */
export function getEligibleSubjectIds(input: {
  readonly enrollment: StudentEnrollment;
  readonly subjects: readonly Subject[];
  readonly trackSubjectRules: readonly TrackSubjectRule[];
  readonly track?: AcademicTrack;
}): readonly string[] {
  return evaluateCatalogEligibility(input)
    .filter((entry) => entry.decision.eligible)
    .map((entry) => entry.subject.id);
}
