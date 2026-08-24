"""
FastAPI application entry point.

Startup sequence
----------------
1. Setup logging.
2. Create the FastAPI app with metadata.
3. Register the /health endpoint.
4. Mount the versioned API router at /api/v1.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

# Configure logging as early as possible.
setup_logging()

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
# Lifespan (replaces deprecated @app.on_event)
# ------------------------------------------------------------------ #


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup and shutdown."""
    # --- startup ---
    logger.info(
        "AI Tutor started | env=%s version=%s",
        settings.APP_ENV,
        settings.APP_VERSION,
    )
    yield
    # --- shutdown ---
    logger.info("AI Tutor shutting down.")


app = FastAPI(
    title="LearnTrace AI Tutor",
    description=(
        "Backend service that generates contextual tutoring content for "
        "LearnTrace learners.  Phase 1: foundation with placeholder responses."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ------------------------------------------------------------------ #
# Health endpoint
# ------------------------------------------------------------------ #


@app.get("/health", tags=["health"], summary="Service health check")
def health() -> dict[str, str]:
    """
    Returns the current health status of the AI Tutor service.

    Used by infrastructure tooling (load balancers, orchestrators) to
    verify that the service is running and reachable.
    """
    return {"status": "ok", "service": "ai-tutor"}


# ------------------------------------------------------------------ #
# Versioned API
# ------------------------------------------------------------------ #

app.include_router(api_router, prefix=settings.API_V1_PREFIX)
