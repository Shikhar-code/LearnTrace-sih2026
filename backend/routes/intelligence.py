"""Thin FastAPI bridge to the separately owned intelligence engine."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from routes.assessments import get_assessment
from routes.mastery import get_mastery_input


# The backend is currently launched from its own directory. Add the repository
# root so its sibling package can be imported without moving or duplicating it.
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from intelligence_engine.assessment import AssessmentType
from intelligence_engine.frontend import build_admin_heatmap
from intelligence_engine.integration import analyze_backend_bundles


router = APIRouter(prefix="/intelligence", tags=["Learning Intelligence"])


class AttemptInput(BaseModel):
    attempt_id: int
    assessment_type: AssessmentType = AssessmentType.DIAGNOSTIC


class AnalysisRequest(BaseModel):
    attempts: list[AttemptInput]
    target_concept_id: str | None = None


def _bundle(attempt_id: int, assessment_type: AssessmentType, db: Session) -> dict:
    attempt = get_mastery_input(attempt_id, db)
    return {
        "attempt": attempt,
        "assessment": get_assessment(attempt["assessment_id"], db),
        "assessment_type": assessment_type.value,
    }


@router.get("/analyze/{attempt_id}")
def analyze_attempt(
    attempt_id: int,
    assessment_type: AssessmentType = AssessmentType.DIAGNOSTIC,
    target_concept_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Return mastery, root gaps, and a learning path for one attempt."""
    try:
        return analyze_backend_bundles(
            [_bundle(attempt_id, assessment_type, db)],
            target_concept_id=target_concept_id,
        ).to_dict()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/analyze")
def analyze_attempt_history(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
):
    """Combine diagnostic/reassessment attempts for one learner."""
    if not request.attempts:
        raise HTTPException(status_code=422, detail="at least one attempt is required")
    try:
        bundles = [
            _bundle(item.attempt_id, item.assessment_type, db)
            for item in request.attempts
        ]
        return analyze_backend_bundles(
            bundles,
            target_concept_id=request.target_concept_id,
        ).to_dict()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/admin/heatmap")
def analyze_cohort_heatmap(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
):
    """Return a frontend-ready mastery heatmap for explicitly supplied attempts."""
    if not request.attempts:
        raise HTTPException(status_code=422, detail="at least one attempt is required")
    try:
        grouped: dict[int, list[dict]] = {}
        for item in request.attempts:
            bundle = _bundle(item.attempt_id, item.assessment_type, db)
            grouped.setdefault(int(bundle["attempt"]["user_id"]), []).append(bundle)
        learner_payloads = [
            analyze_backend_bundles(
                bundles,
                target_concept_id=request.target_concept_id,
            ).to_dict()
            for _, bundles in sorted(grouped.items())
        ]
        return build_admin_heatmap(learner_payloads)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
