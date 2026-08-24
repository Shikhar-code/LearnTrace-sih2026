"""
Tests for GET /health
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_status_is_ok() -> None:
    response = client.get("/health")
    data = response.json()
    assert data["status"] == "ok"


def test_health_service_name() -> None:
    response = client.get("/health")
    data = response.json()
    assert data["service"] == "ai-tutor"


def test_health_response_shape() -> None:
    """Response must contain exactly the keys 'status' and 'service'."""
    response = client.get("/health")
    data = response.json()
    assert set(data.keys()) == {"status", "service"}
