"""Standalone assessment evidence collection.

The module deliberately has no web, database, or project-specific dependency.
Questions and responses can therefore come from fixtures now and adapters later.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Iterable, Mapping, Sequence


class AssessmentType(str, Enum):
    DIAGNOSTIC = "diagnostic"
    REASSESSMENT = "reassessment"
    GENERAL = "general"
    PRACTICE = "practice"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


ASSESSMENT_WEIGHTS: Mapping[AssessmentType, float] = {
    AssessmentType.DIAGNOSTIC: 1.0,
    AssessmentType.REASSESSMENT: 1.0,
    AssessmentType.GENERAL: 0.5,
    AssessmentType.PRACTICE: 0.3,
}

# Difficulty affects evidence in opposite directions for correct and incorrect
# answers: a hard success is stronger evidence, while a hard failure is weaker.
DIFFICULTY_WEIGHTS: Mapping[Difficulty, tuple[float, float]] = {
    Difficulty.EASY: (0.75, 1.25),
    Difficulty.MEDIUM: (1.0, 1.0),
    Difficulty.HARD: (1.25, 0.75),
}


class AssessmentError(ValueError):
    """Base error for malformed assessment inputs."""


class QuestionValidationError(AssessmentError):
    """Raised when a question definition is invalid."""


class ResponseValidationError(AssessmentError):
    """Raised when a response cannot safely be evaluated."""


def _enum_value(value: str | Enum, enum_type: type[Enum], field: str) -> Enum:
    try:
        return value if isinstance(value, enum_type) else enum_type(value)
    except (TypeError, ValueError) as exc:
        raise AssessmentError(f"invalid {field}: {value!r}") from exc


@dataclass(frozen=True)
class QuestionOption:
    id: str
    text: str

    def __post_init__(self) -> None:
        if not self.id:
            raise QuestionValidationError("option id cannot be empty")


@dataclass(frozen=True)
class Question:
    id: str
    concept_id: str
    difficulty: Difficulty | str
    prompt: str
    options: Sequence[QuestionOption]
    correct_option_id: str
    expected_time_seconds: int | None = None

    def __post_init__(self) -> None:
        if not self.id or not self.concept_id:
            raise QuestionValidationError("question id and concept id are required")
        if not self.prompt:
            raise QuestionValidationError("question prompt cannot be empty")
        difficulty = _enum_value(self.difficulty, Difficulty, "difficulty")
        object.__setattr__(self, "difficulty", difficulty)
        options = tuple(self.options)
        if not options:
            raise QuestionValidationError("a question needs at least one option")
        option_ids = [option.id for option in options]
        if len(option_ids) != len(set(option_ids)):
            raise QuestionValidationError("question option ids must be unique")
        if self.correct_option_id not in option_ids:
            raise QuestionValidationError("correct option must belong to the question")
        if self.expected_time_seconds is not None and self.expected_time_seconds <= 0:
            raise QuestionValidationError("expected time must be positive")
        object.__setattr__(self, "options", options)

    def public_view(self) -> dict[str, object]:
        """Return a question safe to send before the learner responds."""
        return {
            "id": self.id,
            "concept_id": self.concept_id,
            "difficulty": self.difficulty.value,
            "prompt": self.prompt,
            "options": [{"id": option.id, "text": option.text} for option in self.options],
            "expected_time_seconds": self.expected_time_seconds,
        }


def serialize_public_question(question: Question) -> dict[str, object]:
    """Serialize a question without leaking correctness metadata."""
    return question.public_view()


@dataclass(frozen=True)
class Response:
    question_id: str
    selected_option_id: str
    response_time_ms: int | None = None
    hints_used: int | None = None
    retry_count: int | None = None
    answered_at: datetime | None = None
    assessment_type: AssessmentType | str = AssessmentType.GENERAL

    def __post_init__(self) -> None:
        if not self.question_id or not self.selected_option_id:
            raise ResponseValidationError("question id and selected option are required")
        assessment_type = _enum_value(self.assessment_type, AssessmentType, "assessment type")
        object.__setattr__(self, "assessment_type", assessment_type)
        for name in ("response_time_ms", "hints_used", "retry_count"):
            value = getattr(self, name)
            if value is not None and (not isinstance(value, int) or isinstance(value, bool) or value < 0):
                raise ResponseValidationError(f"{name} must be a non-negative integer")


@dataclass(frozen=True)
class EvaluatedResponse:
    response: Response
    question: Question
    is_correct: bool
    effective_weight: float

    @property
    def concept_id(self) -> str:
        return self.question.concept_id


@dataclass(frozen=True)
class ConceptEvidence:
    concept_id: str
    response_count: int
    correct_count: int
    effective_evidence: float
    overall_accuracy: float
    difficulty_weighted_accuracy: float
    recent_accuracy_5: float | None
    recent_failure_rate: float | None
    hard_accuracy: float | None
    hint_usage_rate: float | None
    mean_retry_count: float | None
    mean_response_time_ratio: float | None
    improvement_slope: float | None
    high_quality_evidence_share: float
    reassessment_delta: float | None
    difficulty_band_coverage: float
    missing_features: tuple[str, ...]


class AssessmentService:
    """Validate responses and aggregate them into concept-level evidence."""

    def __init__(self, questions: Iterable[Question]) -> None:
        question_list = tuple(questions)
        question_ids = [question.id for question in question_list]
        if len(question_ids) != len(set(question_ids)):
            raise QuestionValidationError("question ids must be unique")
        self._questions = {question.id: question for question in question_list}

    @property
    def questions(self) -> tuple[Question, ...]:
        return tuple(self._questions.values())

    def public_questions(self, question_ids: Iterable[str] | None = None) -> list[dict[str, object]]:
        selected = self.questions if question_ids is None else tuple(
            self._get_question(question_id) for question_id in question_ids
        )
        return [serialize_public_question(question) for question in selected]

    def evaluate_response(
        self,
        response: Response,
        assigned_question_ids: Iterable[str] | None = None,
    ) -> EvaluatedResponse:
        if assigned_question_ids is not None and response.question_id not in set(assigned_question_ids):
            raise ResponseValidationError("question is not assigned to this assessment")
        question = self._get_question(response.question_id)
        if response.selected_option_id not in {option.id for option in question.options}:
            raise ResponseValidationError("selected option does not belong to the question")
        is_correct = response.selected_option_id == question.correct_option_id
        assessment_weight = ASSESSMENT_WEIGHTS[response.assessment_type]
        correct_weight, incorrect_weight = DIFFICULTY_WEIGHTS[question.difficulty]
        difficulty_weight = correct_weight if is_correct else incorrect_weight
        return EvaluatedResponse(response, question, is_correct, assessment_weight * difficulty_weight)

    def aggregate_evidence(
        self,
        responses: Iterable[Response | EvaluatedResponse],
        assigned_question_ids: Iterable[str] | None = None,
    ) -> dict[str, ConceptEvidence]:
        evaluated = [
            item
            if isinstance(item, EvaluatedResponse)
            else self.evaluate_response(item, assigned_question_ids)
            for item in responses
        ]
        grouped: dict[str, list[EvaluatedResponse]] = {}
        for item in evaluated:
            grouped.setdefault(item.concept_id, []).append(item)
        return {concept_id: self._summarize(concept_id, items) for concept_id, items in grouped.items()}

    def _get_question(self, question_id: str) -> Question:
        try:
            return self._questions[question_id]
        except KeyError as exc:
            raise ResponseValidationError(f"unknown question: {question_id}") from exc

    @staticmethod
    def _summarize(concept_id: str, items: list[EvaluatedResponse]) -> ConceptEvidence:
        ordered = sorted(
            items,
            key=lambda item: item.response.answered_at or datetime.min,
        )
        weighted_correct = sum(item.effective_weight for item in items if item.is_correct)
        total_weight = sum(item.effective_weight for item in items)
        recent = ordered[-5:]
        hard = [item for item in items if item.question.difficulty is Difficulty.HARD]
        known_hints = [item for item in items if item.response.hints_used is not None]
        known_retries = [item for item in items if item.response.retry_count is not None]
        timed = [
            item
            for item in items
            if item.response.response_time_ms is not None
            and item.question.expected_time_seconds is not None
        ]
        reassessment = [item for item in items if item.response.assessment_type is AssessmentType.REASSESSMENT]
        baseline = [item for item in items if item.response.assessment_type is not AssessmentType.REASSESSMENT]
        missing: list[str] = []
        if not timed:
            missing.append("response_time")
        if not known_hints:
            missing.append("hint_evidence")
        if not known_retries:
            missing.append("retry_evidence")
        high_quality_weight = sum(
            item.effective_weight
            for item in items
            if item.response.assessment_type in (AssessmentType.DIAGNOSTIC, AssessmentType.REASSESSMENT)
        )
        coverage = len({item.question.difficulty for item in items}) / len(Difficulty)
        return ConceptEvidence(
            concept_id=concept_id,
            response_count=len(items),
            correct_count=sum(item.is_correct for item in items),
            effective_evidence=total_weight,
            overall_accuracy=sum(item.is_correct for item in items) / len(items),
            difficulty_weighted_accuracy=weighted_correct / total_weight,
            recent_accuracy_5=(sum(item.is_correct for item in recent) / len(recent)) if recent else None,
            recent_failure_rate=(1 - sum(item.is_correct for item in recent) / len(recent)) if recent else None,
            hard_accuracy=(sum(item.is_correct for item in hard) / len(hard)) if hard else None,
            hint_usage_rate=(sum(item.response.hints_used > 0 for item in known_hints) / len(known_hints))
            if known_hints
            else None,
            mean_retry_count=(sum(item.response.retry_count for item in known_retries) / len(known_retries))
            if known_retries
            else None,
            mean_response_time_ratio=(
                sum(item.response.response_time_ms / (item.question.expected_time_seconds * 1000) for item in timed)
                / len(timed)
            )
            if timed
            else None,
            improvement_slope=_slope(ordered),
            high_quality_evidence_share=(high_quality_weight / total_weight) if total_weight else 0.0,
            reassessment_delta=(
                sum(item.is_correct for item in reassessment) / len(reassessment)
                - sum(item.is_correct for item in baseline) / len(baseline)
            )
            if reassessment and baseline
            else None,
            difficulty_band_coverage=coverage,
            missing_features=tuple(missing),
        )


def _slope(items: Sequence[EvaluatedResponse]) -> float | None:
    if len(items) < 2:
        return None
    values = [float(item.is_correct) for item in items]
    n = len(values)
    x_sum = n * (n - 1) / 2
    x2_sum = (n - 1) * n * (2 * n - 1) / 6
    y_sum = sum(values)
    xy_sum = sum(index * value for index, value in enumerate(values))
    denominator = n * x2_sum - x_sum * x_sum
    return (n * xy_sum - x_sum * y_sum) / denominator
