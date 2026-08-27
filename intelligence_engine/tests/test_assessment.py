import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from assessment import (  # noqa: E402
    AssessmentService,
    AssessmentType,
    Difficulty,
    Question,
    QuestionOption,
    QuestionValidationError,
    Response,
    ResponseValidationError,
)


def question(question_id, concept, difficulty=Difficulty.MEDIUM, expected=60):
    return Question(
        id=question_id,
        concept_id=concept,
        difficulty=difficulty,
        prompt=f"Prompt for {question_id}",
        options=(QuestionOption("a", "A"), QuestionOption("b", "B")),
        correct_option_id="a",
        expected_time_seconds=expected,
    )


class AssessmentTests(unittest.TestCase):
    def setUp(self):
        self.service = AssessmentService(
            [
                question("easy", "ratios", Difficulty.EASY),
                question("medium", "ratios", Difficulty.MEDIUM),
                question("hard", "ratios", Difficulty.HARD, expected=30),
                question("other", "angles", Difficulty.MEDIUM),
            ]
        )

    def test_public_questions_omit_answer_metadata(self):
        public = self.service.public_questions(["medium"])[0]
        self.assertEqual(public["id"], "medium")
        self.assertNotIn("correct_option_id", public)
        self.assertNotIn("is_correct", public)
        self.assertNotIn("correct", public)
        self.assertEqual(public["options"], [{"id": "a", "text": "A"}, {"id": "b", "text": "B"}])

    def test_invalid_question_and_response_are_rejected(self):
        with self.assertRaises(QuestionValidationError):
            Question("bad", "ratios", Difficulty.MEDIUM, "bad", (QuestionOption("a", "A"),), "missing")
        with self.assertRaises(ResponseValidationError):
            self.service.evaluate_response(Response("missing", "a"))
        with self.assertRaises(ResponseValidationError):
            self.service.evaluate_response(Response("medium", "missing"))
        with self.assertRaises(ResponseValidationError):
            self.service.evaluate_response(Response("medium", "a"), assigned_question_ids=["other"])

    def test_evidence_uses_assessment_and_difficulty_weights(self):
        responses = [
            Response("easy", "a", assessment_type=AssessmentType.DIAGNOSTIC),
            Response("medium", "a", assessment_type=AssessmentType.PRACTICE),
            Response("hard", "b", assessment_type=AssessmentType.DIAGNOSTIC),
        ]
        evaluated = [self.service.evaluate_response(response) for response in responses]
        # .75 (easy success) + .3 (practice success) + .75 (hard failure)
        self.assertAlmostEqual(sum(item.effective_weight for item in evaluated), 1.8)
        evidence = self.service.aggregate_evidence(responses)["ratios"]
        self.assertEqual(evidence.response_count, 3)
        self.assertEqual(evidence.correct_count, 2)
        self.assertAlmostEqual(evidence.effective_evidence, 1.8)
        self.assertAlmostEqual(evidence.difficulty_weighted_accuracy, 1.05 / 1.8)

    def test_optional_telemetry_and_features_are_aggregated(self):
        start = datetime(2026, 1, 1)
        responses = [
            Response("medium", "b", response_time_ms=120_000, hints_used=1, retry_count=2,
                     answered_at=start, assessment_type=AssessmentType.DIAGNOSTIC),
            Response("hard", "a", response_time_ms=15_000, hints_used=0, retry_count=0,
                     answered_at=start + timedelta(days=1), assessment_type=AssessmentType.REASSESSMENT),
        ]
        evidence = self.service.aggregate_evidence(responses)["ratios"]
        self.assertEqual(evidence.recent_accuracy_5, 0.5)
        self.assertEqual(evidence.recent_failure_rate, 0.5)
        self.assertEqual(evidence.hard_accuracy, 1.0)
        self.assertEqual(evidence.hint_usage_rate, 0.5)
        self.assertEqual(evidence.mean_retry_count, 1.0)
        self.assertAlmostEqual(evidence.mean_response_time_ratio, 1.25)
        self.assertEqual(evidence.reassessment_delta, 1.0)
        self.assertEqual(evidence.missing_features, ())
        self.assertEqual(evidence.difficulty_band_coverage, 2 / 3)

    def test_missing_optional_telemetry_is_explicit(self):
        evidence = self.service.aggregate_evidence([Response("other", "a")])["angles"]
        self.assertEqual(evidence.missing_features, ("response_time", "hint_evidence", "retry_evidence"))
        self.assertIsNone(evidence.mean_response_time_ratio)
        self.assertIsNone(evidence.hint_usage_rate)
        self.assertIsNone(evidence.mean_retry_count)


if __name__ == "__main__":
    unittest.main()
