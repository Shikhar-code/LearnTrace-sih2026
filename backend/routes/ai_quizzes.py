from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from services.llm_quiz_generator import (
    QuizGenerationError,
    generate_and_save_quiz,
)


router = APIRouter(
    prefix="/ai-quizzes",
    tags=["AI Quizzes"],
)


class GenerateQuizRequest(BaseModel):
    topic_id: int = Field(..., gt=0)

    number_of_questions: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    difficulty: str = Field(
        default="medium"
    )

    duration_minutes: int = Field(
        default=10,
        ge=1,
        le=180,
    )


@router.post("/generate")
def generate_quiz(
    request: GenerateQuizRequest,
    db: Session = Depends(get_db),
):
    try:
        assessment = generate_and_save_quiz(
            db=db,
            topic_id=request.topic_id,
            number_of_questions=request.number_of_questions,
            difficulty=request.difficulty,
            duration_minutes=request.duration_minutes,
        )

        return {
            "status": "success",
            "assessment_id": assessment.id,
            "title": assessment.title,
            "class_level": assessment.class_level,
            "subject_id": assessment.subject_id,
            "duration_minutes": assessment.duration_minutes,
            "questions_created": len(
                assessment.questions
            ),
        }

    except QuizGenerationError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {error}",
        ) from error
