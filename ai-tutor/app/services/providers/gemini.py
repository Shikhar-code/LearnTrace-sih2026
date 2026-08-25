"""
Gemini provider implementation for the AI Tutor.

Responsibilities
----------------
- Accept a prepared prompt and system prompt string.
- Call the Gemini API using the official google-genai SDK.
- Request structured JSON output matching TutorResponse.
- Translate SDK/API errors into application-level exceptions.
- Never leak Gemini-specific types to callers.

The rest of the application only interacts with LLMService, never
with this module directly.
"""

import json

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorResponse

logger = get_logger(__name__)


def _get_client():  # type: ignore[return]
    """
    Lazily import and construct the Gemini client.

    Import is deferred so that the rest of the application can load
    without the SDK installed (e.g. if only mock mode is needed) — though
    in practice google-genai is always in requirements.txt for Phase 2.
    """
    try:
        from google import genai  # type: ignore[import]
    except ImportError as exc:
        raise LLMMisconfiguredError(
            "google-genai package is not installed. "
            "Run: pip install google-genai"
        ) from exc

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise LLMMisconfiguredError(
            "GEMINI_API_KEY is not set. "
            "Set it in your .env file or environment. "
            "To run without a key, set TUTOR_MOCK_MODE=true."
        )

    return genai.Client(api_key=api_key)


def call_gemini(system_prompt: str, user_prompt: str) -> TutorResponse:
    """
    Call the Gemini API and return a validated TutorResponse.

    Parameters
    ----------
    system_prompt:
        The tutor system instructions.
    user_prompt:
        The formatted learner context prompt.

    Returns
    -------
    TutorResponse
        Structured response parsed from Gemini's JSON output.

    Raises
    ------
    LLMMisconfiguredError
        If the API key is missing or the SDK is not installed.
    LLMProviderError
        If the Gemini API call fails (network, quota, etc.).
    LLMResponseError
        If the response cannot be parsed into TutorResponse.
    """
    try:
        from google.genai import types as genai_types  # type: ignore[import]
    except ImportError as exc:
        raise LLMMisconfiguredError(
            "google-genai package is not installed."
        ) from exc

    client = _get_client()
    model = settings.GEMINI_MODEL

    logger.info("Calling Gemini | model=%s", model)

    try:
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=TutorResponse,
            ),
        )
    except Exception as exc:
        # Translate any SDK / network / quota error into our type.
        logger.error("Gemini API call failed: %s", type(exc).__name__)
        raise LLMProviderError(
            f"Gemini API call failed: {type(exc).__name__}"
        ) from exc

    logger.info("Gemini call succeeded.")

    # Parse the response
    raw_text = response.text
    if not raw_text or not raw_text.strip():
        raise LLMResponseError("Gemini returned an empty response.")

    try:
        data = json.loads(raw_text)
        return TutorResponse(**data)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.error("Failed to parse Gemini response as TutorResponse.")
        raise LLMResponseError(
            f"Gemini response could not be parsed: {exc}"
        ) from exc
