"""
Tests for POST /api/v1/tutor/explain

All tests are self-contained and require no LLM, database, or network.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.tutor import TutorResponse

client = TestClient(app)

EXPLAIN_URL = "/api/v1/tutor/explain"

# ------------------------------------------------------------------ #
# Shared fixture — a minimal valid request payload
# ------------------------------------------------------------------ #

VALID_PAYLOAD = {
    "competency": {
        "id": "sampling_concepts",
        "name": "Sampling Concepts",
    },
    "question": {
        "id": "q123",
        "text": "What is a sampling frame?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
    },
    "learner_answer": "Option A",
    "correct_answer": "Option B",
    "detected_gap": {
        "description": "Confusion between population and sampling frame",
    },
}


# ------------------------------------------------------------------ #
# 1. Valid request — HTTP status
# ------------------------------------------------------------------ #


def test_explain_returns_200_for_valid_request() -> None:
    response = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    assert response.status_code == 200


# ------------------------------------------------------------------ #
# 2. Invalid / missing required data
# ------------------------------------------------------------------ #


def test_explain_returns_422_when_body_missing() -> None:
    """No body at all should fail validation."""
    response = client.post(EXPLAIN_URL)
    assert response.status_code == 422


def test_explain_returns_422_when_competency_missing() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "competency"}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 422


def test_explain_returns_422_when_question_missing() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "question"}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 422


def test_explain_returns_422_when_learner_answer_missing() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "learner_answer"}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 422


def test_explain_returns_422_when_correct_answer_missing() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "correct_answer"}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 422


def test_explain_returns_422_when_question_has_too_few_options() -> None:
    """Question options must contain at least 2 items."""
    payload = dict(VALID_PAYLOAD)
    payload["question"] = {**VALID_PAYLOAD["question"], "options": ["Only one"]}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 422


# ------------------------------------------------------------------ #
# 3. detected_gap is optional
# ------------------------------------------------------------------ #


def test_explain_accepts_missing_detected_gap() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "detected_gap"}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 200


def test_explain_accepts_null_detected_gap() -> None:
    payload = {**VALID_PAYLOAD, "detected_gap": None}
    response = client.post(EXPLAIN_URL, json=payload)
    assert response.status_code == 200


# ------------------------------------------------------------------ #
# 4. Placeholder response — shape matches TutorResponse schema
# ------------------------------------------------------------------ #


def test_explain_response_contains_required_fields() -> None:
    response = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    data = response.json()
    assert "explanation" in data
    assert "simple_explanation" in data
    assert "worked_example" in data
    assert "practice_question" in data


def test_explain_response_practice_question_shape() -> None:
    response = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    pq = response.json()["practice_question"]
    assert "question" in pq
    assert "options" in pq
    assert "correct_option" in pq
    assert "explanation" in pq
    assert isinstance(pq["options"], list)
    assert len(pq["options"]) >= 2


def test_explain_response_is_valid_tutor_response() -> None:
    """Deserialise the response body into TutorResponse without error."""
    response = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    tutor_response = TutorResponse(**response.json())
    assert tutor_response.explanation
    assert tutor_response.simple_explanation
    assert tutor_response.worked_example
    assert tutor_response.practice_question.question


def test_explain_response_fields_are_non_empty_strings() -> None:
    response = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    data = response.json()
    assert isinstance(data["explanation"], str) and data["explanation"].strip()
    assert isinstance(data["simple_explanation"], str) and data["simple_explanation"].strip()
    assert isinstance(data["worked_example"], str) and data["worked_example"].strip()


def test_explain_placeholder_is_deterministic() -> None:
    """Calling the same endpoint twice with the same payload must return
    identical responses (important for Phase 1 placeholder behaviour)."""
    r1 = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    r2 = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    assert r1.json() == r2.json()


# ------------------------------------------------------------------ #
# 5. Competency context appears in the response
# ------------------------------------------------------------------ #


def test_explain_response_references_competency_name() -> None:
    """The placeholder should include the competency name in its output."""
    response = client.post(EXPLAIN_URL, json=VALID_PAYLOAD)
    data = response.json()
    competency_name = VALID_PAYLOAD["competency"]["name"]
    # At least one of the text fields should mention the competency name.
    combined = (
        data["explanation"]
        + data["simple_explanation"]
        + data["worked_example"]
    )
    assert competency_name in combined
