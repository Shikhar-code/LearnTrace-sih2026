"""
Groq provider implementation for the AI Tutor.

Responsibilities
----------------
- Accept a prepared prompt and system prompt string.
- Call the Groq API using the official groq Python SDK.
- Request structured JSON output matching TutorResponse.
- Translate SDK/API errors into application-level exceptions.
- Never leak Groq-specific types to callers.

The rest of the application only interacts with LLMService, never
with this module directly.
"""

import json

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorResponse

logger = get_logger(__name__)

# System prompt suffix instructing the model to respond with strict JSON.
_JSON_INSTRUCTION = (
    "\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown fences, "
    "no extra commentary. The JSON must match this exact structure:\n"
    '{"explanation": "...", "simple_explanation": "...", "worked_example": "...", '
    '"practice_question": {"question": "...", "options": ["...", "...", "...", "..."], '
    '"correct_option": "...", "explanation": "..."}}'
)


def _get_client():  # type: ignore[return]
    """
    Lazily import and construct the Groq client.

    Import is deferred so that the rest of the application can load
    without the SDK installed (e.g. if only mock mode is needed).
    """
    try:
        from groq import Groq  # type: ignore[import]
    except ImportError as exc:
        raise LLMMisconfiguredError(
            "groq package is not installed. "
            "Run: pip install groq"
        ) from exc

    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise LLMMisconfiguredError(
            "GROQ_API_KEY is not set. "
            "Set it in your .env file or environment. "
            "To run without a key, set TUTOR_MOCK_MODE=true."
        )

    return Groq(api_key=api_key)


def call_groq(system_prompt: str, user_prompt: str) -> TutorResponse:
    """
    Call the Groq API and return a validated TutorResponse.

    Parameters
    ----------
    system_prompt:
        The tutor system instructions.
    user_prompt:
        The formatted learner context prompt.

    Returns
    -------
    TutorResponse
        Structured response parsed from Groq's JSON output.

    Raises
    ------
    LLMMisconfiguredError
        If the API key is missing or the SDK is not installed.
    LLMProviderError
        If the Groq API call fails (network, quota, etc.).
    LLMResponseError
        If the response cannot be parsed into TutorResponse.
    """
    client = _get_client()
    model = settings.GROQ_MODEL

    logger.info("Calling Groq | model=%s", model)

    # Append JSON-output instruction to the system prompt so the model
    # knows it must respond with a strict JSON object.
    full_system_prompt = system_prompt + _JSON_INSTRUCTION

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
        # Translate any SDK / network / quota error into our type.
        logger.error("Groq API call failed: %s", type(exc).__name__)
        raise LLMProviderError(
            f"Groq API call failed: {type(exc).__name__}"
        ) from exc

    logger.info("Groq call succeeded.")

    # Extract the text from the first choice.
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
        return TutorResponse(**data)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.error("Failed to parse Groq response as TutorResponse.")
        raise LLMResponseError(
            f"Groq response could not be parsed: {exc}"
        ) from exc
