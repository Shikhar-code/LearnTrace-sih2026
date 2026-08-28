"""
LLM Service -- provider-agnostic abstraction layer.

Position in the pipeline
------------------------
TutorService
    |
LLMService          <- this module
    |
GeminiProvider      (app/services/providers/gemini.py)   <- primary
    | (on recoverable provider failure only)
GroqProvider        (app/services/providers/groq.py)     <- fallback

LLMService accepts prepared prompts and returns a validated Pydantic model (TutorResponse or QuizTutorResponse).
"""

import time
from typing import Any, Type, TypeVar

from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.quiz_tutor import QuizTutorContext, QuizTutorResponse
from app.schemas.tutor import TutorResponse
from app.services.response_validator import validate_quiz_tutor_response, validate_tutor_response

logger = get_logger(__name__)

# Maximum number of attempts when the LLM returns a malformed response.
_MAX_RESPONSE_RETRIES = 2

T = TypeVar("T", bound=BaseModel)


class LLMService:
    """
    Provider-agnostic LLM interface.
    """

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        original_question_text: str = "",
    ) -> TutorResponse:
        """
        Call the configured LLM provider for Mode 1 and return a validated TutorResponse.
        """
        last_error: Exception | None = None

        for attempt in range(1, _MAX_RESPONSE_RETRIES + 1):
            try:
                t0 = time.monotonic()
                response = self._call_provider(system_prompt, user_prompt)
                elapsed = time.monotonic() - t0

                validate_tutor_response(
                    response,
                    original_question_text=original_question_text,
                )

                logger.info(
                    "LLM response validated | attempt=%d elapsed=%.2fs",
                    attempt,
                    elapsed,
                )
                return response

            except LLMResponseError as exc:
                logger.warning(
                    "LLM response validation failed (attempt %d/%d): %s",
                    attempt,
                    _MAX_RESPONSE_RETRIES,
                    exc,
                )
                last_error = exc
                if attempt < _MAX_RESPONSE_RETRIES:
                    continue
                break

            except (LLMProviderError, LLMMisconfiguredError):
                raise

        raise LLMResponseError(
            f"LLM returned an invalid response after "
            f"{_MAX_RESPONSE_RETRIES} attempts. Last error: {last_error}"
        )

    def generate_quiz(
        self,
        system_prompt: str,
        user_prompt: str,
        context: QuizTutorContext,
    ) -> QuizTutorResponse:
        """
        Call the configured LLM provider for Mode 2 and return a validated QuizTutorResponse.
        """
        last_error: Exception | None = None

        for attempt in range(1, _MAX_RESPONSE_RETRIES + 1):
            try:
                t0 = time.monotonic()
                response = self._call_provider(system_prompt, user_prompt, response_model=QuizTutorResponse)
                elapsed = time.monotonic() - t0

                validate_quiz_tutor_response(response, context)

                logger.info(
                    "LLM quiz response validated | attempt=%d elapsed=%.2fs",
                    attempt,
                    elapsed,
                )
                return response

            except LLMResponseError as exc:
                logger.warning(
                    "LLM quiz response validation failed (attempt %d/%d): %s",
                    attempt,
                    _MAX_RESPONSE_RETRIES,
                    exc,
                )
                last_error = exc
                if attempt < _MAX_RESPONSE_RETRIES:
                    continue
                break

            except (LLMProviderError, LLMMisconfiguredError):
                raise

        raise LLMResponseError(
            f"LLM returned an invalid quiz response after "
            f"{_MAX_RESPONSE_RETRIES} attempts. Last error: {last_error}"
        )

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _call_provider(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[BaseModel] = TutorResponse,
    ) -> Any:
        provider_name = (settings.LLM_PROVIDER or "gemini").lower()

        if provider_name == "gemini":
            return self._call_with_fallback(system_prompt, user_prompt, response_model=response_model)

        if provider_name == "groq":
            from app.services.providers.groq import call_groq

            logger.info("Primary LLM provider: Groq")
            if response_model == TutorResponse:
                return call_groq(system_prompt, user_prompt)
            return call_groq(system_prompt, user_prompt, response_model=response_model)

        raise LLMMisconfiguredError(
            f"Unknown LLM provider '{provider_name}'. "
            "Set LLM_PROVIDER=gemini or LLM_PROVIDER=groq in your .env file."
        )

    def _call_with_fallback(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[BaseModel] = TutorResponse,
    ) -> Any:
        from app.services.providers.gemini import call_gemini
        from app.services.providers.groq import call_groq

        # Primary: Gemini
        logger.info("Primary LLM provider: Gemini")
        try:
            if response_model == TutorResponse:
                return call_gemini(system_prompt, user_prompt)
            return call_gemini(system_prompt, user_prompt, response_model=response_model)
        except LLMProviderError as primary_exc:
            logger.warning(
                "Primary provider failed, attempting fallback: Groq. Reason: %s",
                primary_exc,
            )

        # Fallback: Groq
        try:
            if response_model == TutorResponse:
                return call_groq(system_prompt, user_prompt)
            result = call_groq(system_prompt, user_prompt, response_model=response_model)
            logger.info("Fallback provider succeeded: Groq")
            return result
        except (LLMProviderError, LLMMisconfiguredError) as fallback_exc:
            logger.error(
                "Primary and fallback providers failed. Groq error: %s",
                type(fallback_exc).__name__,
            )
            raise LLMProviderError(
                "Both primary (Gemini) and fallback (Groq) providers failed."
            ) from fallback_exc
