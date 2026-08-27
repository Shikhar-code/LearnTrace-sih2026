"""
Response validation for AI Tutor LLM output.

Validates that the TutorResponse from the LLM meets quality rules
beyond what Pydantic schema validation alone can enforce:

  - All text fields are non-empty.
  - All text fields meet minimum substantive length.
  - The practice question has exactly four options.
  - Options are distinct (no duplicates).
  - The correct_option is one of the listed options.
  - The practice question explanation is non-empty.
  - The practice question explanation explicitly mentions the correct_option text.
  - The practice question is not identical to the original question (when provided).

Raises LLMResponseError for any violation so the caller can decide
whether to retry or return an application-level error.
"""

from app.core.exceptions import LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorResponse

logger = get_logger(__name__)

_REQUIRED_PRACTICE_QUESTION_OPTIONS = 4

# Minimum substantive character counts per field (stripped).
# These are loose floors that catch degenerate one-word outputs
# without prescribing a specific style or verbosity.
_MIN_CHARS_EXPLANATION = 80
_MIN_CHARS_SIMPLE_EXPLANATION = 60
_MIN_CHARS_WORKED_EXAMPLE = 80
_MIN_CHARS_PRACTICE_EXPLANATION = 40


def validate_tutor_response(
    response: TutorResponse,
    original_question_text: str = "",
) -> None:
    """
    Validate a TutorResponse beyond Pydantic's schema checks.

    Parameters
    ----------
    response:
        A TutorResponse that has already passed Pydantic validation.
    original_question_text:
        Optional. The original question text from the TutorContext.
        When supplied, the validator will reject a practice question
        that is exactly identical to the original (after normalisation).

    Raises
    ------
    LLMResponseError
        If any semantic validation rule is violated.
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

    logger.debug("TutorResponse validation passed.")


# ------------------------------------------------------------------ #
# Private helpers
# ------------------------------------------------------------------ #


def _require_non_empty(value: str, field_name: str) -> None:
    """Raise LLMResponseError if value is empty or whitespace-only."""
    if not value or not value.strip():
        raise LLMResponseError(f"Field '{field_name}' is empty in LLM response.")


def _require_min_length(value: str, field_name: str, min_chars: int) -> None:
    """
    Raise LLMResponseError if the stripped value is shorter than min_chars.

    This catches degenerate one-word or placeholder outputs without
    being prescriptive about writing style or maximum length.
    """
    actual = len(value.strip())
    if actual < min_chars:
        raise LLMResponseError(
            f"Field '{field_name}' is too short: {actual} chars "
            f"(minimum {min_chars})."
        )


def _reject_if_identical_to_original(
    practice_question: str, original: str
) -> None:
    """
    Raise LLMResponseError if the practice question is exactly identical
    to the original question after whitespace normalisation and lower-casing.

    Only exact matches are rejected. Semantic similarity detection is an
    LLM-quality concern and is out of scope here.
    """
    def _normalise(text: str) -> str:
        return " ".join(text.strip().lower().split())

    if _normalise(practice_question) == _normalise(original):
        raise LLMResponseError(
            "practice_question.question is identical to the original question. "
            "The practice question must be meaningfully different."
        )


def _require_correct_option_in_explanation(
    correct_option: str, explanation: str
) -> None:
    """
    Raise LLMResponseError if the correct_option text does not appear in the
    practice question explanation.

    Comparison is case-insensitive with whitespace normalised so that minor
    formatting differences (extra spaces, different casing) do not cause
    false rejections.

    This is a deliberate simple string-containment check — not semantic
    analysis.  Its purpose is to catch the specific class of contradiction
    where the model writes an explanation for answer X but labels answer Y
    as correct_option.
    """
    def _normalise(text: str) -> str:
        return " ".join(text.strip().lower().split())

    if _normalise(correct_option) not in _normalise(explanation):
        raise LLMResponseError(
            f"practice_question.explanation does not mention the correct_option. "
            f"The explanation must explicitly state why '{correct_option}' is correct."
        )
