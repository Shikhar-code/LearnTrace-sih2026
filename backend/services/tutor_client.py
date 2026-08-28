import os
from typing import Any

AI_TUTOR_BASE_URL = os.getenv("AI_TUTOR_URL", "http://localhost:8001")


def get_tutor_quiz_explanation(quiz_context: dict[str, Any]) -> dict[str, Any]:
    """
    Send a QuizTutorContext payload to AI Tutor Mode 2 (POST /api/v1/tutor/explain-quiz).
    """
    import httpx

    url = f"{AI_TUTOR_BASE_URL}/api/v1/tutor/explain-quiz"

    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, json=quiz_context)
        response.raise_for_status()
        return response.json()

