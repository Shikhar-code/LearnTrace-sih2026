import { AttemptAnalysisInput, AssessmentType } from "../types";

const ATTEMPT_STORAGE_PREFIX = "learntrace_student_attempts_";
const GLOBAL_ATTEMPTS_KEY = "learntrace_global_attempt_ids";

// Seeded baseline attempts for the initial cohort matrix (Users #1, #2, #3)
const DEFAULT_COHORT_BASELINE = [1, 2, 3, 4];

/**
 * Returns the list of completed attempt records for a student.
 */
export const getStudentAttempts = (userId: number = 1): AttemptAnalysisInput[] => {
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

  // Fallback for custom or unseeded users
  return [{ attempt_id: 1, assessment_type: "diagnostic" }];
};

/**
 * Records a new attempt so it immediately populates Knowledge Graph, Mastery Dashboard, and Cohort Heatmap.
 */
export const recordStudentAttempt = (
  userId: number = 1,
  attemptId: number,
  assessmentType: AssessmentType = "diagnostic",
): void => {
  try {
    // 1. Record in student's personal sequence
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

    // 2. Record in global cohort registry
    const globalSaved = JSON.parse(
      localStorage.getItem(GLOBAL_ATTEMPTS_KEY) || "[]",
    );
    if (!globalSaved.includes(attemptId)) {
      localStorage.setItem(
        GLOBAL_ATTEMPTS_KEY,
        JSON.stringify([...globalSaved, attemptId]),
      );
    }
  } catch (err) {
    console.error("Failed to store student attempt:", err);
  }
};

/**
 * Returns all known attempt IDs for the cohort (pre-seeded baseline + newly created).
 */
export const getAllCohortAttemptIds = (): number[] => {
  try {
    const globalSaved = JSON.parse(
      localStorage.getItem(GLOBAL_ATTEMPTS_KEY) || "[]",
    );
    const combined = Array.from(
      new Set([...DEFAULT_COHORT_BASELINE, ...globalSaved]),
    );
    return combined.sort((a, b) => a - b);
  } catch {
    return DEFAULT_COHORT_BASELINE;
  }
};
