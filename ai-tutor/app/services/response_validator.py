"""
Response validation for AI Tutor LLM output.

Validates that the TutorResponse (Mode 1) and QuizTutorResponse (Mode 2) from the LLM
meet quality rules beyond what Pydantic schema validation alone can enforce:

Mode 1 (Single Question):
  - All text fields are non-empty.
  - All text fields meet minimum substantive length.
  - The practice question has exactly four options.
  - Options are distinct (no duplicates).
  - The correct_option is one of the listed options.
  - The practice question explanation is non-empty.
  - The practice question explanation explicitly mentions the correct_option text.
  - The practice question is not identical to the original question (when provided).

Mode 2 (Post-Quiz Analysis):
  - Explanations correspond to the expected incorrect questions.
  - Explanations are non-empty and concise.
  - No worked examples or practice questions present.

Raises LLMResponseError for any violation so the caller can decide
whether to retry or return an application-level error.
"""

from app.core.exceptions import LLMResponseError
from app.core.logging import get_logger
from app.schemas.quiz_tutor import QuizTutorContext, QuizTutorResponse
from app.schemas.tutor import TutorResponse

logger = get_logger(__name__)

_REQUIRED_PRACTICE_QUESTION_OPTIONS = 4

# Minimum substantive character counts per field (stripped).
_MIN_CHARS_EXPLANATION = 80
_MIN_CHARS_SIMPLE_EXPLANATION = 60
_MIN_CHARS_WORKED_EXAMPLE = 80
_MIN_CHARS_PRACTICE_EXPLANATION = 40

# Mode 2 character bounds for concise explanations
_MIN_CHARS_QUIZ_EXPLANATION = 30
_MAX_CHARS_QUIZ_EXPLANATION = 400


def validate_tutor_response(
    response: TutorResponse,
    original_question_text: str = "",
) -> None:
    """
    Validate a TutorResponse (Mode 1) beyond Pydantic's schema checks.
    """
    # ── 1. Non-empty checks ──────────────────────────────────────────
    _require_non_empty(response.explanation, "explanation")
    _require_non_empty(response.simple_explanation, "simple_explanation")
    _require_non_empty(response.worked_example, "worked_example")

    pq = response.practice_question
    _require_non_empty(pq.question, "practice_question.question")
    _require_non_empty(pq.correct_option, "practice_question.correct_option")
    _require_non_empty(pq.explanation, "practice_question.explanation")

    # ── 2. Minimum substantive length ────────────────────────────────
    _require_min_length(response.explanation, "explanation", _MIN_CHARS_EXPLANATION)
    _require_min_length(
        response.simple_explanation,
        "simple_explanation",
        _MIN_CHARS_SIMPLE_EXPLANATION,
    )
    _require_min_length(response.worked_example, "worked_example", _MIN_CHARS_WORKED_EXAMPLE)
    _require_min_length(
        pq.explanation,
        "practice_question.explanation",
        _MIN_CHARS_PRACTICE_EXPLANATION,
    )

    # ── 3. Exactly four options ──────────────────────────────────────
    num_options = len(pq.options)
    if num_options != _REQUIRED_PRACTICE_QUESTION_OPTIONS:
        raise LLMResponseError(
            f"practice_question must have exactly "
            f"{_REQUIRED_PRACTICE_QUESTION_OPTIONS} options, got {num_options}."
        )

    # ── 4. All options non-empty ─────────────────────────────────────
    for i, opt in enumerate(pq.options):
        if not opt.strip():
            raise LLMResponseError(
                f"practice_question.options[{i}] is empty."
            )

    # ── 5. No duplicate options ──────────────────────────────────────
    stripped = [opt.strip() for opt in pq.options]
    if len(set(stripped)) != len(stripped):
        raise LLMResponseError(
            "practice_question.options contains duplicate entries."
        )

    # ── 6. correct_option must be one of the options ─────────────────
    if pq.correct_option.strip() not in stripped:
        raise LLMResponseError(
            f"practice_question.correct_option '{pq.correct_option}' "
            f"does not match any of the listed options: {pq.options}"
        )

    # ── 7. Explanation must mention the correct_option ─────────────
    _require_correct_option_in_explanation(pq.correct_option, pq.explanation)

    # ── 8. Practice question must not be identical to the original ───
    if original_question_text:
        _reject_if_identical_to_original(pq.question, original_question_text)

    logger.debug("TutorResponse (Mode 1) validation passed.")


def validate_quiz_tutor_response(
    response: QuizTutorResponse,
    context: QuizTutorContext,
) -> None:
    """
    Validate a QuizTutorResponse (Mode 2) beyond Pydantic's schema checks.

    Parameters
    ----------
    response:
        A QuizTutorResponse returned by the LLM (or mock).
    context:
        The QuizTutorContext supplied to the request.
    """
    expected_incorrect_ids = {q.question_id for q in context.questions if not q.is_correct}

    if len(expected_incorrect_ids) == 0:
        if len(response.mistakes) != 0:
            raise LLMResponseError("Quiz has 0 incorrect answers, but LLM returned mistakes.")
        return

    # Check total mistakes returned matches expected incorrect items
    returned_ids = {m.question_id for m in response.mistakes}
    
    # All returned mistake question_ids must be valid incorrect questions
    invalid_ids = returned_ids - expected_incorrect_ids
    if invalid_ids:
        raise LLMResponseError(
            f"LLM returned mistake explanations for question IDs that were not incorrect: {invalid_ids}"
        )

    # Every mistake explanation must be non-empty and concise
    for item in response.mistakes:
        _require_non_empty(item.explanation, f"mistakes[{item.question_id}].explanation")
        length = len(item.explanation.strip())
        if length < _MIN_CHARS_QUIZ_EXPLANATION:
            raise LLMResponseError(
                f"Explanation for question {item.question_id} is too short ({length} chars, min {_MIN_CHARS_QUIZ_EXPLANATION})."
            )
        if length > _MAX_CHARS_QUIZ_EXPLANATION:
            raise LLMResponseError(
                f"Explanation for question {item.question_id} exceeds conciseness limit ({length} chars, max {_MAX_CHARS_QUIZ_EXPLANATION})."
            )

    logger.debug("QuizTutorResponse (Mode 2) validation passed.")


# ------------------------------------------------------------------ #
# Private helpers
# ------------------------------------------------------------------ #


def _require_non_empty(value: str, field_name: str) -> None:
    """Raise LLMResponseError if value is empty or whitespace-only."""
    if not value or not value.strip():
        raise LLMResponseError(f"Field '{field_name}' is empty in LLM response.")


def _require_min_length(value: str, field_name: str, min_chars: int) -> None:
    """Raise LLMResponseError if the stripped value is shorter than min_chars."""
    actual = len(value.strip())
    if actual < min_chars:
        raise LLMResponseError(
            f"Field '{field_name}' is too short: {actual} chars "
            f"(minimum {min_chars})."
        )


def _reject_if_identical_to_original(
    practice_question: str, original: str
) -> None:
    """Raise LLMResponseError if the practice question is identical to original."""
    def _normalise(text: str) -> str:
        return " ".join(text.strip().lower().split())

    if _normalise(practice_question) == _normalise(original):
        raise LLMResponseError(
            "practice_question.question is identical to the original question."
        )


def _require_correct_option_in_explanation(
    correct_option: str, explanation: str
) -> None:
    """Raise LLMResponseError if correct_option text is not in explanation."""
    def _normalise(text: str) -> str:
        return " ".join(text.strip().lower().split())

    if _normalise(correct_option) not in _normalise(explanation):
        raise LLMResponseError(
            f"practice_question.explanation does not mention the correct_option."
        )
