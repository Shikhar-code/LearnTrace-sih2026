"""
Logging foundation for the AI Tutor service.

Sets up a structured logger that can be imported throughout the
application.  Rules:
  - Never log API keys, secrets, or sensitive learner data.
  - Use INFO for normal operation, DEBUG for development diagnostics,
    ERROR/WARNING for problems.
"""

import logging
import sys

from app.core.config import settings

# Log format: timestamp  level  logger-name  message
_LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"
_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"


def _resolve_log_level() -> int:
    """Return the appropriate log level based on the current environment."""
    if settings.APP_ENV == "development":
        return logging.DEBUG
    return logging.INFO


def setup_logging() -> None:
    """Configure the root logger.

    Call this once at application startup (inside ``main.py``).
    Subsequent calls are safe but have no additional effect because
    basicConfig is idempotent when handlers are already attached.
    """
    logging.basicConfig(
        level=_resolve_log_level(),
        format=_LOG_FORMAT,
        datefmt=_DATE_FORMAT,
        stream=sys.stdout,
    )

    # Silence noisy third-party loggers in non-debug environments.
    if settings.APP_ENV != "development":
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger.

    Usage::

        from app.core.logging import get_logger
        logger = get_logger(__name__)
        logger.info("Service started")
    """
    return logging.getLogger(name)
