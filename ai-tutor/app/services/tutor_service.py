"""
TutorService — application logic layer for the AI Tutor.

Responsibility
--------------
Accept a validated TutorContext and return a TutorResponse.

Phase 1 — Placeholder
----------------------
Returns a deterministic, hard-coded TutorResponse so that:
  - the API contract is fully exercisable without an LLM,
  - the service boundary is clearly established,
  - tests can verify response shape without network I/O.

Future phases
-------------
Replace _generate_placeholder() with a call to PromptService → LLMService
→ LLM Provider.  The route layer and TutorResponse schema remain unchanged.

    TutorService
        ↓
    PromptService        (builds the prompt from TutorContext)
        ↓
    LLMService           (calls the chosen LLM provider)
        ↓
    LLM Provider         (OpenAI / Anthropic / Gemini / …)
"""

from app.core.logging import get_logger
from app.schemas.tutor import PracticeQuestion, TutorContext, TutorResponse

logger = get_logger(__name__)


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
            Structured tutoring output.  Phase 1 returns a placeholder.
        """
        logger.debug(
            "TutorService.explain called | competency=%s question=%s",
            context.competency.id,
            context.question.id,
        )

        response = self._generate_placeholder(context)

        logger.debug("TutorService.explain returning placeholder response.")
        return response

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _generate_placeholder(self, context: TutorContext) -> TutorResponse:
        """
        Return a deterministic placeholder TutorResponse.

        This method will be replaced in a future phase by a call to
        PromptService and then LLMService.
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
