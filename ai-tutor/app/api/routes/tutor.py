"""
Tutor API routes.

Endpoints
---------
POST /api/v1/tutor/explain
    Mode 1: Accept a single-question TutorContext payload and return a TutorResponse.

POST /api/v1/tutor/explain-quiz
    Mode 2: Accept a multi-question QuizTutorContext payload and return a QuizTutorResponse.
"""

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.quiz_tutor import QuizTutorContext, QuizTutorResponse
from app.schemas.tutor import TutorContext, TutorResponse
from app.services.tutor_service import TutorService

logger = get_logger(__name__)

router = APIRouter(prefix="/tutor", tags=["tutor"])

# Instantiate the service once; it is stateless so one instance is fine.
_tutor_service = TutorService()


@router.post(
    "/explain",
    response_model=TutorResponse,
    summary="Generate a single-question tutoring explanation (Mode 1)",
    description=(
        "Accepts a TutorContext payload from the LearnTrace backend and "
        "returns a structured TutorResponse."
    ),
)
def explain(context: TutorContext) -> TutorResponse:
    """Generate a tutoring explanation for a single question (Mode 1)."""
    logger.info(
        "POST /tutor/explain | competency=%s question=%s",
        context.competency.id,
        context.question.id,
    )

    try:
        return _tutor_service.explain(context)

    except LLMMisconfiguredError as exc:
        logger.error("LLM misconfiguration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tutor service is not configured. Contact the system administrator.",
        ) from exc

    except LLMProviderError as exc:
        logger.error("LLM provider error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tutor service is temporarily unavailable. Please try again later.",
        ) from exc

    except LLMResponseError as exc:
        logger.error("LLM response validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tutor service returned an invalid response. Please try again later.",
        ) from exc


@router.post(
    "/explain-quiz",
    response_model=QuizTutorResponse,
    summary="Generate post-quiz mistake explanations (Mode 2)",
    description=(
        "Accepts a completed QuizTutorContext payload and returns concise "
        "explanations for incorrect questions only."
    ),
)
def explain_quiz(context: QuizTutorContext) -> QuizTutorResponse:
    """Generate concise mistake explanations for a completed quiz attempt (Mode 2)."""
    logger.info(
        "POST /tutor/explain-quiz | attempt_id=%s questions=%d",
        context.attempt_id,
        len(context.questions),
    )

    try:
        return _tutor_service.explain_quiz(context)

    except LLMMisconfiguredError as exc:
        logger.error("LLM misconfiguration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tutor service is not configured. Contact the system administrator.",
        ) from exc

    except LLMProviderError as exc:
        logger.error("LLM provider error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tutor service is temporarily unavailable. Please try again later.",
        ) from exc

    except LLMResponseError as exc:
        logger.error("LLM response validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tutor service returned an invalid response. Please try again later.",
        ) from exc
