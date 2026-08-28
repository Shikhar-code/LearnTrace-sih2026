"""
Groq provider implementation for the AI Tutor.

Responsibilities
----------------
- Accept a prepared prompt and system prompt string.
- Call the Groq API using the official groq Python SDK.
- Request structured JSON output matching response_model (TutorResponse or QuizTutorResponse).
- Translate SDK/API errors into application-level exceptions.
- Never leak Groq-specific types to callers.
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
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise LLMMisconfiguredError(
            "GROQ_API_KEY is not set. "
            "Set it in your .env file or environment. "
            "To run without a key, set TUTOR_MOCK_MODE=true."
        )

    try:
        from groq import Groq  # type: ignore[import]
    except ImportError as exc:
        raise LLMMisconfiguredError(
            "groq package is not installed. "
            "Run: pip install groq"
        ) from exc

    return Groq(api_key=api_key)


def call_groq(
    system_prompt: str,
    user_prompt: str,
    response_model: Type[BaseModel] = TutorResponse,
) -> Any:
    """
    Call the Groq API and return a validated response model.
    """
    client = _get_client()
    model = settings.GROQ_MODEL

    logger.info("Calling Groq | model=%s | model_class=%s", model, response_model.__name__)

    schema_json = json.dumps(response_model.model_json_schema())
    json_instruction = (
        f"\n\nIMPORTANT: You MUST respond with valid JSON matching this JSON Schema:\n{schema_json}"
    )
    full_system_prompt = system_prompt + json_instruction

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
    except Exception as exc:
        logger.error("Groq API call failed: %s", type(exc).__name__)
        raise LLMProviderError(
            f"Groq API call failed: {type(exc).__name__}"
        ) from exc

    logger.info("Groq call succeeded.")

    try:
        raw_text = completion.choices[0].message.content
    except (AttributeError, IndexError) as exc:
        raise LLMResponseError(
            "Groq returned an unexpected response structure."
        ) from exc

    if not raw_text or not raw_text.strip():
        raise LLMResponseError("Groq returned an empty response.")

    try:
        data = json.loads(raw_text)
        return response_model(**data)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.error("Failed to parse Groq response as %s.", response_model.__name__)
        raise LLMResponseError(
            f"Groq response could not be parsed as {response_model.__name__}: {exc}"
        ) from exc
