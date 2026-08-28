"""
Pydantic schemas for AI Tutor Mode 2 (Post-Quiz Analysis).

These schemas define the multi-question post-quiz payload sent from LearnTrace backend
to the AI Tutor, and the structured response containing concise mistake explanations.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class QuizQuestionResult(BaseModel):
    """Result details for a single question within a completed quiz."""

    question_id: str = Field(..., description="Unique question identifier.")
    question_text: str = Field(..., description="Full text of the question.")
    topic: str = Field(..., description="Topic or competency being assessed.")
    student_answer: str = Field(..., description="Option text selected by the student.")
    correct_answer: str = Field(..., description="Correct option text.")
    is_correct: bool = Field(..., description="Evaluation result: True if correct, False if incorrect.")


class QuizTutorContext(BaseModel):
    """
    Full payload for a completed quiz attempt sent to AI Tutor Mode 2.
    """

    attempt_id: str = Field(..., description="Unique attempt identifier.")
    subject: str = Field(default="General", description="Subject name.")
    class_level: Optional[int] = Field(default=None, description="Class level / grade.")
    questions: list[QuizQuestionResult] = Field(
        ...,
        min_length=1,
        description="List of question results included in the completed quiz.",
    )


class QuizMistakeExplanation(BaseModel):
    """Explanation for a single incorrect answer in the completed quiz."""

    question_id: str = Field(..., description="Unique question identifier.")
    question_text: str = Field(..., description="Full text of the question.")
    topic: str = Field(..., description="Topic or competency being assessed.")
    student_answer: str = Field(..., description="Option text selected by the student.")
    correct_answer: str = Field(..., description="Correct option text.")
    explanation: str = Field(
        ...,
        description="Concise 1-3 sentence explanation of why student_answer is incorrect and why correct_answer is right.",
    )


class QuizTutorResponse(BaseModel):
    """
    Structured output returned by AI Tutor Mode 2 for a completed quiz attempt.
    """

    attempt_id: str = Field(..., description="Unique attempt identifier.")
    total_questions: int = Field(..., description="Total number of questions in the quiz.")
    incorrect_count: int = Field(..., description="Total number of incorrect answers.")
    mistakes: list[QuizMistakeExplanation] = Field(
        default_factory=list,
        description="Explanations for incorrect questions only.",
    )
