from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from models.attempt import AssessmentAttempt, Response
from models.quiz import Question, QuestionOption, Assessment
from models.academic import Topic, Chapter, Subject
from services.tutor_client import (
    get_tutor_quiz_explanation,
    get_tutor_single_explanation,
)


router = APIRouter(
    tags=["AI Tutor Integration"],
)


@router.post("/attempts/{attempt_id}/explain")
def explain_attempt_mistakes(
    attempt_id: int,
    db: Session = Depends(get_db),
):
    """
    Mode 2: Fetch attempt details from DB and generate post-quiz mistake explanations via AI Tutor.
    """
    attempt = (
        db.query(AssessmentAttempt)
        .options(
            joinedload(AssessmentAttempt.assessment).joinedload(Assessment.subject)
        )
        .filter(AssessmentAttempt.id == attempt_id)
        .first()
    )

    if not attempt:
        raise HTTPException(
            status_code=404,
            detail="Assessment attempt not found.",
        )

    if not attempt.completed:
        raise HTTPException(
            status_code=400,
            detail="Assessment attempt must be completed before generating tutor explanations.",
        )

    assessment = attempt.assessment

    responses = (
        db.query(Response)
        .options(
            joinedload(Response.question)
            .joinedload(Question.topic)
            .joinedload(Topic.chapter)
            .joinedload(Chapter.subject),
            joinedload(Response.question).joinedload(Question.options),
            joinedload(Response.selected_option),
        )
        .filter(Response.attempt_id == attempt_id)
        .all()
    )

    question_results = []
    subject_name = (
        assessment.subject.name
        if assessment and assessment.subject
        else "General"
    )
    class_level = assessment.class_level if assessment else 9

    for resp in responses:
        question = resp.question
        if not question:
            continue

        topic = question.topic
        topic_title = topic.title if topic else "General"

        if (
            subject_name == "General"
            and topic
            and topic.chapter
            and topic.chapter.subject
        ):
            subject_name = topic.chapter.subject.name

        student_answer_text = "No Answer"
        if resp.selected_option:
            student_answer_text = resp.selected_option.option_text

        correct_opt = None
        if question.options:
            for opt in question.options:
                if opt.is_correct:
                    correct_opt = opt
                    break

        correct_answer_text = correct_opt.option_text if correct_opt else "Unknown"

        question_results.append(
            {
                "question_id": str(question.id),
                "question_text": question.question_text,
                "topic": topic_title,
                "student_answer": student_answer_text,
                "correct_answer": correct_answer_text,
                "is_correct": resp.is_correct if resp.is_correct is not None else False,
            }
        )

    quiz_context = {
        "attempt_id": str(attempt.id),
        "subject": subject_name,
        "class_level": class_level,
        "questions": question_results,
    }

    try:
        return get_tutor_quiz_explanation(quiz_context)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with AI Tutor service: {str(exc)}",
        ) from exc


@router.post("/tutor/explain-quiz")
def explain_quiz_direct(payload: dict[str, Any]):
    """
    Mode 2 Proxy: Forward full quiz-result JSON payload to AI Tutor Mode 2 endpoint.
    """
    try:
        return get_tutor_quiz_explanation(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with AI Tutor service: {str(exc)}",
        ) from exc


@router.post("/tutor/explain")
def explain_single_direct(payload: dict[str, Any]):
    """
    Mode 1 Proxy: Forward single-question TutorContext payload to AI Tutor Mode 1 endpoint.
    """
    try:
        return get_tutor_single_explanation(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with AI Tutor service: {str(exc)}",
        ) from exc
