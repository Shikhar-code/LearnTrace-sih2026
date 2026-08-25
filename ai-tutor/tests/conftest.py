"""
Pytest configuration — shared fixtures and session-level setup.

IMPORTANT — Mock mode enforcement
----------------------------------
All tests in this suite MUST run in mock mode regardless of what the
local .env file specifies.

Rationale:
- Tests must be deterministic, fast, and free of network calls.
- The real Gemini API is non-deterministic, rate-limited, and requires
  a live API key — none of which are appropriate for a test suite.
- The local .env may have TUTOR_MOCK_MODE=false for development use,
  but tests must never inherit that setting.

This conftest.py sets TUTOR_MOCK_MODE=true at the OS environment level
*before* any application modules are imported, ensuring the setting
takes effect regardless of the .env file.
"""

import os

# Force mock mode for every test session.
# This must be set before any app module is imported.
os.environ["TUTOR_MOCK_MODE"] = "true"
