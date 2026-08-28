from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.attempt import AssessmentAttempt, Response
from models.quiz import Question, QuestionOption, Assessment
from models.academic import Topic, Chapter, Subject
from services.tutor_client import get_tutor_quiz_explanation


router = APIRouter(
    prefix="/attempts",
    tags=["AI Tutor Integration"],
)


@router.post("/{attempt_id}/explain")
def explain_attempt_mistakes(
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

    if not attempt.completed:
        raise HTTPException(
            status_code=400,
            detail="Assessment attempt must be completed before generating tutor explanations.",
        )

    assessment = (
        db.query(Assessment)
        .filter(Assessment.id == attempt.assessment_id)
        .first()
    )

    responses = (
        db.query(Response)
        .filter(Response.attempt_id == attempt_id)
        .all()
    )

    question_results = []
    subject_name = "General"
    class_level = assessment.class_level if assessment else 9

    for resp in responses:
        question = (
            db.query(Question)
            .filter(Question.id == resp.question_id)
            .first()
        )
        if not question:
            continue

        topic = (
            db.query(Topic)
            .filter(Topic.id == question.topic_id)
            .first()
        )
        topic_title = topic.title if topic else "General"

        if topic and topic.chapter_id:
            chapter = db.query(Chapter).filter(Chapter.id == topic.chapter_id).first()
            if chapter and chapter.subject_id:
                subject_obj = db.query(Subject).filter(Subject.id == chapter.subject_id).first()
                if subject_obj:
                    subject_name = subject_obj.name

        student_answer_text = "No Answer"
        if resp.selected_option_id:
            selected_opt = (
                db.query(QuestionOption)
                .filter(QuestionOption.id == resp.selected_option_id)
                .first()
            )
            if selected_opt:
                student_answer_text = selected_opt.option_text

        correct_opt = (
            db.query(QuestionOption)
            .filter(
                QuestionOption.question_id == question.id,
                QuestionOption.is_correct == True,
            )
            .first()
        )
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
