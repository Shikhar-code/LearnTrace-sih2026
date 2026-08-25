"""
TutorService — application logic layer for the AI Tutor.

Responsibility
--------------
Accept a validated TutorContext and return a TutorResponse.

Pipeline (Phase 2 / Phase 3)
-----------------------------
    TutorService.explain()
        ↓
    If TUTOR_MOCK_MODE=true  →  _generate_mock()   (no LLM, deterministic)
    If TUTOR_MOCK_MODE=false →  _generate_with_llm()
                                    ↓
                                PromptService (build_tutor_prompt)
                                    ↓
                                LLMService.generate()
                                    ↓
                                GeminiProvider
                                    ↓
                                Validated TutorResponse

The API route and TutorResponse schema are unchanged from Phase 1.

Phase 3 changes
---------------
- _generate_with_llm() passes the original question text to LLMService
  so the response validator can reject identical practice questions.
- _generate_mock() is fully context-aware: all fields reference the
  actual competency, learner answer, and correct answer from the context.
  No subject-specific content is hard-coded.
"""

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.prompts.tutor import TUTOR_SYSTEM_PROMPT, build_tutor_prompt
from app.schemas.tutor import PracticeQuestion, TutorContext, TutorResponse
from app.services.llm_service import LLMService

logger = get_logger(__name__)

# Single LLMService instance — stateless, safe to share across requests.
_llm_service = LLMService()


class TutorService:
    """Orchestrates the tutoring pipeline for a single interaction."""

    def explain(self, context: TutorContext) -> TutorResponse:
        """
        Generate a tutoring response for the given context.

        Parameters
        ----------
        context:
            Validated TutorContext supplied by the LearnTrace backend.

        Returns
        -------
        TutorResponse
            Structured tutoring output.

        Raises
        ------
        LLMMisconfiguredError
            If real mode is requested but the LLM is not configured.
        LLMProviderError
            If the LLM provider call fails.
        LLMResponseError
            If the LLM returns an unrecoverable malformed response.
        """
        logger.debug(
            "TutorService.explain | mock=%s competency=%s question=%s",
            settings.TUTOR_MOCK_MODE,
            context.competency.id,
            context.question.id,
        )

        if settings.TUTOR_MOCK_MODE:
            logger.debug("Mock mode enabled — returning placeholder response.")
            return self._generate_mock(context)

        return self._generate_with_llm(context)

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _generate_with_llm(self, context: TutorContext) -> TutorResponse:
        """
        Build prompts and call the LLM service to produce a real response.

        The original question text is forwarded so the response validator
        can reject a practice question that is identical to the original.
        """
        system_prompt = TUTOR_SYSTEM_PROMPT
        user_prompt = build_tutor_prompt(context)

        logger.info(
            "Calling LLM | competency=%s question=%s",
            context.competency.id,
            context.question.id,
        )

        return _llm_service.generate(
            system_prompt,
            user_prompt,
            original_question_text=context.question.text,
        )

    def _generate_mock(self, context: TutorContext) -> TutorResponse:
        """
        Return a deterministic mock TutorResponse without calling any LLM.

        Phase 3: fully context-aware — all fields are derived from the
        supplied TutorContext rather than from hard-coded subject content.
        This makes mock mode representative for any competency or subject.

        Guarantees
        ----------
        - explanation references learner_answer and correct_answer.
        - simple_explanation references competency.name.
        - worked_example references competency.name and correct_answer.
        - practice_question references competency.name and is structurally
          distinct from the original question.
        - All fields meet the response validator's minimum length floors.
        - practice_question has exactly four distinct options with a valid
          correct_option.
        """
        competency_name = context.competency.name
        correct_answer = context.correct_answer
        learner_answer = context.learner_answer
        gap_description = (
            context.detected_gap.description
            if context.detected_gap
            else f"a conceptual confusion within {competency_name}"
        )

        return TutorResponse(
            explanation=(
                f"You chose '{learner_answer}', but the correct answer is "
                f"'{correct_answer}'. The distinction here matters for "
                f"**{competency_name}**: {gap_description}. "
                f"Understanding why '{learner_answer}' does not fit — and why "
                f"'{correct_answer}' does — is the key insight this question is testing."
            ),
            simple_explanation=(
                f"In **{competency_name}**, it is important to be precise about "
                f"definitions. The option '{correct_answer}' is correct because it "
                f"captures the specific meaning the concept requires, while "
                f"'{learner_answer}' describes something related but distinct. "
                f"Keeping these definitions clear will help you answer similar "
                f"questions confidently."
            ),
            worked_example=(
                f"Here is a concrete example to illustrate **{competency_name}**: "
                f"Imagine a researcher designing a study. They encounter exactly the "
                f"kind of distinction this question is testing — the difference between "
                f"'{learner_answer}' and '{correct_answer}'. "
                f"In practice, confusing these two leads to errors in study design or "
                f"interpretation. Recognising which concept applies in context is a "
                f"core skill in {competency_name}."
            ),
            practice_question=PracticeQuestion(
                question=(
                    f"In the context of {competency_name}, which of the following "
                    f"statements about '{correct_answer}' is most accurate?"
                ),
                options=[
                    f"It is the same concept as '{learner_answer}'",
                    f"It is the correct term for this situation in {competency_name}",
                    f"It applies only in advanced cases of {competency_name}",
                    f"It is unrelated to {competency_name}",
                ],
                correct_option=(
                    f"It is the correct term for this situation in {competency_name}"
                ),
                explanation=(
                    f"In {competency_name}, '{correct_answer}' has a precise and "
                    f"distinct meaning that sets it apart from '{learner_answer}'. "
                    f"Choosing the right term in context is central to applying "
                    f"the concept correctly."
                ),
            ),
        )
