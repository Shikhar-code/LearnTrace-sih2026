import { AttemptAnalysisInput, AssessmentType } from "../types";

const ATTEMPT_STORAGE_PREFIX = "learntrace_student_attempts_";

/**
 * Returns the list of completed attempt records belonging specifically to the logged-in student.
 */
export const getStudentAttempts = (userId: number): AttemptAnalysisInput[] => {
  try {
    const saved = localStorage.getItem(`${ATTEMPT_STORAGE_PREFIX}${userId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as AttemptAnalysisInput[];
      }
    }
  } catch (err) {
    console.warn("Failed to parse saved student attempts:", err);
  }

  // Pre-seeded database baseline attempts for demo personas
  if (userId === 1) {
    // Asha Demo (User #1): Diagnostic (Attempt 1) & Reassessment (Attempt 4)
    return [
      { attempt_id: 1, assessment_type: "diagnostic" },
      { attempt_id: 4, assessment_type: "reassessment" },
    ];
  }
  if (userId === 2) {
    // Ravi Demo (User #2): Diagnostic (Attempt 2)
    return [{ attempt_id: 2, assessment_type: "diagnostic" }];
  }
  if (userId === 3) {
    // Meera Demo (User #3): Diagnostic (Attempt 3)
    return [{ attempt_id: 3, assessment_type: "diagnostic" }];
  }

  // Default fallback for newly registered or custom users
  return [{ attempt_id: 1, assessment_type: "diagnostic" }];
};

/**
 * Records a new attempt for the active student so it immediately reflects in their knowledge graph & mastery history.
 */
export const recordStudentAttempt = (
  userId: number,
  attemptId: number,
  assessmentType: AssessmentType = "diagnostic",
): void => {
  try {
    const current = getStudentAttempts(userId);
    const exists = current.some((item) => item.attempt_id === attemptId);
    if (!exists) {
      const updated = [
        ...current,
        { attempt_id: attemptId, assessment_type: assessmentType },
      ];
      localStorage.setItem(
        `${ATTEMPT_STORAGE_PREFIX}${userId}`,
        JSON.stringify(updated),
      );
    }
  } catch (err) {
    console.error("Failed to store student attempt:", err);
  }
};
