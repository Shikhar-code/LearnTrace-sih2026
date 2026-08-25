"""
TutorService — application logic layer for the AI Tutor.

Responsibility
--------------
Accept a validated TutorContext and return a TutorResponse.

Pipeline (Phase 2)
------------------
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
        """
        system_prompt = TUTOR_SYSTEM_PROMPT
        user_prompt = build_tutor_prompt(context)

        logger.info(
            "Calling LLM | competency=%s question=%s",
            context.competency.id,
            context.question.id,
        )

        return _llm_service.generate(system_prompt, user_prompt)

    def _generate_mock(self, context: TutorContext) -> TutorResponse:
        """
        Return a deterministic mock TutorResponse without calling any LLM.

        - Safe for all tests and local development without a Gemini key.
        - Uses the same TutorResponse schema as the real LLM path.
        - Incorporates context fields so tests can verify contextual content.
        """
        competency_name = context.competency.name
        correct_answer = context.correct_answer
        learner_answer = context.learner_answer
        gap_description = (
            context.detected_gap.description
            if context.detected_gap
            else "a conceptual gap in this area"
        )

        return TutorResponse(
            explanation=(
                f"You selected '{learner_answer}', but the correct answer is "
                f"'{correct_answer}'. This question tests your understanding of "
                f"**{competency_name}**. The issue appears to be {gap_description}. "
                "Review the core definition and how it differs from related concepts."
            ),
            simple_explanation=(
                f"Think of **{competency_name}** this way: it is the specific subset "
                "of the population that you can actually reach and list. "
                "Your chosen answer describes something slightly different. "
                "Keep this distinction in mind when you see similar questions."
            ),
            worked_example=(
                f"Worked example for **{competency_name}**: "
                "Suppose a researcher wants to study university students in a city. "
                "The *population* is all university students in that city. "
                "The *sampling frame* is the actual list of students obtained from "
                "university enrollment records — only those who are registered and "
                "can be contacted. Notice how the sampling frame may exclude some "
                "students (e.g., those enrolled but not yet in the records). "
                "This distinction is what the question is testing."
            ),
            practice_question=PracticeQuestion(
                question=(
                    "A researcher studies employed adults in a city by obtaining a "
                    "list from the local employment office. What does this list represent?"
                ),
                options=[
                    "The target population",
                    "The sampling frame",
                    "The sample",
                    "The census",
                ],
                correct_option="The sampling frame",
                explanation=(
                    "The employment-office list is the **sampling frame** — the "
                    "operational list from which the researcher will draw the sample. "
                    "It represents the reachable subset of the broader population "
                    "(all employed adults in the city)."
                ),
            ),
        )
