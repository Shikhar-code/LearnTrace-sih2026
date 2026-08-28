from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

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
        .options(
            joinedload(Response.question)
            .joinedload(Question.topic)
            .joinedload(Topic.chapter)
            .joinedload(Chapter.subject)
        )
        .filter(Response.attempt_id == attempt_id)
        .all()
    )

    result = []

    for response in responses:
        question = response.question
        if not question:
            continue

        topic = question.topic
        chapter = topic.chapter if topic else None
        subject = chapter.subject if chapter else None

        result.append(
            {
                "response_id": response.id,
                "question_id": response.question_id,
                "selected_option_id": response.selected_option_id,
                "topic_id": topic.id if topic else None,
                "topic": topic.title if topic else None,
                "chapter_id": chapter.id if chapter else None,
                "chapter": chapter.title if chapter else (topic.title if topic else None),
                "subject_id": subject.id if subject else None,
                "subject": subject.name if subject else None,
                "class_level": subject.class_level if subject else None,
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