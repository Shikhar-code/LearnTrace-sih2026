"""
Tutor API routes.

Endpoints
---------
POST /api/v1/tutor/explain
    Accept a TutorContext payload, pass it to TutorService, and return
    a TutorResponse.

    Phase 1: returns a deterministic mock response.
    Phase 2: calls Gemini (when TUTOR_MOCK_MODE=false).
"""

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorContext, TutorResponse
from app.services.tutor_service import TutorService

logger = get_logger(__name__)

router = APIRouter(prefix="/tutor", tags=["tutor"])

# Instantiate the service once; it is stateless so one instance is fine.
_tutor_service = TutorService()


@router.post(
    "/explain",
    response_model=TutorResponse,
    summary="Generate a tutoring explanation",
    description=(
        "Accepts a TutorContext payload from the LearnTrace backend and "
        "returns a structured TutorResponse. "
        "Set `TUTOR_MOCK_MODE=true` in your environment to use a "
        "deterministic placeholder without calling an LLM."
    ),
)
def explain(context: TutorContext) -> TutorResponse:
    """
    Generate a tutoring explanation for a learner's incorrect answer.

    - **context**: Full TutorContext as supplied by the LearnTrace backend.
    """
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
