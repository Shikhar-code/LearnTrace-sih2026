import unittest

from intelligence_engine.mastery import (
    LogisticMasteryModel,
    MasteryEngine,
    MasteryTier,
    synthetic_training_data,
)


class MasteryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rows, labels = synthetic_training_data(900, seed=42)
        cls.model = LogisticMasteryModel().fit(rows, labels, iterations=260)

    def evidence(self, concept_id, accuracy, count=12):
        return {
            "concept_id": concept_id,
            "overall_accuracy": accuracy,
            "weighted_accuracy": accuracy,
            "recent_accuracy": accuracy,
            "hard_accuracy": max(0.0, accuracy - 0.1),
            "effective_evidence": count,
            "recent_failure_rate": 1.0 - accuracy,
            "hint_usage_rate": max(0.0, 0.7 - accuracy),
            "mean_retry_count": max(0.0, 1.0 - accuracy),
            "difficulty_coverage": 1.0,
        }

    def test_model_ranks_strong_above_weak(self):
        engine = MasteryEngine(self.model)
        weak = engine.estimate(self.evidence("weak", 0.25))
        strong = engine.estimate(self.evidence("strong", 0.90))
        self.assertLess(weak.probability, strong.probability)
        self.assertIn(weak.tier, {MasteryTier.CRITICAL_GAP, MasteryTier.EMERGING})
        self.assertIn(strong.tier, {MasteryTier.PROFICIENT, MasteryTier.MASTERED})

    def test_statistical_fallback_and_five_tiers(self):
        estimate = MasteryEngine().estimate(self.evidence("c", 0.72, count=30))
        self.assertEqual(estimate.estimator, "STATISTICAL_FALLBACK")
        self.assertEqual(estimate.tier, MasteryTier.PROFICIENT)
        self.assertTrue(estimate.can_progress)

    def test_insufficient_evidence_is_unknown(self):
        estimate = MasteryEngine(self.model).estimate(self.evidence("c", 0.2, count=1))
        self.assertIsNone(estimate.probability)
        self.assertIsNone(estimate.tier)

    def test_model_round_trip(self):
        restored = LogisticMasteryModel.from_json(self.model.to_json())
        features = synthetic_training_data(1, seed=7)[0][0]
        self.assertAlmostEqual(
            self.model.predict_probability(features),
            restored.predict_probability(features),
            places=12,
        )


if __name__ == "__main__":
    unittest.main()
