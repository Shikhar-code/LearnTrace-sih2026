"""
Tests for Groq provider and primary->fallback provider behavior.

All tests run WITHOUT calling any real external API.
Both the Gemini and Groq SDKs are mocked at the provider boundary.

Test matrix
-----------
Provider tests:
 1. Gemini provider success.
 2. Groq provider success.
 3. Gemini provider failure.
 4. Groq provider failure.
 5. Structured response from Groq is validated.

Fallback tests:
 6. Gemini succeeds -> Groq is NOT called.
 7. Gemini returns 429 (LLMProviderError) -> Groq is called.
 8. Gemini timeout (LLMProviderError) -> Groq is called.
 9. Gemini transient provider failure -> Groq is called.
10. Gemini invalid app input (LLMMisconfiguredError) -> Groq is NOT called.
11. Gemini validation failure -> no blind provider fallback.
12. Gemini fails + Groq succeeds -> valid TutorResponse returned.
13. Gemini fails + Groq fails -> controlled application error.
14. Mock mode -> neither provider is called.

Configuration tests:
15. Gemini is the default provider.
16. Groq configuration is loaded correctly.
17. Missing Groq API key is handled cleanly when Groq is required.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings, settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.schemas.tutor import PracticeQuestion, TutorContext, TutorResponse
from app.services.llm_service import LLMService
from app.services.tutor_service import TutorService


# ------------------------------------------------------------------ #
# Shared helpers
# ------------------------------------------------------------------ #

def _valid_response() -> TutorResponse:
    """Return a fully valid TutorResponse that passes all validators."""
    return TutorResponse(
        explanation=(
            "Your answer was incorrect because the two concepts are fundamentally "
            "different, and understanding this distinction is essential for "
            "mastering the topic at hand."
        ),
        simple_explanation=(
            "Think of it as the difference between the whole group you care about "
            "and the specific reachable list you actually use to select from."
        ),
        worked_example=(
            "For example, consider a researcher studying university students in a city. "
            "The population is every student in the city, but the sampling frame is the "
            "specific enrollment list from which they draw their actual sample."
        ),
        practice_question=PracticeQuestion(
            question="Which of the following best describes a sampling frame?",
            options=[
                "A list of all population members reachable for a study",
                "The complete population",
                "The final collected sample",
                "A type of survey instrument",
            ],
            correct_option="A list of all population members reachable for a study",
            explanation=(
                "The correct answer is 'A list of all population members reachable for a study'. "
                "The sampling frame is the operational list from which the researcher "
                "draws their actual sample, distinct from the broader population."
            ),
        ),
    )


VALID_CONTEXT = TutorContext(
    competency={"id": "c1", "name": "Sampling Concepts"},
    question={
        "id": "q1",
        "text": "What is a sampling frame?",
        "options": [
            "The population",
            "A list from which the sample is drawn",
            "The sample itself",
            "The census",
        ],
    },
    learner_answer="The population",
    correct_answer="A list from which the sample is drawn",
)


# ================================================================== #
# 1. Gemini provider success
# ================================================================== #

def test_gemini_provider_success() -> None:
    """call_gemini should return a TutorResponse on success."""
    expected = _valid_response()

    with patch(
        "app.services.providers.gemini._get_client"
    ) as mock_get_client, patch(
        "app.services.providers.gemini.settings"
    ) as mock_settings:
        mock_settings.GEMINI_MODEL = "gemini-2.0-flash"
        mock_settings.GEMINI_API_KEY = "fake-key"

        # Build a mock response object that mimics google-genai's response.
        mock_response = MagicMock()
        import json as _json
        mock_response.text = _json.dumps(expected.model_dump())
        mock_get_client.return_value.models.generate_content.return_value = mock_response

        from app.services.providers.gemini import call_gemini
        result = call_gemini("system", "user")

    assert isinstance(result, TutorResponse)
    assert result.explanation == expected.explanation


# ================================================================== #
# 2. Groq provider success
# ================================================================== #

def test_groq_provider_success() -> None:
    """call_groq should return a TutorResponse on success."""
    expected = _valid_response()

    with patch(
        "app.services.providers.groq._get_client"
    ) as mock_get_client, patch(
        "app.services.providers.groq.settings"
    ) as mock_settings:
        mock_settings.GROQ_MODEL = "openai/gpt-oss-20b"
        mock_settings.GROQ_API_KEY = "fake-key"

        import json as _json
        raw = _json.dumps(expected.model_dump())
        mock_choice = MagicMock()
        mock_choice.message.content = raw
        mock_get_client.return_value.chat.completions.create.return_value.choices = [mock_choice]

        from app.services.providers.groq import call_groq
        result = call_groq("system", "user")

    assert isinstance(result, TutorResponse)
    assert result.explanation == expected.explanation


# ================================================================== #
# 3. Gemini provider failure raises LLMProviderError
# ================================================================== #

def test_gemini_provider_failure_raises_llm_provider_error() -> None:
    """Gemini SDK errors should be translated to LLMProviderError."""
    with patch(
        "app.services.providers.gemini._get_client"
    ) as mock_get_client, patch(
        "app.services.providers.gemini.settings"
    ) as mock_settings:
        mock_settings.GEMINI_MODEL = "gemini-2.0-flash"
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_get_client.return_value.models.generate_content.side_effect = (
            RuntimeError("Simulated Gemini SDK error")
        )

        from app.services.providers.gemini import call_gemini
        with pytest.raises(LLMProviderError, match="Gemini API call failed"):
            call_gemini("system", "user")


# ================================================================== #
# 4. Groq provider failure raises LLMProviderError
# ================================================================== #

def test_groq_provider_failure_raises_llm_provider_error() -> None:
    """Groq SDK errors should be translated to LLMProviderError."""
    with patch(
        "app.services.providers.groq._get_client"
    ) as mock_get_client, patch(
        "app.services.providers.groq.settings"
    ) as mock_settings:
        mock_settings.GROQ_MODEL = "openai/gpt-oss-20b"
        mock_settings.GROQ_API_KEY = "fake-key"
        mock_get_client.return_value.chat.completions.create.side_effect = (
            RuntimeError("Simulated Groq SDK error")
        )

        from app.services.providers.groq import call_groq
        with pytest.raises(LLMProviderError, match="Groq API call failed"):
            call_groq("system", "user")


# ================================================================== #
# 5. Structured response from Groq is validated by TutorResponse schema
# ================================================================== #

def test_groq_structured_response_is_validated() -> None:
    """Groq responses must parse into and pass TutorResponse validation."""
    expected = _valid_response()

    with patch(
        "app.services.providers.groq._get_client"
    ) as mock_get_client, patch(
        "app.services.providers.groq.settings"
    ) as mock_settings:
        mock_settings.GROQ_MODEL = "openai/gpt-oss-20b"
        mock_settings.GROQ_API_KEY = "fake-key"

        import json as _json
        raw = _json.dumps(expected.model_dump())
        mock_choice = MagicMock()
        mock_choice.message.content = raw
        mock_get_client.return_value.chat.completions.create.return_value.choices = [mock_choice]

        from app.services.providers.groq import call_groq
        from app.services.response_validator import validate_tutor_response

        result = call_groq("system", "user")
        # Should not raise
        validate_tutor_response(result)

    assert len(result.practice_question.options) == 4
    assert result.practice_question.correct_option in result.practice_question.options


# ================================================================== #
# 6. Gemini succeeds -> Groq is NOT called
# ================================================================== #

def test_gemini_success_groq_not_called() -> None:
    """When Gemini succeeds, the fallback (Groq) must never be invoked."""
    expected = _valid_response()
    llm_service = LLMService()

    with patch(
        "app.services.llm_service.LLMService._call_with_fallback"
    ) as mock_fallback:
        # Simulate success from the fallback method that normally calls both.
        mock_fallback.return_value = expected

        # Instead, test at the provider level.
        pass

    # More precise: mock call_gemini to succeed, mock call_groq to fail if called.
    with patch(
        "app.services.providers.gemini.call_gemini", return_value=expected
    ) as mock_gemini, patch(
        "app.services.providers.groq.call_groq"
    ) as mock_groq:
        llm_service2 = LLMService()
        result = llm_service2._call_with_fallback("sys", "usr")

    mock_gemini.assert_called_once()
    mock_groq.assert_not_called()
    assert result == expected


# ================================================================== #
# 7. Gemini 429 -> Groq is called
# ================================================================== #

def test_gemini_rate_limit_triggers_groq_fallback() -> None:
    """A 429 / rate-limit error from Gemini (LLMProviderError) must trigger Groq."""
    expected = _valid_response()

    with patch(
        "app.services.providers.gemini.call_gemini",
        side_effect=LLMProviderError("429 Too Many Requests"),
    ), patch(
        "app.services.providers.groq.call_groq",
        return_value=expected,
    ) as mock_groq:
        service = LLMService()
        result = service._call_with_fallback("sys", "usr")

    mock_groq.assert_called_once()
    assert result == expected


# ================================================================== #
# 8. Gemini timeout -> Groq is called
# ================================================================== #

def test_gemini_timeout_triggers_groq_fallback() -> None:
    """A timeout from Gemini (LLMProviderError) must trigger Groq."""
    expected = _valid_response()

    with patch(
        "app.services.providers.gemini.call_gemini",
        side_effect=LLMProviderError("TimeoutError"),
    ), patch(
        "app.services.providers.groq.call_groq",
        return_value=expected,
    ) as mock_groq:
        service = LLMService()
        result = service._call_with_fallback("sys", "usr")

    mock_groq.assert_called_once()
    assert result == expected


# ================================================================== #
# 9. Gemini transient provider failure -> Groq is called
# ================================================================== #

def test_gemini_transient_error_triggers_groq_fallback() -> None:
    """Any LLMProviderError from Gemini must trigger the Groq fallback."""
    expected = _valid_response()

    with patch(
        "app.services.providers.gemini.call_gemini",
        side_effect=LLMProviderError("ServiceUnavailableError"),
    ), patch(
        "app.services.providers.groq.call_groq",
        return_value=expected,
    ) as mock_groq:
        service = LLMService()
        result = service._call_with_fallback("sys", "usr")

    mock_groq.assert_called_once()
    assert result == expected


# ================================================================== #
# 10. Gemini misconfigured -> Groq is NOT called (propagates immediately)
# ================================================================== #

def test_gemini_misconfigured_does_not_trigger_groq_fallback() -> None:
    """LLMMisconfiguredError from Gemini must propagate; Groq must not be called."""
    with patch(
        "app.services.providers.gemini.call_gemini",
        side_effect=LLMMisconfiguredError("GEMINI_API_KEY not set"),
    ), patch(
        "app.services.providers.groq.call_groq"
    ) as mock_groq:
        service = LLMService()
        with pytest.raises(LLMMisconfiguredError):
            service._call_with_fallback("sys", "usr")

    mock_groq.assert_not_called()


# ================================================================== #
# 11. Gemini validation failure -> no blind provider fallback
# ================================================================== #

def test_validation_failure_does_not_trigger_provider_fallback() -> None:
    """
    LLMResponseError (malformed output) must NOT trigger the Groq fallback.

    The retry loop in generate() handles validation failures independently
    of provider availability.  Calling Groq for every bad response would
    waste API quota and could cause incorrect fallback semantics.
    """
    # _call_provider returns a valid TutorResponse but validation fails later.
    # We mock _call_provider to return a response that *looks* structurally
    # valid but whose correct_option is not in options, so validate_tutor_response
    # raises LLMResponseError.
    bad_response = TutorResponse(
        explanation="x" * 100,
        simple_explanation="x" * 80,
        worked_example="x" * 100,
        practice_question=PracticeQuestion(
            question="Which is it?",
            options=["A", "B", "C", "D"],
            correct_option="Z",   # not in options -- validator will fail
            explanation="x" * 50,
        ),
    )

    service = LLMService()

    with patch.object(
        service, "_call_provider", return_value=bad_response
    ) as mock_provider, patch(
        "app.services.providers.groq.call_groq"
    ) as mock_groq:
        with pytest.raises(LLMResponseError):
            service.generate("sys", "usr")

    # Provider was called (up to _MAX_RESPONSE_RETRIES times) but
    # the Groq fallback at the call_groq level was never invoked directly.
    assert mock_provider.call_count >= 1
    mock_groq.assert_not_called()


# ================================================================== #
# 12. Gemini fails + Groq succeeds -> valid TutorResponse returned
# ================================================================== #

def test_gemini_fails_groq_succeeds_returns_valid_response() -> None:
    """End-to-end: Gemini provider error -> fallback to Groq -> valid response."""
    expected = _valid_response()

    service = LLMService()

    with patch("app.services.llm_service.settings") as mock_settings, \
         patch(
             "app.services.providers.gemini.call_gemini",
             side_effect=LLMProviderError("Gemini 429"),
         ), patch(
             "app.services.providers.groq.call_groq",
             return_value=expected,
         ):
        mock_settings.LLM_PROVIDER = "gemini"  # ensure fallback chain is exercised
        result = service.generate("sys", "usr")

    assert isinstance(result, TutorResponse)
    assert result.explanation == expected.explanation


# ================================================================== #
# 13. Gemini fails + Groq fails -> controlled application error
# ================================================================== #

def test_both_providers_fail_raises_llm_provider_error() -> None:
    """When both providers fail, a clean LLMProviderError must be raised."""
    service = LLMService()

    with patch("app.services.llm_service.settings") as mock_settings, \
         patch(
             "app.services.providers.gemini.call_gemini",
             side_effect=LLMProviderError("Gemini down"),
         ), patch(
             "app.services.providers.groq.call_groq",
             side_effect=LLMProviderError("Groq also down"),
         ):
        mock_settings.LLM_PROVIDER = "gemini"  # ensure fallback chain is exercised
        with pytest.raises(LLMProviderError):
            service.generate("sys", "usr")


# ================================================================== #
# 14. Mock mode -> neither provider is called
# ================================================================== #

def test_mock_mode_calls_neither_provider() -> None:
    """
    When TUTOR_MOCK_MODE=true, neither Gemini nor Groq should be invoked.
    This is enforced via TutorService routing.
    """
    service = TutorService()

    with patch("app.services.tutor_service.settings") as mock_settings, \
         patch("app.services.providers.gemini.call_gemini") as mock_gemini, \
         patch("app.services.providers.groq.call_groq") as mock_groq:

        mock_settings.TUTOR_MOCK_MODE = True
        result = service.explain(VALID_CONTEXT)

    mock_gemini.assert_not_called()
    mock_groq.assert_not_called()
    assert isinstance(result, TutorResponse)


# ================================================================== #
# 15. Gemini is the default primary provider
# ================================================================== #

def test_gemini_is_default_provider() -> None:
    """
    The Settings field default for LLM_PROVIDER must be 'gemini'.

    This checks the code-level default, not the live process value,
    so it remains correct regardless of what the local .env file sets.
    """
    from pydantic.fields import FieldInfo
    field: FieldInfo = Settings.model_fields["LLM_PROVIDER"]
    assert field.default.lower() == "gemini"


# ================================================================== #
# 16. Groq configuration is loaded correctly
# ================================================================== #

def test_groq_configuration_is_loaded() -> None:
    """GROQ_API_KEY and GROQ_MODEL must be accessible from settings."""
    # We only check that the attributes exist and have the correct types.
    # We do NOT check the actual values (they are environment-specific).
    assert hasattr(settings, "GROQ_API_KEY")
    assert hasattr(settings, "GROQ_MODEL")
    assert isinstance(settings.GROQ_API_KEY, str)
    assert isinstance(settings.GROQ_MODEL, str)


# ================================================================== #
# 17. Missing Groq API key is handled cleanly when Groq is required
# ================================================================== #

def test_missing_groq_api_key_raises_misconfigured_error() -> None:
    """
    When Groq is the fallback and GROQ_API_KEY is empty, it should raise
    LLMMisconfiguredError -- not expose raw internals or crash unexpectedly.
    """
    with patch(
        "app.services.providers.groq.settings"
    ) as mock_settings:
        mock_settings.GROQ_API_KEY = ""

        from app.services.providers.groq import _get_client
        with pytest.raises(LLMMisconfiguredError, match="GROQ_API_KEY"):
            _get_client()


# ================================================================== #
# LLM_PROVIDER=groq primary-provider tests  (new in Phase 3.5 fix)
# ================================================================== #

# 18. LLM_PROVIDER=groq calls Groq directly, not via the fallback path.
def test_llm_provider_groq_dispatches_to_groq_directly() -> None:
    """
    When LLM_PROVIDER=groq, _call_provider must call call_groq directly.
    It must NOT enter _call_with_fallback (which would try Gemini first).
    """
    expected = _valid_response()
    service = LLMService()

    with patch("app.services.llm_service.settings") as mock_settings, \
         patch("app.services.providers.groq.call_groq", return_value=expected) as mock_groq, \
         patch.object(service, "_call_with_fallback") as mock_fallback:

        mock_settings.LLM_PROVIDER = "groq"
        result = service._call_provider("sys", "usr")

    mock_groq.assert_called_once_with("sys", "usr")
    mock_fallback.assert_not_called()
    assert result == expected


# 19. Gemini is never called when LLM_PROVIDER=groq.
def test_llm_provider_groq_never_calls_gemini() -> None:
    """
    When LLM_PROVIDER=groq, call_gemini must never be invoked,
    even if Groq succeeds on the first attempt.
    """
    expected = _valid_response()
    service = LLMService()

    with patch("app.services.llm_service.settings") as mock_settings, \
         patch("app.services.providers.groq.call_groq", return_value=expected), \
         patch("app.services.providers.gemini.call_gemini") as mock_gemini:

        mock_settings.LLM_PROVIDER = "groq"
        service._call_provider("sys", "usr")

    mock_gemini.assert_not_called()


# 20. Validation still runs for the Groq-primary path.
def test_llm_provider_groq_response_is_validated() -> None:
    """
    A bad response from Groq when it is the primary provider must still
    fail validation — the retry / validation layer is independent of which
    provider was used.
    """
    bad_response = TutorResponse(
        explanation="x" * 100,
        simple_explanation="x" * 80,
        worked_example="x" * 100,
        practice_question=PracticeQuestion(
            question="Which is it?",
            options=["A", "B", "C", "D"],
            correct_option="Z",   # not in options -- validator will fail
            explanation="x" * 50,
        ),
    )
    service = LLMService()

    with patch("app.services.llm_service.settings") as mock_settings, \
         patch("app.services.providers.groq.call_groq", return_value=bad_response):

        mock_settings.LLM_PROVIDER = "groq"
        with pytest.raises(LLMResponseError):
            service.generate("sys", "usr")


# 21. An unrecognised LLM_PROVIDER value is still rejected cleanly.
def test_unknown_llm_provider_raises_misconfigured_error() -> None:
    """
    A value other than 'gemini' or 'groq' must raise LLMMisconfiguredError,
    not crash with an AttributeError or an unhandled exception.
    """
    service = LLMService()

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "openai"
        with pytest.raises(LLMMisconfiguredError, match="Unknown LLM provider"):
            service._call_provider("sys", "usr")

