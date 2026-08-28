"""
HTTP client service for communicating with the AI Tutor microservice on port 8001.
"""

import os
from typing import Any
import httpx

try:
    from core.config import AI_TUTOR_URL
except ImportError:
    AI_TUTOR_URL = os.getenv("AI_TUTOR_URL", "http://localhost:8001")


def get_tutor_quiz_explanation(quiz_context: dict[str, Any]) -> dict[str, Any]:
    """
    Send a QuizTutorContext payload to AI Tutor Mode 2 (POST /api/v1/tutor/explain-quiz).
    """
    url = f"{AI_TUTOR_URL.rstrip('/')}/api/v1/tutor/explain-quiz"

    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, json=quiz_context)
        response.raise_for_status()
        return response.json()


def get_tutor_single_explanation(tutor_context: dict[str, Any]) -> dict[str, Any]:
    """
    Send a TutorContext payload to AI Tutor Mode 1 (POST /api/v1/tutor/explain).
    """
    url = f"{AI_TUTOR_URL.rstrip('/')}/api/v1/tutor/explain"

    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, json=tutor_context)
        response.raise_for_status()
        return response.json()
