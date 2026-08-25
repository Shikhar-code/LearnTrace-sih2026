"""
Response validation for AI Tutor LLM output.

Validates that the TutorResponse from the LLM meets quality rules
beyond what Pydantic schema validation alone can enforce:

  - All text fields are non-empty.
  - The practice question has exactly four options.
  - Options are distinct (no duplicates).
  - The correct_option is one of the listed options.
  - The practice question explanation is non-empty.

Raises LLMResponseError for any violation so the caller can decide
whether to retry or return an application-level error.
"""

from app.core.exceptions import LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorResponse

logger = get_logger(__name__)

_REQUIRED_PRACTICE_QUESTION_OPTIONS = 4


def validate_tutor_response(response: TutorResponse) -> None:
    """
    Validate a TutorResponse beyond Pydantic's schema checks.

    Parameters
    ----------
    response:
        A TutorResponse that has already passed Pydantic validation.

    Raises
    ------
    LLMResponseError
        If any semantic validation rule is violated.
    """
    _require_non_empty(response.explanation, "explanation")
    _require_non_empty(response.simple_explanation, "simple_explanation")
    _require_non_empty(response.worked_example, "worked_example")

    pq = response.practice_question
    _require_non_empty(pq.question, "practice_question.question")
    _require_non_empty(pq.correct_option, "practice_question.correct_option")
    _require_non_empty(pq.explanation, "practice_question.explanation")

    # Exactly four options
    num_options = len(pq.options)
    if num_options != _REQUIRED_PRACTICE_QUESTION_OPTIONS:
        raise LLMResponseError(
            f"practice_question must have exactly "
            f"{_REQUIRED_PRACTICE_QUESTION_OPTIONS} options, got {num_options}."
        )

    # All options non-empty
    for i, opt in enumerate(pq.options):
        if not opt.strip():
            raise LLMResponseError(
                f"practice_question.options[{i}] is empty."
            )

    # No duplicate options
    stripped = [opt.strip() for opt in pq.options]
    if len(set(stripped)) != len(stripped):
        raise LLMResponseError(
            "practice_question.options contains duplicate entries."
        )

    # correct_option must be one of the options
    if pq.correct_option.strip() not in stripped:
        raise LLMResponseError(
            f"practice_question.correct_option '{pq.correct_option}' "
            f"does not match any of the listed options: {pq.options}"
        )

    logger.debug("TutorResponse validation passed.")


def _require_non_empty(value: str, field_name: str) -> None:
    """Raise LLMResponseError if value is empty or whitespace-only."""
    if not value or not value.strip():
        raise LLMResponseError(f"Field '{field_name}' is empty in LLM response.")
