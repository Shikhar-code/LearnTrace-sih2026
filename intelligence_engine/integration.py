"""Adapter from the existing FastAPI backend payloads to the intelligence core."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .assessment import (
    AssessmentService,
    AssessmentType,
    Difficulty,
    Question,
    QuestionOption,
    Response,
)
from .concept_graph import Concept
from .curriculum import CURRICULUM_VERSION, build_curriculum_graph, concept_id
from .frontend import build_frontend_payload
from .mastery import MasteryEngine
from .pipeline import IntelligencePipeline, PipelineResult


@dataclass(frozen=True)
class BackendAnalysis:
    attempt_ids: tuple[int, ...]
    user_id: int
    curriculum_version: str
    warnings: tuple[str, ...]
    frontend: Mapping[str, Any]
    result: PipelineResult

    def to_dict(self) -> dict[str, Any]:
        payload = self.result.to_dict()
        payload["integration"] = {
            "attempt_ids": list(self.attempt_ids),
            "user_id": self.user_id,
            "curriculum_version": self.curriculum_version,
            "warnings": list(self.warnings),
        }
        payload["frontend"] = dict(self.frontend)
        return payload


def analyze_backend_bundles(
    bundles: Sequence[Mapping[str, Any]],
    *,
    target_concept_id: str | None = None,
) -> BackendAnalysis:
    """Analyze backend attempt/assessment payload pairs without database coupling.

    Each bundle contains the existing ``/mastery/input/{attempt_id}`` response,
    its ``/assessments/{assessment_id}`` response, and an optional
    ``assessment_type`` value.
    """
    if not bundles:
        raise ValueError("at least one completed assessment attempt is required")

    questions: dict[str, Question] = {}
    responses: list[Response] = []
    observed_concepts: dict[str, Concept] = {}
    title_to_concept: dict[str, str] = {}
    attempt_ids: list[int] = []
    assessment_scores: list[dict[str, Any]] = []
    user_ids: set[int] = set()
    warnings = {
        "The backend does not provide hint or retry telemetry; those optional features are omitted.",
        "Response order is used for recency because per-response timestamps are not exposed.",
    }

    for bundle in bundles:
        attempt = _mapping(bundle.get("attempt"), "attempt")
        assessment = _mapping(bundle.get("assessment"), "assessment")
        attempt_id = int(attempt["attempt_id"])
        if attempt_id in attempt_ids:
            raise ValueError(f"attempt {attempt_id} was supplied more than once")
        if not attempt.get("completed"):
            raise ValueError(f"attempt {attempt_id} must be completed before analysis")
        if int(attempt["assessment_id"]) != int(assessment["id"]):
            raise ValueError(f"assessment payload does not match attempt {attempt_id}")
        attempt_ids.append(attempt_id)
        user_ids.add(int(attempt["user_id"]))
        assessment_type = AssessmentType(bundle.get("assessment_type", AssessmentType.DIAGNOSTIC.value))
        assessment_scores.append(
            {
                "attempt_id": attempt_id,
                "assessment_type": assessment_type.value,
                "score": attempt.get("score"),
                "completed": True,
            }
        )
        metadata = {
            str(item["question_id"]): item
            for item in assessment.get("questions", ())
        }
        seen_questions: set[str] = set()

        for row in sorted(attempt.get("responses", ()), key=lambda item: int(item["response_id"])):
            correctness = row.get("is_correct")
            if not isinstance(correctness, bool):
                raise ValueError(
                    f"response {row.get('response_id')} has no evaluated correctness"
                )
            class_level = int(row["class_level"])
            subject = str(row["subject"])
            chapter = str(row.get("chapter") or row.get("topic") or "").strip()
            if not chapter:
                raise ValueError(f"response {row.get('response_id')} has no chapter or topic mapping")
            competency_id = concept_id(class_level, subject, chapter)
            observed_concepts[competency_id] = Concept(competency_id, chapter)
            title_to_concept[chapter.casefold()] = competency_id

            question_id = str(row["question_id"])
            if question_id in seen_questions:
                raise ValueError(f"attempt {attempt_id} contains duplicate responses for question {question_id}")
            seen_questions.add(question_id)
            item = metadata.get(question_id)
            if item is None:
                raise ValueError(
                    f"question {question_id} is not assigned to assessment {assessment['id']}"
                )
            if int(item["topic_id"]) != int(row["topic_id"]):
                raise ValueError(f"question {question_id} has inconsistent topic metadata")
            difficulty = item.get("difficulty", Difficulty.MEDIUM.value)
            question = Question(
                id=question_id,
                concept_id=competency_id,
                difficulty=difficulty,
                prompt=str(item.get("question_text") or f"Backend question {question_id}"),
                options=(
                    QuestionOption("evaluated-correct", "Evaluated correct"),
                    QuestionOption("evaluated-incorrect", "Evaluated incorrect"),
                ),
                correct_option_id="evaluated-correct",
            )
            existing = questions.get(question_id)
            if existing is not None and (
                existing.concept_id != question.concept_id
                or existing.difficulty != question.difficulty
            ):
                raise ValueError(f"question {question_id} has inconsistent backend metadata")
            questions[question_id] = question
            seconds = row.get("response_time_seconds")
            responses.append(
                Response(
                    question_id=question_id,
                    selected_option_id=(
                        "evaluated-correct" if correctness else "evaluated-incorrect"
                    ),
                    response_time_ms=None if seconds is None else int(seconds) * 1000,
                    assessment_type=assessment_type,
                )
            )

    if len(user_ids) != 1:
        raise ValueError("all attempts in one analysis must belong to the same user")
    if not responses:
        raise ValueError("completed attempts contain no evaluated responses")

    target = target_concept_id
    if target is not None and target not in observed_concepts:
        target = title_to_concept.get(target.casefold())
        if target is None:
            raise ValueError("target concept must be assessed in the supplied attempts")

    graph = build_curriculum_graph(observed_concepts.values())
    pipeline = IntelligencePipeline(
        AssessmentService(questions.values()),
        graph,
        MasteryEngine(),  # Transparent deterministic estimator for live integration.
    )
    result = pipeline.run(responses, target_concept_id=target)
    return BackendAnalysis(
        attempt_ids=tuple(attempt_ids),
        user_id=next(iter(user_ids)),
        curriculum_version=CURRICULUM_VERSION,
        warnings=tuple(sorted(warnings)),
        frontend=build_frontend_payload(result, graph, assessment_scores),
        result=result,
    )


def _mapping(value: Any, name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{name} payload must be an object")
    return value


__all__ = ["BackendAnalysis", "analyze_backend_bundles"]
