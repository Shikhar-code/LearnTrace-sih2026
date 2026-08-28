"""
TutorService — application logic layer for the AI Tutor.

Responsibility
--------------
Accept a validated TutorContext (Mode 1) or QuizTutorContext (Mode 2) and return structured responses.
"""

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.prompts.quiz_tutor import QUIZ_TUTOR_SYSTEM_PROMPT, build_quiz_tutor_prompt
from app.prompts.tutor import TUTOR_SYSTEM_PROMPT, build_tutor_prompt
from app.schemas.quiz_tutor import QuizMistakeExplanation, QuizTutorContext, QuizTutorResponse
from app.schemas.tutor import PracticeQuestion, TutorContext, TutorResponse
from app.services.llm_service import LLMService

logger = get_logger(__name__)

# Single LLMService instance — stateless, safe to share across requests.
_llm_service = LLMService()


class TutorService:
    """Orchestrates the tutoring pipeline for single-question and post-quiz requests."""

    def explain(self, context: TutorContext) -> TutorResponse:
        """
        Generate a tutoring response for Mode 1 (single question).
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

    def explain_quiz(self, context: QuizTutorContext) -> QuizTutorResponse:
        """
        Generate a post-quiz explanation response for Mode 2 (completed quiz).
        """
        incorrect_items = [q for q in context.questions if not q.is_correct]

        logger.info(
            "TutorService.explain_quiz | attempt_id=%s total=%d incorrect=%d mock=%s",
            context.attempt_id,
            len(context.questions),
            len(incorrect_items),
            settings.TUTOR_MOCK_MODE,
        )

        # Token efficiency guarantee: 100% score -> 0 LLM calls!
        if len(incorrect_items) == 0:
            logger.info("Student score is 100%%. Returning zero mistakes without LLM call.")
            return QuizTutorResponse(
                attempt_id=context.attempt_id,
                total_questions=len(context.questions),
                incorrect_count=0,
                mistakes=[],
            )

        if settings.TUTOR_MOCK_MODE:
            logger.debug("Mock mode enabled — returning placeholder quiz response.")
            return self._generate_quiz_mock(context)

        system_prompt = QUIZ_TUTOR_SYSTEM_PROMPT
        user_prompt = build_quiz_tutor_prompt(context)

        return _llm_service.generate_quiz(system_prompt, user_prompt, context)

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _generate_with_llm(self, context: TutorContext) -> TutorResponse:
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

    def _generate_quiz_mock(self, context: QuizTutorContext) -> QuizTutorResponse:
        incorrect_items = [q for q in context.questions if not q.is_correct]

        mistakes = []
        for q in incorrect_items:
            mistakes.append(
                QuizMistakeExplanation(
                    question_id=q.question_id,
                    question_text=q.question_text,
                    topic=q.topic,
                    student_answer=q.student_answer,
                    correct_answer=q.correct_answer,
                    explanation=(
                        f"[MOCK] You selected '{q.student_answer}' for question '{q.question_text}'. "
                        f"The correct answer is '{q.correct_answer}' because of core topic principles."
                    ),
                )
            )

        return QuizTutorResponse(
            attempt_id=context.attempt_id,
            total_questions=len(context.questions),
            incorrect_count=len(incorrect_items),
            mistakes=mistakes,
        )
