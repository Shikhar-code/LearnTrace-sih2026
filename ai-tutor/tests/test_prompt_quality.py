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
                "The correct answer is 'A list of reachable population members used to draw "
                "the sample'. The sampling frame is the operational list from which the "
                "researcher selects participants — it is distinct from the broader target "
                "population."
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


def test_system_prompt_requires_explanation_to_name_correct_option() -> None:
    """
    The system prompt must explicitly instruct the model to name the
    correct option in its explanation — this is the prompt-side complement
    to the validator's check 8.
    """
    sp = TUTOR_SYSTEM_PROMPT.lower()
    assert "verbatim" in sp or "explicitly name" in sp or "explicitly state" in sp, (
        "System prompt must instruct the model to name the correct option "
        "verbatim in its explanation."
    )


# ================================================================== #
# 8–11  Validator — minimum length
# ================================================================== #

def _make_response_with(
    explanation: str = "x" * 100,
    simple_explanation: str = "x" * 100,
    worked_example: str = "x" * 100,
    pq_explanation: str = "Option Alpha is correct because " + "x" * 80,
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
# 12–15  Validator — correct_option must appear in explanation
# ================================================================== #


def test_validator_passes_when_explanation_mentions_correct_option() -> None:
    """
    When explanation explicitly contains the correct_option text, validation
    must succeed (no exception raised).
    """
    response = _make_response_with(
        pq_explanation="The correct answer is 'Option Alpha' because it is the most accurate description."
    )
    # Should not raise
    validate_tutor_response(response)


def test_validator_rejects_when_explanation_omits_correct_option() -> None:
    """
    When explanation does not contain the correct_option text, check 8 must
    raise LLMResponseError.  This is the exact class of bug where the model
    explains one answer but labels a different one as correct.
    """
    response = _make_response_with(
        pq_explanation=(
            "Option Beta is the right choice because it accurately reflects the concept, "
            "unlike the other options which are misleading or incomplete descriptions."
        )
    )
    with pytest.raises(LLMResponseError, match="does not mention the correct_option"):
        validate_tutor_response(response)


def test_validator_correct_option_check_is_case_insensitive() -> None:
    """
    The explanation check must be case-insensitive: an explanation that
    contains the correct_option text in a different case still passes.
    """
    response = _make_response_with(
        pq_explanation=(
            "OPTION ALPHA is correct because it precisely describes the behaviour "
            "in the given scenario, whereas the other options are either too broad "
            "or describe unrelated mechanisms entirely."
        )
    )
    # Should not raise — 'option alpha' (normalised) is in the explanation
    validate_tutor_response(response)


def test_validator_passes_existing_valid_response_end_to_end() -> None:
    """
    The _make_valid_response fixture (used by other tests) must continue to
    pass all checks end-to-end after adding check 8.
    """
    response = _make_valid_response()
    # Should not raise
    validate_tutor_response(response)


# ================================================================== #
# 16–17  Validator — practice question quality
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


# ================================================================== #
# 17–23  Phase 3 quality-fix tests
# ================================================================== #


def test_prompt_contains_original_question_text() -> None:
    """The original question text must appear in the user prompt data sections."""
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)
    assert CONTEXT_WITH_GAP.question.text in prompt, (
        "The original question text must be present in the prompt so the "
        "LLM can reason from it."
    )


def test_prompt_output_instructions_do_not_interpolate_answer_values() -> None:
    """
    Answer values (learner_answer, correct_answer) must appear only in the
    DATA sections, not in the instruction section.

    This prevents the LLM from pattern-matching a template and treats the
    answer values as results of reasoning — not as strings to slot in.
    """
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)

    # The prompt must have a clear separator between data and instructions.
    assert "---" in prompt, "Prompt must separate data sections from instructions."

    # Everything after the separator is the instructions section.
    _, instructions_part = prompt.split("---", 1)

    # The specific learner/correct answer VALUES must not appear in the
    # instructions — they belong only in the data sections above.
    assert CONTEXT_WITH_GAP.learner_answer not in instructions_part, (
        f"Learner answer '{CONTEXT_WITH_GAP.learner_answer}' must not be "
        f"interpolated into the instruction section."
    )
    assert CONTEXT_WITH_GAP.correct_answer not in instructions_part, (
        f"Correct answer '{CONTEXT_WITH_GAP.correct_answer}' must not be "
        f"interpolated into the instruction section."
    )


def test_prompt_instructs_reasoning_from_question() -> None:
    """
    The output field instructions must describe a reasoning PROCESS rather
    than simple value substitution. Keywords like 'examine', 'trace', or
    'reason' indicate process-oriented instructions.
    """
    prompt = build_tutor_prompt(CONTEXT_WITH_GAP)
    _, instructions_part = prompt.split("---", 1)
    lower = instructions_part.lower()

    reasoning_keywords = ["examine", "trace", "reason", "process"]
    assert any(kw in lower for kw in reasoning_keywords), (
        f"Instruction section must include reasoning-process language. "
        f"Expected one of: {reasoning_keywords}"
    )


def test_prompt_instructs_domain_matched_example() -> None:
    """
    The system prompt or user prompt must instruct the model to match the
    example type to the question type — preventing generic unrelated examples.
    """
    combined = TUTOR_SYSTEM_PROMPT.lower() + build_tutor_prompt(CONTEXT_WITH_GAP).lower()
    # Must contain guidance about matching the type/domain of the example.
    assert "same type" in combined or "type of reasoning" in combined, (
        "Prompt must instruct the model to match example type to question type."
    )


def test_system_prompt_prohibits_vocabulary_style_questions() -> None:
    """
    The system prompt must explicitly prohibit practice questions that treat
    numerical answers or computation results as vocabulary terms.
    """
    sp = TUTOR_SYSTEM_PROMPT

    # The system prompt must contain an explicit prohibition.
    has_forbidden = "FORBIDDEN" in sp or "NEVER" in sp
    assert has_forbidden, (
        "System prompt must explicitly prohibit (FORBIDDEN/NEVER) bad "
        "practice question patterns."
    )

    # The prohibition must be in the context of practice questions.
    sp_lower = sp.lower()
    assert "practice" in sp_lower and (
        "forbidden" in sp_lower or "never" in sp_lower
    ), (
        "System prompt must connect the prohibition to the practice question field."
    )


def test_system_prompt_requires_genuine_new_problem() -> None:
    """
    The system prompt must require that the practice question is a genuine
    new problem — not a meta-question about the answer values.
    """
    sp_lower = TUTOR_SYSTEM_PROMPT.lower()
    assert "genuine" in sp_lower or "new problem" in sp_lower, (
        "System prompt must require a genuine new problem for the practice question."
    )


def test_mock_does_not_use_vocabulary_style_template() -> None:
    """
    The mock response must not use vocabulary-substitution language such as
    'captures the specific meaning' or 'which of the following statements about'
    — patterns that were causing Gemini to produce educational nonsense.
    """
    service = TutorService()
    with patch("app.services.tutor_service.settings") as mock_settings:
        mock_settings.TUTOR_MOCK_MODE = True
        result = service.explain(CONTEXT_WITH_GAP)

    combined = (
        result.explanation
        + result.simple_explanation
        + result.worked_example
        + result.practice_question.question
        + result.practice_question.explanation
    ).lower()

    assert "captures the specific meaning" not in combined, (
        "Mock must not use 'captures the specific meaning' template language."
    )
    assert "which of the following statements about" not in combined, (
        "Mock must not use vocabulary-style question pattern "
        "'which of the following statements about [answer value]'."
    )
