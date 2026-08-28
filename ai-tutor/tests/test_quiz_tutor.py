"""
Unit tests for AI Tutor Mode 2 (Post-Quiz Analysis).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.quiz_tutor import QuizQuestionResult, QuizTutorContext
from app.services.tutor_service import TutorService

client = TestClient(app)


def test_explain_quiz_all_correct():
    """Verify that a 100% score quiz returns 0 mistakes and 0 LLM calls."""
    service = TutorService()
    context = QuizTutorContext(
        attempt_id="101",
        subject="Physics",
        class_level=9,
        questions=[
            QuizQuestionResult(
                question_id="q1",
                question_text="What is the unit of force?",
                topic="Laws of Motion",
                student_answer="Newton",
                correct_answer="Newton",
                is_correct=True,
            ),
            QuizQuestionResult(
                question_id="q2",
                question_text="What is the unit of work?",
                topic="Work and Energy",
                student_answer="Joule",
                correct_answer="Joule",
                is_correct=True,
            ),
        ],
    )

    response = service.explain_quiz(context)
    assert response.attempt_id == "101"
    assert response.total_questions == 2
    assert response.incorrect_count == 0
    assert len(response.mistakes) == 0


def test_explain_quiz_mock_mode():
    """Verify Mode 2 endpoint with mock mode returns mock mistake explanations."""
    payload = {
        "attempt_id": "102",
        "subject": "Chemistry",
        "class_level": 10,
        "questions": [
            {
                "question_id": "q1",
                "question_text": "What is the atomic number of Hydrogen?",
                "topic": "Atomic Structure",
                "student_answer": "2",
                "correct_answer": "1",
                "is_correct": False,
            },
            {
                "question_id": "q2",
                "question_text": "What is the atomic number of Helium?",
                "topic": "Atomic Structure",
                "student_answer": "2",
                "correct_answer": "2",
                "is_correct": True,
            },
        ],
    }

    res = client.post("/api/v1/tutor/explain-quiz", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["attempt_id"] == "102"
    assert data["total_questions"] == 2
    assert data["incorrect_count"] == 1
    assert len(data["mistakes"]) == 1
    assert data["mistakes"][0]["question_id"] == "q1"
    assert data["mistakes"][0]["student_answer"] == "2"
    assert data["mistakes"][0]["correct_answer"] == "1"
    assert "[MOCK]" in data["mistakes"][0]["explanation"]


def test_explain_quiz_multiple_mistakes():
    """Verify Mode 2 returns explanations for all incorrect items."""
    service = TutorService()
    context = QuizTutorContext(
        attempt_id="103",
        subject="Math",
        class_level=9,
        questions=[
            QuizQuestionResult(
                question_id="q1",
                question_text="2 + 2 = ?",
                topic="Addition",
                student_answer="5",
                correct_answer="4",
                is_correct=False,
            ),
            QuizQuestionResult(
                question_id="q2",
                question_text="3 x 3 = ?",
                topic="Multiplication",
                student_answer="6",
                correct_answer="9",
                is_correct=False,
            ),
        ],
    )

    response = service.explain_quiz(context)
    assert response.attempt_id == "103"
    assert response.total_questions == 2
    assert response.incorrect_count == 2
    assert len(response.mistakes) == 2
    assert {m.question_id for m in response.mistakes} == {"q1", "q2"}


def test_explain_quiz_validation_failure(monkeypatch):
    """Verify that an overly long explanation triggers validation failure."""
    from app.services.response_validator import validate_quiz_tutor_response
    from app.schemas.quiz_tutor import QuizTutorResponse, QuizMistakeExplanation
    from app.core.exceptions import LLMResponseError

    context = QuizTutorContext(
        attempt_id="104",
        questions=[
            QuizQuestionResult(
                question_id="q1",
                question_text="Sample Q",
                topic="Sample",
                student_answer="A",
                correct_answer="B",
                is_correct=False,
            )
        ],
    )

    bad_response = QuizTutorResponse(
        attempt_id="104",
        total_questions=1,
        incorrect_count=1,
        mistakes=[
            QuizMistakeExplanation(
                question_id="q1",
                question_text="Sample Q",
                topic="Sample",
                student_answer="A",
                correct_answer="B",
                explanation="X" * 500,  # Exceeds max 400 char limit
            )
        ],
    )

    with pytest.raises(LLMResponseError):
        validate_quiz_tutor_response(bad_response, context)
