"""
Application-level exceptions for the AI Tutor.

These are intentionally separate from provider-specific exceptions.
The Gemini provider (and any future provider) translates its own SDK
errors into these types so that the rest of the application never
depends directly on a particular SDK's exception hierarchy.
"""


class TutorError(Exception):
    """Base class for all AI Tutor application errors."""


class LLMProviderError(TutorError):
    """
    Raised when the LLM provider call fails.

    Wraps network errors, timeouts, and provider API errors without
    exposing provider-specific types to callers.
    """


class LLMMisconfiguredError(TutorError):
    """
    Raised when required LLM configuration is absent or invalid.

    For example: GEMINI_API_KEY is empty while mock mode is disabled.
    """


class LLMResponseError(TutorError):
    """
    Raised when the LLM returns a response that fails validation.

    This covers:
    - malformed JSON structure
    - empty required fields
    - invalid practice question (duplicate options, missing correct_option, etc.)
    """
