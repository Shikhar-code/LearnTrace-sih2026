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

LLMService accepts prepared prompts and returns a TutorResponse.
It knows which provider to use from configuration but does not
contain any Gemini-specific or Groq-specific code itself.

Fallback behaviour
------------------
- Gemini is tried first (primary provider).
- If Gemini raises LLMProviderError (rate limit, timeout, transient
  network error), Groq is tried as the fallback.
- LLMMisconfiguredError from either provider propagates immediately
  (misconfiguration is not a transient failure).
- LLMResponseError (malformed output) triggers the retry loop inside
  generate(), NOT the provider fallback.  Validation problems are
  separate from provider availability problems.
- If both Gemini and Groq fail with LLMProviderError, a clean
  application-level LLMProviderError is raised.

Adding a new provider in the future requires only:
1. Implementing a new provider module under app/services/providers/.
2. Updating the routing logic in LLMService._call_provider().

No other layer needs to change.

Phase 3 change
--------------
generate() accepts an optional original_question_text parameter.
When supplied, it is forwarded to validate_tutor_response() so the
validator can reject a practice question identical to the original.
"""

import time

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.core.logging import get_logger
from app.schemas.tutor import TutorResponse
from app.services.response_validator import validate_tutor_response

logger = get_logger(__name__)

# Maximum number of attempts when the LLM returns a malformed response.
_MAX_RESPONSE_RETRIES = 2


class LLMService:
    """
    Provider-agnostic LLM interface.

    Handles:
    - Provider selection and delegation.
    - Primary -> fallback provider transition on recoverable failures.
    - One controlled retry on malformed response.
    - Response validation.
    """

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        original_question_text: str = "",
    ) -> TutorResponse:
        """
        Call the configured LLM provider and return a validated TutorResponse.

        Parameters
        ----------
        system_prompt:
            The tutor system instructions (built by the prompt layer).
        user_prompt:
            The formatted learner context (built by the prompt layer).
        original_question_text:
            Optional. The original question text from TutorContext.
            When supplied, the validator will reject a practice question
            that is exactly identical to the original.

        Returns
        -------
        TutorResponse
            Validated structured tutor output.

        Raises
        ------
        LLMMisconfiguredError
            If the provider cannot be initialised (missing key, etc.).
        LLMProviderError
            If the provider API call fails after retries.
        LLMResponseError
            If the provider returns an unrecoverable malformed response.
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
                # Only retry on malformed response, not on provider errors.
                if attempt < _MAX_RESPONSE_RETRIES:
                    continue
                break

            except (LLMProviderError, LLMMisconfiguredError):
                # Do not retry provider/config errors -- they won't self-heal.
                raise

        raise LLMResponseError(
            f"LLM returned an invalid response after "
            f"{_MAX_RESPONSE_RETRIES} attempts. Last error: {last_error}"
        )

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _call_provider(
        self, system_prompt: str, user_prompt: str
    ) -> TutorResponse:
        """
        Route the request to the configured primary provider.

        LLM_PROVIDER=gemini (default):
            Calls Gemini; falls back to Groq on LLMProviderError.
        LLM_PROVIDER=groq:
            Calls Groq directly; Gemini is never involved.

        Fallback is triggered only by LLMProviderError (rate limit, timeout,
        transient network/API errors).  LLMMisconfiguredError propagates
        immediately -- a missing API key is not a transient condition.
        LLMResponseError (malformed output) is handled by the retry loop in
        generate(), not here.
        """
        provider_name = (settings.LLM_PROVIDER or "gemini").lower()

        if provider_name == "gemini":
            return self._call_with_fallback(system_prompt, user_prompt)

        if provider_name == "groq":
            from app.services.providers.groq import call_groq

            logger.info("Primary LLM provider: Groq")
            return call_groq(system_prompt, user_prompt)

        raise LLMMisconfiguredError(
            f"Unknown LLM provider '{provider_name}'. "
            "Set LLM_PROVIDER=gemini or LLM_PROVIDER=groq in your .env file."
        )

    def _call_with_fallback(
        self, system_prompt: str, user_prompt: str
    ) -> TutorResponse:
        """
        Try Gemini (primary); on LLMProviderError fall back to Groq.

        LLMMisconfiguredError from Gemini propagates immediately.
        If both fail, raises a clean LLMProviderError.
        """
        from app.services.providers.gemini import call_gemini
        from app.services.providers.groq import call_groq

        # Primary: Gemini
        logger.info("Primary LLM provider: Gemini")
        try:
            return call_gemini(system_prompt, user_prompt)
        except LLMProviderError as primary_exc:
            logger.warning(
                "Primary provider failed, attempting fallback: Groq. Reason: %s",
                primary_exc,
            )
        # LLMMisconfiguredError is intentionally NOT caught here -- it
        # propagates up so the caller receives a 503, not a 502.

        # Fallback: Groq
        try:
            result = call_groq(system_prompt, user_prompt)
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
