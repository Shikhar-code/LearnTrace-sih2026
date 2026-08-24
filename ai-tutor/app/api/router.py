"""
Top-level API router for /api/v1.

All versioned sub-routers are registered here.
"""

from fastapi import APIRouter

from app.api.routes import tutor as tutor_routes

api_router = APIRouter()

api_router.include_router(tutor_routes.router)
