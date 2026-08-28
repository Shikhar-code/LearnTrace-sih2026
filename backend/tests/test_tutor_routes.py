import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_explain_quiz_direct_route():
    mock_response = {
        "attempt_id": "101",
        "total_questions": 2,
        "incorrect_count": 1,
        "mistakes": [
            {
                "question_id": "q1",
                "question_text": "What is 2+2?",
                "topic": "Arithmetic",
                "student_answer": "5",
                "correct_answer": "4",
                "explanation": "2+2 equals 4, not 5."
            }
        ]
    }
    payload = {
        "attempt_id": "101",
        "subject": "Math",
        "class_level": 9,
        "questions": [
            {
                "question_id": "q1",
                "question_text": "What is 2+2?",
                "topic": "Arithmetic",
                "student_answer": "5",
                "correct_answer": "4",
                "is_correct": False
            }
        ]
    }

    with patch("routes.tutor.get_tutor_quiz_explanation", return_value=mock_response):
        response = client.post("/tutor/explain-quiz", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["attempt_id"] == "101"
        assert data["incorrect_count"] == 1
        assert len(data["mistakes"]) == 1
        assert data["mistakes"][0]["question_id"] == "q1"


def test_explain_single_direct_route():
    mock_response = {
        "explanation": "Detailed explanation...",
        "simple_explanation": "ELI5...",
        "worked_example": "Example...",
        "practice_question": {
            "question": "Practice Q?",
            "options": ["A", "B", "C", "D"],
            "correct_option": "A",
            "explanation": "Practice exp"
        }
    }
    payload = {
        "competency": {"id": "top_1", "name": "Topic 1"},
        "question": {"id": "q_1", "text": "Question 1", "options": ["A", "B"]},
        "learner_answer": "B",
        "correct_answer": "A"
    }

    with patch("routes.tutor.get_tutor_single_explanation", return_value=mock_response):
        response = client.post("/tutor/explain", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "explanation" in data
        assert "practice_question" in data
