import unittest

from intelligence_engine.concept_graph import ConceptGraph, Dependency
from intelligence_engine.mastery import MasteryEstimate, MasteryTier
from intelligence_engine.root_cause import RootCauseEngine


def estimate(concept_id, probability, confidence=0.85):
    return MasteryEstimate(
        concept_id=concept_id,
        probability=probability,
        confidence=confidence,
        confidence_label="HIGH",
        tier=None if probability is None else MasteryTier.MASTERED if probability >= 0.85 else MasteryTier.EMERGING,
        estimator="TEST",
        statistical_probability=probability,
        model_probability=probability,
        effective_evidence=12,
        explanations=(),
    )


class RootCauseTests(unittest.TestCase):
    def setUp(self):
        self.graph = ConceptGraph(
            ["ratios", "pythagoras", "trig", "applications", "heights"],
            [
                Dependency("pythagoras", "ratios", 0.90),
                Dependency("trig", "pythagoras", 0.90),
                Dependency("applications", "trig", 0.95),
                Dependency("heights", "applications", 0.95),
            ],
        )
        self.mastery = {
            "ratios": estimate("ratios", 0.88),
            "pythagoras": estimate("pythagoras", 0.79),
            "trig": estimate("trig", 0.41),
            "applications": estimate("applications", 0.35),
            "heights": estimate("heights", 0.28),
        }

    def test_finds_upstream_root_and_intermediate_contributor(self):
        analysis = RootCauseEngine().analyze("heights", self.mastery, self.graph)
        self.assertEqual(analysis.root_causes[0].concept_id, "trig")
        self.assertIn("applications", {item.concept_id for item in analysis.contributing_gaps})
        self.assertLess(analysis.unexplained_probability, 0.5)

    def test_unknown_prerequisite_requests_diagnostic(self):
        mastery = dict(self.mastery)
        mastery["trig"] = estimate("trig", None, 0.0)
        analysis = RootCauseEngine().analyze("heights", mastery, self.graph)
        self.assertIn("trig", analysis.diagnostic_required_concept_ids)

    def test_multiple_branches_return_branch_roots(self):
        graph = ConceptGraph(
            ["algebra", "ratios", "coordinate", "trig"],
            [
                Dependency("coordinate", "algebra", 0.9),
                Dependency("trig", "coordinate", 0.8),
                Dependency("trig", "ratios", 0.9),
            ],
        )
        mastery = {
            "algebra": estimate("algebra", 0.30),
            "coordinate": estimate("coordinate", 0.40),
            "ratios": estimate("ratios", 0.35),
            "trig": estimate("trig", 0.25),
        }
        roots = RootCauseEngine().analyze("trig", mastery, graph).root_causes
        self.assertEqual({item.branch_id for item in roots}, {"coordinate", "ratios"})


if __name__ == "__main__":
    unittest.main()
