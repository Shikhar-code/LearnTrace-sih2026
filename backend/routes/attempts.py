from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.attempt import AssessmentAttempt, Response, User
from models.quiz import Assessment, QuestionOption


router = APIRouter(
    prefix="/attempts",
    tags=["Attempts"],
)


class StartAttempt(BaseModel):
    user_id: int
    assessment_id: int


class SubmitResponse(BaseModel):
    question_id: int
    selected_option_id: int | None = None
    answer_text: str | None = None
    response_time_seconds: int | None = None


@router.post("/")
def start_attempt(
    attempt_data: StartAttempt,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == attempt_data.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    assessment = (
        db.query(Assessment)
        .filter(Assessment.id == attempt_data.assessment_id)
        .first()
    )

    if not assessment:
        raise HTTPException(
            status_code=404,
            detail="Assessment not found.",
        )

    attempt = AssessmentAttempt(
        user_id=user.id,
        assessment_id=assessment.id,
        started_at=datetime.utcnow(),
        completed=False,
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "status": "success",
        "attempt_id": attempt.id,
        "user_id": attempt.user_id,
        "assessment_id": attempt.assessment_id,
        "started_at": attempt.started_at,
    }


@router.post("/{attempt_id}/responses")
def submit_response(
    attempt_id: int,
    response_data: SubmitResponse,
    db: Session = Depends(get_db),
):
    attempt = (
        db.query(AssessmentAttempt)
        .filter(AssessmentAttempt.id == attempt_id)
        .first()
    )

    if not attempt:
        raise HTTPException(
            status_code=404,
            detail="Assessment attempt not found.",
        )

    if attempt.completed:
        raise HTTPException(
            status_code=400,
            detail="This assessment attempt is already completed.",
        )

    is_correct = None

    if response_data.selected_option_id is not None:
        selected_option = (
            db.query(QuestionOption)
            .filter(
                QuestionOption.id
                == response_data.selected_option_id
            )
            .first()
        )

        if not selected_option:
            raise HTTPException(
                status_code=404,
                detail="Selected option not found.",
            )

        is_correct = selected_option.is_correct

    response = Response(
        attempt_id=attempt.id,
        question_id=response_data.question_id,
        selected_option_id=response_data.selected_option_id,
        answer_text=response_data.answer_text,
        is_correct=is_correct,
        response_time_seconds=response_data.response_time_seconds,
    )

    db.add(response)
    db.commit()
    db.refresh(response)

    return {
        "status": "success",
        "response_id": response.id,
        "attempt_id": response.attempt_id,
        "question_id": response.question_id,
        "is_correct": response.is_correct,
    }


@router.post("/{attempt_id}/finish")
def finish_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
):
    attempt = (
        db.query(AssessmentAttempt)
        .filter(AssessmentAttempt.id == attempt_id)
        .first()
    )

    if not attempt:
        raise HTTPException(
            status_code=404,
            detail="Assessment attempt not found.",
        )

    if attempt.completed:
        return {
            "status": "already_completed",
            "attempt_id": attempt.id,
            "score": attempt.score,
        }

    responses = (
        db.query(Response)
        .filter(Response.attempt_id == attempt.id)
        .all()
    )

    answered = len(responses)
    correct = sum(
        1 for response in responses
        if response.is_correct is True
    )

    score = 0

    if answered > 0:
        score = round((correct / answered) * 100)

    attempt.finished_at = datetime.utcnow()
    attempt.score = score
    attempt.completed = True

    db.commit()
    db.refresh(attempt)

    return {
        "status": "success",
        "attempt_id": attempt.id,
        "answered": answered,
        "correct": correct,
        "score": score,
        "completed": attempt.completed,
    }