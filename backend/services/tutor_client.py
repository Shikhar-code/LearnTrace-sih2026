"""
HTTP client service for communicating with the AI Tutor microservice on port 8001.
"""

from typing import Any
import httpx

from core.config import settings

AI_TUTOR_BASE_URL = getattr(settings, "AI_TUTOR_URL", "http://localhost:8001")


def get_tutor_quiz_explanation(quiz_context: dict[str, Any]) -> dict[str, Any]:
    """
    Send a QuizTutorContext payload to AI Tutor Mode 2 (POST /api/v1/tutor/explain-quiz).
    """
    url = f"{AI_TUTOR_BASE_URL}/api/v1/tutor/explain-quiz"

    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, json=quiz_context)
        response.raise_for_status()
        return response.json()

