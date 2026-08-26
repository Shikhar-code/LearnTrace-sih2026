import unittest

from intelligence_engine.learning_path import (
    LearningPathEngine,
    MasteryTier,
    StepStatus,
    mastery_tier,
)


class FakeGraph:
    prerequisites = {
        "ratios": (),
        "pythagoras": ("ratios",),
        "applications": ("pythagoras",),
        "heights": ("applications",),
    }

    def bounded_paths(self, root, target, max_paths, max_depth):
        if (root, target) == ("ratios", "heights"):
            return [
                ["ratios", "pythagoras", "applications", "heights"],
                ["ratios", "applications", "heights"],
                ["heights", "ratios"],  # invalid direction, must be ignored
            ][:max_paths]
        return []


class LearningPathTests(unittest.TestCase):
    def setUp(self):
        self.engine = LearningPathEngine(FakeGraph())

    def test_five_tiers_and_unknown(self):
        self.assertEqual(mastery_tier(None), MasteryTier.UNKNOWN)
        self.assertEqual(mastery_tier(0.39), MasteryTier.CRITICAL_GAP)
        self.assertEqual(mastery_tier(0.40), MasteryTier.EMERGING)
        self.assertEqual(mastery_tier(0.54), MasteryTier.EMERGING)
        self.assertEqual(mastery_tier(0.55), MasteryTier.DEVELOPING)
        self.assertEqual(mastery_tier(0.69), MasteryTier.DEVELOPING)
        self.assertEqual(mastery_tier(0.70), MasteryTier.PROFICIENT)
        self.assertEqual(mastery_tier(0.84), MasteryTier.PROFICIENT)
        self.assertEqual(mastery_tier(0.85), MasteryTier.MASTERED)

    def test_invalid_candidates_are_rejected_and_mastered_nodes_omitted(self):
        mastery = {"ratios": 0.90, "pythagoras": 0.50, "applications": 0.30, "heights": 0.20}
        candidates = self.engine.generate_candidates("ratios", "heights", mastery)
        self.assertEqual(len(candidates), 1)
        self.assertTrue(all("ratios" not in candidate.concept_ids for candidate in candidates))
        self.assertEqual(candidates[0].concept_ids, ("pythagoras", "applications", "heights"))

    def test_statuses_follow_progression_gate(self):
        mastery = {"ratios": 0.90, "pythagoras": 0.50, "applications": 0.30, "heights": 0.20}
        path = self.engine.plan("ratios", "heights", mastery)
        self.assertEqual([step.concept_id for step in path.steps], ["pythagoras", "applications", "heights"])
        self.assertEqual([step.status for step in path.steps], [StepStatus.CURRENT, StepStatus.LOCKED, StepStatus.LOCKED])
        self.assertEqual(path.steps[0].tier, MasteryTier.EMERGING)

    def test_unknown_requires_diagnostic_and_reassessment_unlocks_next_step(self):
        initial = {"ratios": 0.90, "pythagoras": None, "applications": 0.30, "heights": 0.20}
        path = self.engine.plan("ratios", "heights", initial)
        self.assertEqual(path.steps[0].status, StepStatus.DIAGNOSTIC_REQUIRED)
        updated = {"ratios": 0.90, "pythagoras": 0.72, "applications": 0.30, "heights": 0.20}
        recalculated = self.engine.recalculate(path, updated, version=2)
        self.assertEqual(recalculated.version, 2)
        self.assertEqual(recalculated.steps[0].status, StepStatus.COMPLETED)
        self.assertEqual(recalculated.steps[1].status, StepStatus.CURRENT)
        self.assertEqual(path.steps[0].status, StepStatus.DIAGNOSTIC_REQUIRED)

    def test_completed_steps_do_not_block_current_step(self):
        mastery = {"ratios": 0.90, "pythagoras": 0.72, "applications": 0.30, "heights": 0.20}
        path = self.engine.plan("ratios", "heights", mastery)
        self.assertEqual(path.steps[0].status, StepStatus.COMPLETED)
        self.assertEqual(path.steps[1].status, StepStatus.CURRENT)
        self.assertEqual(path.steps[2].blocked_by, ("applications",))


if __name__ == "__main__":
    unittest.main()
