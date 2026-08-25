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

        Phase 3 (revised): uses clearly marked [MOCK] placeholder language so
        that the mock output cannot be mistaken for genuine tutoring content
        and cannot prime a real LLM with vocabulary-style template patterns.

        All fields still reference the actual competency, question, learner
        answer, and correct answer from the supplied TutorContext, making the
        mock representative for any domain or question type.

        Guarantees
        ----------
        - All fields meet the response validator's minimum length floors.
        - practice_question has exactly four distinct options with a valid
          correct_option that is different from the original question text.
        - No vocabulary-substitution patterns that could mislead a real LLM.
        """
        competency_name = context.competency.name
        correct_answer = context.correct_answer
        learner_answer = context.learner_answer
        question_text = context.question.text

        return TutorResponse(
            explanation=(
                f"[MOCK] This is placeholder output for testing purposes. "
                f"A real LLM response would examine the question "
                f"'{question_text}', trace through the reasoning that leads "
                f"to '{learner_answer}', identify the specific error, and explain "
                f"why '{correct_answer}' is correct using the actual logic of the problem."
            ),
            simple_explanation=(
                f"[MOCK] A real LLM response would explain the core rule or principle "
                f"of **{competency_name}** that this question is testing. "
                f"It would describe the concept in plain, jargon-free language "
                f"suitable for a learner encountering it for the first time."
            ),
            worked_example=(
                f"[MOCK] A real LLM response would provide a concrete example that "
                f"uses the same type of reasoning as the original question. "
                f"For a calculation question it would show a similar calculation with "
                f"intermediate steps. For a conceptual question it would give a relevant "
                f"real-world scenario. The example would reinforce the distinction "
                f"between '{learner_answer}' and '{correct_answer}' in {competency_name}."
            ),
            practice_question=PracticeQuestion(
                question=(
                    f"[MOCK] A real LLM response would generate a genuine new problem "
                    f"for {competency_name} — not a meta-question about the answer values."
                ),
                options=[
                    "[MOCK] Option A — placeholder",
                    "[MOCK] Option B — placeholder",
                    "[MOCK] Option C — placeholder",
                    "[MOCK] Option D — placeholder",
                ],
                correct_option="[MOCK] Option A — placeholder",
                explanation=(
                    f"[MOCK] A real response would explain why the correct answer "
                    f"follows from the same reasoning as the original question "
                    f"about {competency_name}."
                ),
            ),
        )
