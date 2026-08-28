"""Thin FastAPI bridge to the separately owned intelligence engine."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.attempt import AssessmentAttempt
from models.quiz import Assessment
from models.academic import Subject
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
    attempts: list[AttemptInput] = []
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
    """Return a frontend-ready mastery heatmap with auto-discovery or supplied attempts."""
    attempts_to_process = list(request.attempts)

    # Auto-discover completed attempts from DB if none are explicitly supplied
    if not attempts_to_process:
        class_level = None
        if request.target_concept_id:
            parts = request.target_concept_id.split(":")
            if len(parts) >= 2:
                try:
                    class_level = int(parts[0].replace("class-", ""))
                except ValueError:
                    class_level = None

        query = (
            db.query(AssessmentAttempt)
            .join(Assessment, AssessmentAttempt.assessment_id == Assessment.id)
            .filter(AssessmentAttempt.completed.is_(True))
        )
        if class_level is not None:
            query = query.filter(Assessment.class_level == class_level)

        db_attempts = query.order_by(AssessmentAttempt.user_id, AssessmentAttempt.started_at.asc()).all()

        if not db_attempts:
            # Fallback to seeded demo attempt 1
            attempts_to_process = [AttemptInput(attempt_id=1, assessment_type=AssessmentType.DIAGNOSTIC)]
        else:
            user_seen = set()
            auto_attempts = []
            for att in db_attempts:
                if att.user_id not in user_seen:
                    auto_attempts.append(AttemptInput(attempt_id=att.id, assessment_type=AssessmentType.DIAGNOSTIC))
                    user_seen.add(att.user_id)
                else:
                    auto_attempts.append(AttemptInput(attempt_id=att.id, assessment_type=AssessmentType.REASSESSMENT))
            attempts_to_process = auto_attempts

    try:
        grouped: dict[int, list[dict]] = {}
        for item in attempts_to_process:
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
