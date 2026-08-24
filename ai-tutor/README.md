# LearnTrace AI Tutor

> **Backend-only module.** No frontend, no database, no LLM (Phase 1).

The AI Tutor is a focused backend service within the LearnTrace platform. It receives structured assessment context from the LearnTrace backend and returns tutoring content that helps a learner understand their mistake.

---

## Responsibility

The AI Tutor does one thing:

```
LearnTrace trusted context
        ↓
      AI Tutor
        ↓
  Explain the mistake
  Explain the concept simply
  Give a relevant example
  Generate one similar practice question
```

It is **not** a general-purpose chat assistant.

### What the AI Tutor does NOT own

These responsibilities belong to other LearnTrace components. The AI Tutor only consumes their output.

| Responsibility | Owner |
|---|---|
| Mastery calculation | LearnTrace core |
| Competency scoring | LearnTrace core |
| Root-gap detection | LearnTrace core |
| Competency graph reasoning | LearnTrace core |
| Prerequisite relationships | LearnTrace core |
| Learning-path generation | LearnTrace core |
| Official assessment correctness | LearnTrace core |
| Database persistence | LearnTrace database team |

---

## Project Structure

```
ai-tutor/
├── app/
│   ├── main.py                  # FastAPI app, /health endpoint, lifespan
│   ├── api/
│   │   ├── router.py            # Mounts all versioned routes at /api/v1
│   │   └── routes/
│   │       └── tutor.py         # POST /api/v1/tutor/explain
│   ├── schemas/
│   │   └── tutor.py             # TutorContext (request) + TutorResponse (response)
│   ├── services/
│   │   └── tutor_service.py     # TutorService — business logic layer
│   └── core/
│       ├── config.py            # Centralised settings via pydantic-settings
│       └── logging.py           # Logging setup and get_logger() helper
├── tests/
│   ├── test_health.py
│   └── test_tutor.py
├── .env.example
├── .gitignore
├── pytest.ini
├── requirements.txt
└── README.md
```

---

## Technology

| Package | Purpose |
|---|---|
| Python 3.11+ | Language |
| FastAPI | Web framework |
| Pydantic v2 | Request/response validation |
| pydantic-settings | Environment-based configuration |
| Uvicorn | ASGI server |
| pytest | Test runner |
| httpx | HTTP client (used by FastAPI TestClient) |

---

## Setup (Windows)

```powershell
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

**Run locally:**

```powershell
uvicorn app.main:app --reload
```

**Run tests:**

```powershell
pytest
```

**Local API documentation:**

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## API Endpoints

### `GET /health`

Service health check.

```json
{
  "status": "ok",
  "service": "ai-tutor"
}
```

---

### `POST /api/v1/tutor/explain`

Generate a tutoring response for a learner's incorrect answer.

**Request — `TutorContext`**

```json
{
  "competency": {
    "id": "sampling_concepts",
    "name": "Sampling Concepts"
  },
  "question": {
    "id": "q123",
    "text": "What is a sampling frame?",
    "options": [
      "The entire population",
      "A list from which the sample is selected",
      "The selected sample",
      "The survey result"
    ]
  },
  "learner_answer": "The entire population",
  "correct_answer": "A list from which the sample is selected",
  "detected_gap": {
    "description": "Confusion between population and sampling frame"
  }
}
```

> `detected_gap` is optional. The LearnTrace mastery engine may or may not supply it.

This is an integration-oriented API/domain representation and may be refined in collaboration with the main LearnTrace backend team.

**Response — `TutorResponse`**

```json
{
  "explanation": "...",
  "simple_explanation": "...",
  "worked_example": "...",
  "practice_question": {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correct_option": "...",
    "explanation": "..."
  }
}
```

The response contains:

1. Why the learner's answer was wrong.
2. A simple explanation of the relevant concept.
3. One relevant worked example.
4. One similar practice question.

---

## Architecture

```
LearnTrace Backend
       ↓
   Tutor API
       ↓
 TutorService
       ↓
 Future LLM Service   ← swappable, provider-agnostic
       ↓
      LLM
       ↓
Structured Tutor Response
```

The LLM provider and prompting logic sit behind the `TutorService` / LLM service boundary. The rest of LearnTrace integrates through the API contract and does not need to know which provider or model is in use.

---

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | `development` | Runtime environment |
| `LLM_PROVIDER` | *(empty)* | Phase 2+ |
| `LLM_MODEL` | *(empty)* | Phase 2+ |
| `LLM_API_KEY` | *(empty)* | **Never commit.** Phase 2+ |

---

## Current Limitations (Phase 1)

- No real LLM — `TutorService` returns a deterministic placeholder response.
- No conversation persistence.
- No database connection.
- No mastery logic or gap detection (those live in LearnTrace core).
- No learning-path logic.
- No frontend (separate team).

---

## Design Principles

**Focused responsibility** — The AI Tutor teaches. LearnTrace's core systems reason about the learner.

**Stable API** — Other teams integrate through the API contract, not internal implementation details.

**Modular internals** — LLM providers and prompting logic are replaceable without changing the API.

**Simple MVP** — A small, reliable system is preferred over unnecessary infrastructure.

**Safe failure** — A failure in the external LLM call must not bring down the rest of LearnTrace.

---

## Roadmap

### Phase 1 — Backend Foundation ✅ Complete

- FastAPI setup and API versioning
- Pydantic request/response schemas
- `TutorService` with placeholder response
- Centralised configuration and logging
- pytest test suite (19 tests, all passing)
- Documentation

### Phase 2 — LLM Integration

- LLM provider abstraction (`LLMService`)
- Prompt construction (`PromptService`)
- Tutor system prompt
- Structured LLM response parsing
- Response validation

### Phase 3 — Core Tutor Behaviour

Implement the full tutoring flow from trusted context:

```
Learner mistake
  → explain why it is wrong
  → explain the concept simply
  → give a relevant example
  → generate one similar practice question
```

### Phase 4 — Reliability

- LLM timeout handling and controlled retries
- Malformed response handling
- Prompt-injection protection
- Structured validation
- Observability and logging

### Phase 5 — LearnTrace Integration

Connect the Tutor API with the real LearnTrace backend and consume actual trusted assessment context from the mastery and competency systems.

### Optional Later Features

- Multilingual explanations
- Contextual follow-up questions within a session
- Additional tutoring strategies
- Tutor analytics

---

## Database

The AI Tutor does not own persistence and does not connect to the LearnTrace database directly. It is stateless: all context is provided per request by the LearnTrace backend.

## Frontend

This is a **backend-only** module. The LearnTrace frontend team is responsible for the UI and will consume the Tutor API endpoints.
