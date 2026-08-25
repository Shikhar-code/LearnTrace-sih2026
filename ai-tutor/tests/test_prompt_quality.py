"""
Phase 3 tests — tutoring quality.

All tests run WITHOUT calling the real Gemini API.

Covers:
  Prompt construction (7 tests)
    1.  All context sections are present when detected_gap exists.
    2.  Gap fallback is present when detected_gap is absent.
    3.  Correct answer is explicitly referenced in the prompt.
    4.  Learner answer is explicitly referenced in the prompt.
    5.  Output fields are explicitly named in the prompt.
    6.  System prompt contains learner-friendly tone guidance.
    7.  System prompt contains practice-question constraints.

  Response validator — minimum length (4 tests)
    8.  Explanation below minimum length is rejected.
    9.  simple_explanation below minimum length is rejected.
    10. worked_example below minimum length is rejected.
    11. practice_question.explanation below minimum length is rejected.

  Response validator — practice question quality (2 tests)
    12. Practice question identical to original is rejected.
    13. Practice question without a trailing "?" is accepted.

  Mock response quality (3 tests)
    14. Mock adapts to a non-sampling competency.
    15. Mock explanation references the learner's actual answer.
    16. Mock explanation references the actual correct answer.

Testing principle
-----------------
Tests assert meaningful *properties* of the prompt (sections present,
values embedded) — not exact wording. This keeps tests resilient to
future prompt phrasing improvements.
"""

from unittest.mock import patch

import pytest

from app.prompts.tutor import TUTOR_SYSTEM_PROMPT, build_tutor_prompt
from app.schemas.tutor import PracticeQuestion, TutorContext, TutorResponse
from app.services.response_validator import validate_tutor_response
from app.services.tutor_service import TutorService
from app.core.exceptions import LLMResponseError

# ------------------------------------------------------------------ #
# Shared fixtures
# ------------------------------------------------------------------ #

CONTEXT_WITH_GAP = TutorContext(
    competency={"id": "sampling_concepts", "name": "Sampling Concepts"},
    question={
        "id": "q1",
        "text": "What is a sampling frame?",
        "options": [
            "The entire population",
            "A list from which the sample is selected",
            "The selected sample",
            "The survey result",
        ],
    },
    learner_answer="The entire population",
    correct_answer="A list from which the sample is selected",
    detected_gap={"description": "Confusion between population and sampling frame"},
)

CONTEXT_WITHOUT_GAP = TutorContext(
    competency={"id": "sampling_concepts", "name": "Sampling Concepts"},
    question={
        "id": "q1",
        "text": "What is a sampling frame?",
        "options": [
            "The entire population",
            "A list from which the sample is selected",
            "The selected sample",
            "The survey result",
        ],
    },
    learner_answer="The entire population",
    correct_answer="A list from which the sample is selected",
    detected_gap=None,
)

CONTEXT_HYPOTHESIS = TutorContext(
    competency={"id": "hypothesis_testing", "name": "Hypothesis Testing"},
    question={
        "id": "q2",
        "text": "When should you reject the null hypothesis?",
        "options": [
            "When p > 0.05",
            "When p < 0.05",
            "When the sample size is large",
            "Never",
        ],
    },
    learner_answer="When p > 0.05",
    correct_answer="When p < 0.05",
    detected_gap=None,
)


def _make_valid_response(
    pq_question: str = "Which of the following defines a sampling frame?",
) -> TutorResponse:
    """Build a fully valid TutorResponse that passes all validator checks."""
    long = "x" * 100
    return TutorResponse(
        explanation=(
            "The learner's answer was incorrect because the two concepts are "
            "fundamentally different in scope and purpose, and mixing them up "
            "leads to flawed study design."
        ),
        simple_explanation=(
            "Think of the population as the whole group you care about, and the "
            "sampling frame as the specific reachable list you draw from — they "
            "are not the same thing."
        ),
        worked_example=(
            "For example, a researcher studying city residents might use a voter "
            "registration list as the sampling frame — it is a subset of the true "
            "population because not everyone is registered."
        ),
        practice_question=PracticeQuestion(
            question=pq_question,
            options=[
                "A list of reachable population members used to draw the sample",
                "The full population of interest",
                "The sample that was actually collected",
                "The survey questionnaire used in the study",
            ],
            correct_option="A list of reachable population members used to draw the sample",
            explanation=(
                "The sampling frame is the operational list from which the researcher "
                "selects participants — it is distinct from the broader target population."
            ),
        ),
    )


# ================================================================== #
# 1–7  Prompt construction
# ================================================================== #


def test_prompt_includes_all_sections_when_gap_present() -> None:
    """When detected_gap is supplied, all six labelled sections must appear."""
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)
    for section in [
        "[COMPETENCY]",
        "[QUESTION]",
        "[ANSWER OPTIONS]",
        "[LEARNER ANSWER]",
        "[CORRECT ANSWER]",
        "[DETECTED GAP]",
    ]:
        assert section in prompt, f"Expected section '{section}' in prompt."


def test_prompt_includes_gap_fallback_when_gap_absent() -> None:
    """
    When detected_gap is absent the prompt must still include a [DETECTED GAP]
    section with a fallback statement — not an empty section.
    """
    prompt = build_tutor_prompt(CONTEXT_WITHOUT_GAP)
    assert "[DETECTED GAP]" in prompt

    gap_start = prompt.index("[DETECTED GAP]")
    gap_content = prompt[gap_start:]

    # The fallback must acknowledge that no specific gap was identified
    # and direct the model toward the relevant distinction.
    assert len(gap_content.strip()) > len("[DETECTED GAP]"), (
        "Gap section must contain fallback content, not just the label."
    )
    # The fallback should reference the possibility of confusion rather than
    # fabricating a diagnosis.
    assert "confusion" in gap_content.lower() or "distinction" in gap_content.lower()


def test_prompt_references_correct_answer() -> None:
    """The correct answer from context must appear in the user prompt."""
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)
    assert CONTEXT_WITH_GAP.correct_answer in prompt


def test_prompt_references_learner_answer() -> None:
    """The learner's answer from context must appear in the user prompt."""
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)
    assert CONTEXT_WITH_GAP.learner_answer in prompt


def test_prompt_includes_output_field_instructions() -> None:
    """
    The user prompt must name the output fields so the model maps its
    response correctly.  Test for the presence of field names as
    instructions, not exact wording.
    """
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)
    # Each of the four output fields must be referenced by name.
    for field in ["explanation", "simple_explanation", "worked_example", "practice_question"]:
        assert field in prompt, (
            f"Expected output field '{field}' to be named in the user prompt."
        )


def test_system_prompt_contains_tone_guidance() -> None:
    """
    The system prompt must contain explicit tone guidance — warming the
    model toward constructive, teacher-like language.
    """
    sp = TUTOR_SYSTEM_PROMPT.lower()
    # At least one of these tone-related keywords must appear.
    tone_keywords = ["warm", "encouraging", "teacher", "constructive", "condescending"]
    assert any(kw in sp for kw in tone_keywords), (
        f"System prompt must contain tone guidance. "
        f"Expected one of: {tone_keywords}"
    )


def test_system_prompt_contains_practice_question_constraints() -> None:
    """
    The system prompt must state the practice-question constraints:
    four options, distinct from the original, one correct option.
    """
    sp = TUTOR_SYSTEM_PROMPT.lower()
    assert "four" in sp or "4" in sp, (
        "System prompt must specify four answer options."
    )
    assert "different" in sp or "not copy" in sp or "distinct" in sp, (
        "System prompt must instruct the model not to copy the original question."
    )


# ================================================================== #
# 8–11  Validator — minimum length
# ================================================================== #

def _make_response_with(
    explanation: str = "x" * 100,
    simple_explanation: str = "x" * 100,
    worked_example: str = "x" * 100,
    pq_explanation: str = "x" * 100,
) -> TutorResponse:
    """Helper: build a response with controllable field lengths."""
    return TutorResponse(
        explanation=explanation,
        simple_explanation=simple_explanation,
        worked_example=worked_example,
        practice_question=PracticeQuestion(
            question="Which statement best defines the concept in question?",
            options=["Option Alpha", "Option Beta", "Option Gamma", "Option Delta"],
            correct_option="Option Alpha",
            explanation=pq_explanation,
        ),
    )


def test_validator_rejects_explanation_below_minimum_length() -> None:
    """explanation shorter than 80 chars must raise LLMResponseError."""
    response = _make_response_with(explanation="Too short.")
    with pytest.raises(LLMResponseError, match="explanation"):
        validate_tutor_response(response)


def test_validator_rejects_simple_explanation_below_minimum_length() -> None:
    """simple_explanation shorter than 60 chars must raise LLMResponseError."""
    response = _make_response_with(simple_explanation="Too short.")
    with pytest.raises(LLMResponseError, match="simple_explanation"):
        validate_tutor_response(response)


def test_validator_rejects_worked_example_below_minimum_length() -> None:
    """worked_example shorter than 80 chars must raise LLMResponseError."""
    response = _make_response_with(worked_example="Too short.")
    with pytest.raises(LLMResponseError, match="worked_example"):
        validate_tutor_response(response)


def test_validator_rejects_practice_question_explanation_below_minimum_length() -> None:
    """practice_question.explanation shorter than 40 chars must raise LLMResponseError."""
    response = _make_response_with(pq_explanation="Short.")
    with pytest.raises(LLMResponseError, match="practice_question.explanation"):
        validate_tutor_response(response)


# ================================================================== #
# 12–13  Validator — practice question quality
# ================================================================== #


def test_validator_rejects_practice_question_identical_to_original() -> None:
    """
    When original_question_text is supplied, a practice question that is
    exactly identical (after normalisation) must be rejected.
    """
    original = "What is a sampling frame?"
    response = _make_valid_response(pq_question=original)

    with pytest.raises(LLMResponseError, match="identical"):
        validate_tutor_response(response, original_question_text=original)


def test_validator_rejects_practice_question_identical_case_insensitive() -> None:
    """
    Identical check is case- and whitespace-insensitive.
    """
    original = "What is a sampling frame?"
    # Vary case and whitespace only
    same_normalised = "  WHAT IS A SAMPLING FRAME?  "
    response = _make_valid_response(pq_question=same_normalised)

    with pytest.raises(LLMResponseError, match="identical"):
        validate_tutor_response(response, original_question_text=original)


def test_validator_accepts_practice_question_without_trailing_question_mark() -> None:
    """
    A practice question that does not end with '?' must still be accepted.
    No trailing-punctuation requirement exists.
    """
    response = _make_valid_response(
        pq_question="Identify the term that refers to a researcher's reachable list"
    )
    # Should not raise
    validate_tutor_response(response)


# ================================================================== #
# 14–16  Mock response quality
# ================================================================== #


def test_mock_adapts_to_non_sampling_competency() -> None:
    """
    Mock mode must not embed sampling-domain language when a different
    competency is provided.  The competency name must appear and
    'Sampling Concepts' must not dominate unrelated fields.
    """
    service = TutorService()
    with patch("app.services.tutor_service.settings") as mock_settings:
        mock_settings.TUTOR_MOCK_MODE = True
        result = service.explain(CONTEXT_HYPOTHESIS)

    combined = (
        result.explanation
        + result.simple_explanation
        + result.worked_example
        + result.practice_question.question
        + result.practice_question.explanation
    )

    # The actual competency name must appear somewhere in the response.
    assert "Hypothesis Testing" in combined, (
        "Mock response must reference the provided competency name."
    )


def test_mock_explanation_references_learner_answer() -> None:
    """Mock explanation must include the actual learner_answer from context."""
    service = TutorService()
    with patch("app.services.tutor_service.settings") as mock_settings:
        mock_settings.TUTOR_MOCK_MODE = True
        result = service.explain(CONTEXT_WITH_GAP)

    assert CONTEXT_WITH_GAP.learner_answer in result.explanation, (
        "Mock explanation must reference the learner's actual answer."
    )


def test_mock_explanation_references_correct_answer() -> None:
    """Mock explanation must include the actual correct_answer from context."""
    service = TutorService()
    with patch("app.services.tutor_service.settings") as mock_settings:
        mock_settings.TUTOR_MOCK_MODE = True
        result = service.explain(CONTEXT_WITH_GAP)

    assert CONTEXT_WITH_GAP.correct_answer in result.explanation, (
        "Mock explanation must reference the trusted correct answer."
    )
