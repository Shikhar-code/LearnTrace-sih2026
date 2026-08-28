"""
Gemini provider implementation for the AI Tutor.

Responsibilities
----------------
- Accept a prepared prompt and system prompt string.
- Call the Gemini API using the official google-genai SDK.
- Request structured JSON output matching response_model (TutorResponse or QuizTutorResponse).
- Translate SDK/API errors into application-level exceptions.
- Never leak Gemini-specific types to callers.
"""

import json
from typing import Any, Type

from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorResponse

logger = get_logger(__name__)


def _get_client():  # type: ignore[return]
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise LLMMisconfiguredError(
            "GEMINI_API_KEY is not set. "
            "Set it in your .env file or environment. "
            "To run without a key, set TUTOR_MOCK_MODE=true."
        )

    try:
        from google import genai  # type: ignore[import]
    except ImportError as exc:
        raise LLMMisconfiguredError(
            "google-genai package is not installed. "
            "Run: pip install google-genai"
        ) from exc

    return genai.Client(api_key=api_key)


def call_gemini(
    system_prompt: str,
    user_prompt: str,
    response_model: Type[BaseModel] = TutorResponse,
) -> Any:
    """
    Call the Gemini API and return a validated response model.
    """
    client = _get_client()
    model = settings.GEMINI_MODEL

    logger.info("Calling Gemini | model=%s | model_class=%s", model, response_model.__name__)

    try:
        from google.genai import types as genai_types  # type: ignore[import]
        config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
        )
    except Exception:
        config = {
            "system_instruction": system_prompt,
            "response_mime_type": "application/json",
            "response_schema": response_model,
        }

    try:
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=config,
        )
    except Exception as exc:
        logger.error("Gemini API call failed: %s", type(exc).__name__)
        raise LLMProviderError(
            f"Gemini API call failed: {type(exc).__name__}"
        ) from exc

    logger.info("Gemini call succeeded.")

    raw_text = response.text
    if not raw_text or not raw_text.strip():
        raise LLMResponseError("Gemini returned an empty response.")

    try:
        data = json.loads(raw_text)
        return response_model(**data)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.error("Failed to parse Gemini response as %s.", response_model.__name__)
        raise LLMResponseError(
            f"Gemini response could not be parsed as {response_model.__name__}: {exc}"
        ) from exc
