import unittest

from concept_graph import Concept, ConceptGraph, Dependency


class ConceptGraphTests(unittest.TestCase):
    def test_linear_graph_traversal_influence_and_path(self):
        graph = ConceptGraph(
            [Concept("ratios"), Concept("trig"), Concept("heights")],
            [Dependency("trig", "ratios", 0.8), Dependency("heights", "trig", 0.9)],
        )

        self.assertEqual(graph.prerequisites("heights"), ("trig",))
        self.assertEqual(graph.ancestors("heights"), ("ratios", "trig"))
        self.assertEqual(graph.descendants("ratios"), ("trig", "heights"))
        self.assertEqual(graph.topological_sort(), ("ratios", "trig", "heights"))
        self.assertEqual(
            graph.dependencies(),
            (Dependency("trig", "ratios", 0.8), Dependency("heights", "trig", 0.9)),
        )
        self.assertAlmostEqual(graph.influence("trig", "heights"), 0.765)
        self.assertEqual(graph.paths("ratios", "heights"), (("ratios", "trig", "heights"),))

    def test_branch_graph_uses_noisy_or_and_bounded_paths(self):
        graph = ConceptGraph(
            ["arithmetic", "geometry", "algebra", "word-problems"],
            [
                {"concept_id": "geometry", "prerequisite_id": "arithmetic", "weight": 0.8},
                {"concept_id": "algebra", "prerequisite_id": "arithmetic", "weight": 0.7},
                {"concept_id": "word-problems", "prerequisite_id": "geometry", "weight": 0.9},
                {"concept_id": "word-problems", "prerequisite_id": "algebra", "weight": 0.6},
            ],
        )

        self.assertEqual(graph.immediate_prerequisite_branches("word-problems"), (("algebra", "arithmetic"), ("geometry", "arithmetic")))
        self.assertEqual(
            graph.paths("arithmetic", "word-problems"),
            (("arithmetic", "algebra", "word-problems"), ("arithmetic", "geometry", "word-problems")),
        )
        expected = 1 - (1 - 0.85 * 0.6 * (0.85 * 0.7)) * (1 - 0.85 * 0.9 * (0.85 * 0.8))
        self.assertAlmostEqual(graph.influence("arithmetic", "word-problems"), expected)
        self.assertEqual(len(graph.paths("arithmetic", "word-problems", max_paths=1)), 1)

    def test_validation_rejects_bad_dependencies_and_cycles(self):
        with self.assertRaisesRegex(ValueError, "missing"):
            ConceptGraph(["a"], [Dependency("a", "b")])
        with self.assertRaisesRegex(ValueError, "self"):
            ConceptGraph(["a"], [Dependency("a", "a")])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            ConceptGraph(["a", "b"], [Dependency("b", "a"), Dependency("b", "a")])
        with self.assertRaises(ValueError):
            ConceptGraph(["a", "b"], [Dependency("b", "a", 0), Dependency("a", "b")])
        with self.assertRaisesRegex(ValueError, "cycle"):
            ConceptGraph(["a", "b"], [Dependency("a", "b"), Dependency("b", "a")])


if __name__ == "__main__":
    unittest.main()
