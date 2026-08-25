from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.academic import Topic
from models.content import SourceDocument
from models.quiz import Question, QuestionOption


router = APIRouter(
    prefix="/questions",
    tags=["Questions"],
)


class QuestionOptionCreate(BaseModel):
    option_text: str
    is_correct: bool = False


class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "mcq"
    difficulty: str = "medium"
    topic_id: int
    explanation: str | None = None
    source_document_id: int | None = None
    options: list[QuestionOptionCreate]


@router.post("/")
def create_question(
    question_data: QuestionCreate,
    db: Session = Depends(get_db),
):
    # Check that the topic exists.
    topic = (
        db.query(Topic)
        .filter(Topic.id == question_data.topic_id)
        .first()
    )

    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Topic not found.",
        )

    # Check the source document if one was supplied.
    if question_data.source_document_id is not None:
        source_document = (
            db.query(SourceDocument)
            .filter(
                SourceDocument.id == question_data.source_document_id
            )
            .first()
        )

        if not source_document:
            raise HTTPException(
                status_code=404,
                detail="Source document not found.",
            )

    # Basic MCQ validation.
    if question_data.question_type == "mcq":
        if len(question_data.options) < 2:
            raise HTTPException(
                status_code=400,
                detail="An MCQ must have at least two options.",
            )

        correct_count = sum(
            option.is_correct
            for option in question_data.options
        )

        if correct_count != 1:
            raise HTTPException(
                status_code=400,
                detail="An MCQ must have exactly one correct option.",
            )

    question = Question(
        question_text=question_data.question_text,
        question_type=question_data.question_type,
        difficulty=question_data.difficulty,
        topic_id=question_data.topic_id,
        explanation=question_data.explanation,
        source_document_id=question_data.source_document_id,
    )

    db.add(question)
    db.flush()

    for option_data in question_data.options:
        option = QuestionOption(
            question_id=question.id,
            option_text=option_data.option_text,
            is_correct=option_data.is_correct,
        )

        db.add(option)

    db.commit()
    db.refresh(question)

    return {
        "status": "success",
        "question_id": question.id,
        "topic_id": question.topic_id,
        "source_document_id": question.source_document_id,
    }


@router.get("/")
def list_questions(
    topic_id: int,
    db: Session = Depends(get_db),
):
    questions = (
        db.query(Question)
        .filter(Question.topic_id == topic_id)
        .order_by(Question.id)
        .all()
    )

    return [
        {
            "id": question.id,
            "question_text": question.question_text,
            "question_type": question.question_type,
            "difficulty": question.difficulty,
            "topic_id": question.topic_id,
            "source_document_id": question.source_document_id,
            "explanation": question.explanation,
            "options": [
                {
                    "id": option.id,
                    "option_text": option.option_text,
                    "is_correct": option.is_correct,
                }
                for option in question.options
            ],
        }
        for question in questions
    ]