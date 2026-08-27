"""Deterministic Class 10 trigonometry end-to-end demonstration."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from .assessment import AssessmentService, AssessmentType, Question, QuestionOption, Response
from .concept_graph import Concept, ConceptGraph, Dependency
from .mastery import LogisticMasteryModel, MasteryEngine, train_default_model
from .pipeline import IntelligencePipeline, PipelineResult
from .train_model import ARTIFACT_PATH


CONCEPTS = (
    Concept("basic-ratios", "Basic Ratios"),
    Concept("pythagoras", "Pythagoras"),
    Concept("trig-ratios", "Trigonometric Ratios"),
    Concept("trig-applications", "Trigonometric Applications"),
    Concept("heights-distances", "Heights & Distances"),
)

DEPENDENCIES = (
    Dependency("pythagoras", "basic-ratios", 0.90),
    Dependency("trig-ratios", "pythagoras", 0.90),
    Dependency("trig-applications", "trig-ratios", 0.95),
    Dependency("heights-distances", "trig-applications", 0.95),
)

INITIAL_PERFORMANCE = {
    "basic-ratios": (10, 9),
    "pythagoras": (10, 8),
    "trig-ratios": (10, 4),
    "trig-applications": (10, 3),
    "heights-distances": (10, 2),
}


def _outcomes(count: int, correct_count: int) -> list[bool]:
    return [
        ((index + 1) * correct_count) // count > (index * correct_count) // count
        for index in range(count)
    ]


def build_questions(per_concept: int = 25) -> tuple[Question, ...]:
    questions = []
    difficulties = ("easy", "medium", "hard")
    for concept in CONCEPTS:
        for index in range(per_concept):
            question_id = f"{concept.id}-q{index + 1}"
            questions.append(
                Question(
                    id=question_id,
                    concept_id=concept.id,
                    difficulty=difficulties[index % len(difficulties)],
                    prompt=f"Deterministic diagnostic item {index + 1} for {concept.name}",
                    options=(
                        QuestionOption(f"{question_id}-a", "Correct option"),
                        QuestionOption(f"{question_id}-b", "Distractor"),
                    ),
                    correct_option_id=f"{question_id}-a",
                    expected_time_seconds=60,
                )
            )
    return tuple(questions)


def concept_responses(
    concept_id: str,
    count: int,
    correct_count: int,
    *,
    assessment_type: AssessmentType,
    question_offset: int = 0,
    time_offset_days: int = 0,
) -> list[Response]:
    responses = []
    start = datetime(2026, 1, 1) + timedelta(days=time_offset_days)
    for index, correct in enumerate(_outcomes(count, correct_count)):
        question_number = question_offset + index + 1
        question_id = f"{concept_id}-q{question_number}"
        responses.append(
            Response(
                question_id=question_id,
                selected_option_id=f"{question_id}-{'a' if correct else 'b'}",
                response_time_ms=45_000 if correct else 75_000,
                hints_used=0 if correct else 1,
                retry_count=0 if correct else 1,
                answered_at=start + timedelta(minutes=index),
                assessment_type=assessment_type,
            )
        )
    return responses


def initial_responses() -> list[Response]:
    responses = []
    for concept_id, (count, correct) in INITIAL_PERFORMANCE.items():
        responses.extend(
            concept_responses(
                concept_id,
                count,
                correct,
                assessment_type=AssessmentType.DIAGNOSTIC,
            )
        )
    return responses


def reassessment_responses() -> list[Response]:
    return concept_responses(
        "trig-ratios",
        15,
        15,
        assessment_type=AssessmentType.REASSESSMENT,
        question_offset=10,
        time_offset_days=7,
    )


def load_or_train_model(path: Path = ARTIFACT_PATH) -> LogisticMasteryModel:
    if path.exists():
        return LogisticMasteryModel.from_json(path.read_text(encoding="utf-8"))
    return train_default_model(sample_count=1800, seed=42)


def build_demo_pipeline() -> IntelligencePipeline:
    return IntelligencePipeline(
        AssessmentService(build_questions()),
        ConceptGraph(CONCEPTS, DEPENDENCIES),
        MasteryEngine(load_or_train_model()),
    )


def run_demo() -> tuple[PipelineResult, PipelineResult]:
    pipeline = build_demo_pipeline()
    before_responses = initial_responses()
    before = pipeline.run(
        before_responses,
        target_concept_id="heights-distances",
        path_version=1,
    )
    after = pipeline.run(
        [*before_responses, *reassessment_responses()],
        target_concept_id="heights-distances",
        path_version=2,
        previous_path=before.learning_path,
    )
    return before, after


if __name__ == "__main__":
    before, after = run_demo()
    print("Before:", before.to_dict())
    print("After:", after.to_dict())
