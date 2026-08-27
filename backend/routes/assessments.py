from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.academic import Subject
from models.quiz import Assessment, AssessmentQuestion, Question


router = APIRouter(
    prefix="/assessments",
    tags=["Assessments"],
)


class AssessmentCreate(BaseModel):
    title: str
    description: str | None = None
    class_level: int
    subject_id: int
    duration_minutes: int | None = None


class AddQuestionToAssessment(BaseModel):
    question_id: int
    question_order: int


@router.post("/")
def create_assessment(
    assessment_data: AssessmentCreate,
    db: Session = Depends(get_db),
):
    # Check that the subject exists.
    subject = (
        db.query(Subject)
        .filter(
            Subject.id == assessment_data.subject_id,
            Subject.class_level == assessment_data.class_level,
        )
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found for the specified class.",
        )

    assessment = Assessment(
        title=assessment_data.title,
        description=assessment_data.description,
        class_level=assessment_data.class_level,
        subject_id=assessment_data.subject_id,
        duration_minutes=assessment_data.duration_minutes,
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return {
        "status": "success",
        "assessment_id": assessment.id,
        "title": assessment.title,
        "class_level": assessment.class_level,
        "subject_id": assessment.subject_id,
    }


@router.post("/{assessment_id}/questions")
def add_question_to_assessment(
    assessment_id: int,
    question_data: AddQuestionToAssessment,
    db: Session = Depends(get_db),
):
    # Check assessment.
    assessment = (
        db.query(Assessment)
        .filter(Assessment.id == assessment_id)
        .first()
    )

    if not assessment:
        raise HTTPException(
            status_code=404,
            detail="Assessment not found.",
        )

    # Check question.
    question = (
        db.query(Question)
        .filter(Question.id == question_data.question_id)
        .first()
    )

    if not question:
        raise HTTPException(
            status_code=404,
            detail="Question not found.",
        )

    # Prevent duplicate question membership.
    existing = (
        db.query(AssessmentQuestion)
        .filter(
            AssessmentQuestion.assessment_id == assessment_id,
            AssessmentQuestion.question_id == question_data.question_id,
        )
        .first()
    )

    if existing:
        return {
            "status": "already_exists",
            "assessment_question_id": existing.id,
        }

    assessment_question = AssessmentQuestion(
        assessment_id=assessment_id,
        question_id=question_data.question_id,
        question_order=question_data.question_order,
    )

    db.add(assessment_question)
    db.commit()
    db.refresh(assessment_question)

    return {
        "status": "success",
        "assessment_question_id": assessment_question.id,
        "assessment_id": assessment_id,
        "question_id": question_data.question_id,
        "question_order": question_data.question_order,
    }


@router.get("/{assessment_id}")
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
):
    assessment = (
        db.query(Assessment)
        .filter(Assessment.id == assessment_id)
        .first()
    )

    if not assessment:
        raise HTTPException(
            status_code=404,
            detail="Assessment not found.",
        )

    questions = (
        db.query(AssessmentQuestion)
        .filter(
            AssessmentQuestion.assessment_id == assessment_id
        )
        .order_by(AssessmentQuestion.question_order)
        .all()
    )

    return {
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "class_level": assessment.class_level,
        "subject_id": assessment.subject_id,
        "duration_minutes": assessment.duration_minutes,
        "questions": [
            {
                "assessment_question_id": item.id,
                "question_id": item.question.id,
                "question_order": item.question_order,
                "question_text": item.question.question_text,
                "difficulty": item.question.difficulty,
                "topic_id": item.question.topic_id,
                "options": [
                    {
                        "id": option.id,
                        "option_text": option.option_text,
                        "is_correct": option.is_correct,
                    }
                    for option in item.question.options
                ],
            }
            for item in questions
        ],
    }