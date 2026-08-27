import unittest

from intelligence_engine.demo import initial_responses, reassessment_responses, build_demo_pipeline
from intelligence_engine.learning_path import StepStatus


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pipeline = build_demo_pipeline()

    def test_complete_root_cause_vertical_slice(self):
        result = self.pipeline.run(
            initial_responses(),
            target_concept_id="heights-distances",
        )
        self.assertEqual(result.gaps.root_causes[0].concept_id, "trig-ratios")
        self.assertIn(
            "trig-applications",
            {item.concept_id for item in result.gaps.contributing_gaps},
        )
        self.assertEqual(
            result.learning_path.concept_ids,
            ("trig-ratios", "trig-applications", "heights-distances"),
        )
        self.assertEqual(result.learning_path.steps[0].status, StepStatus.CURRENT)
        payload = result.to_dict()
        self.assertEqual(payload["target_concept_id"], "heights-distances")

    def test_reassessment_unlocks_next_step(self):
        before = initial_responses()
        initial = self.pipeline.run(
            before,
            target_concept_id="heights-distances",
        )
        result = self.pipeline.run(
            [*before, *reassessment_responses()],
            target_concept_id="heights-distances",
            path_version=2,
            previous_path=initial.learning_path,
        )
        self.assertGreaterEqual(result.mastery["trig-ratios"].probability, 0.70)
        statuses = {step.concept_id: step.status for step in result.learning_path.steps}
        self.assertEqual(statuses["trig-ratios"], StepStatus.COMPLETED)
        self.assertEqual(statuses["trig-applications"], StepStatus.CURRENT)
        self.assertEqual(result.learning_path.version, 2)

    def test_pipeline_uses_only_safe_public_questions(self):
        public = self.pipeline.assessment.public_questions(["trig-ratios-q1"])[0]
        self.assertNotIn("correct_option_id", public)
        self.assertNotIn("is_correct", str(public))


if __name__ == "__main__":
    unittest.main()
