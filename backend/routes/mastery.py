from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.attempt import AssessmentAttempt, Response
from models.quiz import Question
from models.academic import Topic, Chapter, Subject


router = APIRouter(
    prefix="/mastery",
    tags=["Mastery Integration"],
)


@router.get("/input/{attempt_id}")
def get_mastery_input(
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

    responses = (
        db.query(Response)
        .join(Question, Response.question_id == Question.id)
        .filter(Response.attempt_id == attempt_id)
        .all()
    )

    result = []

    for response in responses:
        question = response.question

        topic = (
            db.query(Topic)
            .filter(Topic.id == question.topic_id)
            .first()
        )

        if not topic:
            continue

        chapter = (
            db.query(Chapter)
            .filter(Chapter.id == topic.chapter_id)
            .first()
        )

        subject = None

        if chapter:
            subject = (
                db.query(Subject)
                .filter(Subject.id == chapter.subject_id)
                .first()
            )

        result.append(
            {
                "response_id": response.id,
                "question_id": response.question_id,
                "topic_id": topic.id,
                "topic": topic.title,
                "chapter_id": chapter.id if chapter else None,
                "chapter": chapter.title if chapter else None,
                "subject_id": subject.id if subject else None,
                "subject": subject.name if subject else None,
                "class_level": (
                    subject.class_level
                    if subject else None
                ),
                "is_correct": response.is_correct,
                "response_time_seconds": response.response_time_seconds,
            }
        )

    return {
        "attempt_id": attempt.id,
        "user_id": attempt.user_id,
        "assessment_id": attempt.assessment_id,
        "completed": attempt.completed,
        "score": attempt.score,
        "responses": result,
    }