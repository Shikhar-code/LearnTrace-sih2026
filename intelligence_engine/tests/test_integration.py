import json
import unittest

from intelligence_engine.curriculum import CHAPTERS, build_curriculum_graph, concept_id
from intelligence_engine.frontend import build_admin_heatmap
from intelligence_engine.integration import analyze_backend_bundles
from intelligence_engine.learning_path import StepStatus


SUBJECT = "Mathematics"
TRIANGLES = "Triangles"
TRIG = "Introduction to Trigonometry"
APPLICATIONS = "Some Applications of Trigonometry"


def bundle(attempt_id, user_id, chapters, correct_counts, assessment_type="diagnostic"):
    questions = []
    responses = []
    question_id = attempt_id * 100
    response_id = attempt_id * 100
    for chapter, correct_count in zip(chapters, correct_counts):
        for index in range(10 if assessment_type == "diagnostic" else 15):
            question_id += 1
            response_id += 1
            questions.append(
                {
                    "question_id": question_id,
                    "question_text": f"{chapter} question {index + 1}",
                    "difficulty": ("easy", "medium", "hard")[index % 3],
                    "topic_id": question_id,
                }
            )
            responses.append(
                {
                    "response_id": response_id,
                    "question_id": question_id,
                    "topic_id": question_id,
                    "topic": chapter,
                    "chapter_id": question_id,
                    "chapter": chapter,
                    "subject_id": 3,
                    "subject": SUBJECT,
                    "class_level": 10,
                    "is_correct": index < correct_count,
                    "response_time_seconds": 20,
                }
            )
    return {
        "attempt": {
            "attempt_id": attempt_id,
            "user_id": user_id,
            "assessment_id": attempt_id,
            "completed": True,
            "score": 50,
            "responses": responses,
        },
        "assessment": {
            "id": attempt_id,
            "title": "Integration fixture",
            "questions": questions,
        },
        "assessment_type": assessment_type,
    }


class CurriculumTests(unittest.TestCase):
    def test_catalogue_covers_all_backend_class_9_10_chapters(self):
        self.assertEqual(sum(len(chapters) for chapters in CHAPTERS.values()), 50)
        graph = build_curriculum_graph()
        self.assertEqual(len(graph.concepts()), 50)
        self.assertEqual(
            graph.paths(
                concept_id(10, SUBJECT, TRIANGLES),
                concept_id(10, SUBJECT, APPLICATIONS),
            ),
            ((
                concept_id(10, SUBJECT, TRIANGLES),
                concept_id(10, SUBJECT, TRIG),
                concept_id(10, SUBJECT, APPLICATIONS),
            ),),
        )


class BackendIntegrationTests(unittest.TestCase):
    def test_backend_payload_runs_complete_intelligence_pipeline(self):
        analysis = analyze_backend_bundles(
            [bundle(1, 7, (TRIANGLES, TRIG, APPLICATIONS), (9, 4, 2))],
            target_concept_id=APPLICATIONS,
        )
        trig_id = concept_id(10, SUBJECT, TRIG)
        applications_id = concept_id(10, SUBJECT, APPLICATIONS)
        self.assertEqual(analysis.result.target_concept_id, applications_id)
        self.assertEqual(analysis.result.gaps.root_causes[0].concept_id, trig_id)
        self.assertEqual(
            analysis.result.learning_path.concept_ids,
            (trig_id, applications_id),
        )
        self.assertEqual(analysis.result.mastery[trig_id].estimator, "STATISTICAL_FALLBACK")
        self.assertEqual(analysis.result.learning_path.steps[0].status, StepStatus.CURRENT)
        self.assertEqual(analysis.to_dict()["integration"]["attempt_ids"], [1])

    def test_frontend_json_contains_chart_data_and_two_consistent_graph_views(self):
        analysis = analyze_backend_bundles(
            [bundle(1, 7, (TRIANGLES, TRIG, APPLICATIONS), (9, 4, 2))],
            target_concept_id=APPLICATIONS,
        )
        payload = analysis.to_dict()
        json.dumps(payload)
        frontend = payload["frontend"]
        trig_id = concept_id(10, SUBJECT, TRIG)
        applications_id = concept_id(10, SUBJECT, APPLICATIONS)

        self.assertEqual(frontend["schema_version"], "LEARNTRACE_FRONTEND_V1")
        self.assertEqual(frontend["summary"]["next_action"]["type"], "LEARN_CURRENT_STEP")
        self.assertEqual(len(frontend["graphs"]["competency"]["nodes"]), 16)
        self.assertEqual(
            {node["id"] for node in frontend["graphs"]["root_cause"]["nodes"]},
            {trig_id, applications_id},
        )
        root_roles = next(
            node["roles"]
            for node in frontend["graphs"]["root_cause"]["nodes"]
            if node["id"] == trig_id
        )
        self.assertIn("ROOT_CAUSE", root_roles)
        self.assertIn("PATH_CURRENT", root_roles)
        self.assertIn(
            {
                "id": f"{trig_id}->{applications_id}",
                "source": trig_id,
                "target": applications_id,
                "weight": 0.95,
                "in_root_trace": True,
                "in_learning_path": True,
            },
            frontend["graphs"]["competency"]["edges"],
        )

    def test_reassessment_unlocks_the_target_chapter(self):
        diagnostic = bundle(1, 7, (TRIANGLES, TRIG, APPLICATIONS), (9, 4, 2))
        reassessment = bundle(2, 7, (TRIG,), (15,), "reassessment")
        analysis = analyze_backend_bundles(
            [diagnostic, reassessment],
            target_concept_id=APPLICATIONS,
        )
        statuses = {
            step.concept_id: step.status
            for step in analysis.result.learning_path.steps
        }
        self.assertEqual(statuses[concept_id(10, SUBJECT, TRIG)], StepStatus.COMPLETED)
        self.assertEqual(statuses[concept_id(10, SUBJECT, APPLICATIONS)], StepStatus.CURRENT)
        progress = analysis.to_dict()["frontend"]["progress"]
        self.assertEqual(
            [item["assessment_type"] for item in progress["assessment_scores"]],
            ["diagnostic", "reassessment"],
        )
        self.assertTrue(progress["concept_improvement"])

    def test_rejects_cross_user_history(self):
        with self.assertRaisesRegex(ValueError, "same user"):
            analyze_backend_bundles(
                [
                    bundle(1, 7, (TRIG,), (4,)),
                    bundle(2, 8, (TRIG,), (4,), "reassessment"),
                ]
            )

    def test_rejects_question_not_assigned_to_assessment(self):
        invalid = bundle(1, 7, (TRIG,), (4,))
        invalid["assessment"]["questions"].pop()
        with self.assertRaisesRegex(ValueError, "not assigned"):
            analyze_backend_bundles([invalid])

    def test_all_proficient_attempt_has_no_false_gap_or_path(self):
        analysis = analyze_backend_bundles(
            [bundle(1, 7, (TRIANGLES, TRIG, APPLICATIONS), (10, 10, 10))]
        )
        self.assertEqual(analysis.result.gaps.root_causes, ())
        self.assertIsNone(analysis.result.learning_path)
        frontend = analysis.to_dict()["frontend"]
        self.assertEqual(frontend["summary"]["next_action"]["type"], "MAINTAIN_MASTERY")
        self.assertEqual(len(frontend["graphs"]["root_cause"]["nodes"]), 1)


class AdminHeatmapTests(unittest.TestCase):
    def test_admin_heatmap_aggregates_students_concepts_and_root_gaps(self):
        weak = analyze_backend_bundles(
            [bundle(1, 7, (TRIANGLES, TRIG, APPLICATIONS), (9, 4, 2))],
            target_concept_id=APPLICATIONS,
        ).to_dict()
        strong = analyze_backend_bundles(
            [bundle(2, 8, (TRIANGLES, TRIG, APPLICATIONS), (10, 10, 10))],
            target_concept_id=APPLICATIONS,
        ).to_dict()

        heatmap = build_admin_heatmap([weak, strong])
        json.dumps(heatmap)
        trig_id = concept_id(10, SUBJECT, TRIG)
        trig = next(
            item for item in heatmap["concept_summary"] if item["concept_id"] == trig_id
        )

        self.assertEqual(heatmap["schema_version"], "LEARNTRACE_ADMIN_HEATMAP_V1")
        self.assertEqual(heatmap["summary"]["student_count"], 2)
        self.assertEqual(heatmap["summary"]["concept_count"], 16)
        self.assertEqual([row["user_id"] for row in heatmap["rows"]], [7, 8])
        self.assertEqual(trig["assessed_students"], 2)
        self.assertEqual(trig["at_risk_students"], 1)
        self.assertEqual(trig["root_gap_students"], 1)
        self.assertEqual(heatmap["root_gap_distribution"][0]["concept_id"], trig_id)

    def test_admin_heatmap_rejects_duplicate_learners(self):
        learner = analyze_backend_bundles(
            [bundle(1, 7, (TRIG,), (4,))],
            target_concept_id=TRIG,
        ).to_dict()
        with self.assertRaisesRegex(ValueError, "appear once"):
            build_admin_heatmap([learner, learner])


if __name__ == "__main__":
    unittest.main()
