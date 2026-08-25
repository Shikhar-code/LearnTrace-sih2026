# LearnTrace AI Tutor

> **Backend-only module.** Phase 2: Gemini LLM integration with mock mode.

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
│   ├── main.py                         # FastAPI app, /health, lifespan
│   ├── api/
│   │   ├── router.py                   # Mounts all versioned routes at /api/v1
│   │   └── routes/
│   │       └── tutor.py                # POST /api/v1/tutor/explain
│   ├── schemas/
│   │   └── tutor.py                    # TutorContext (request) + TutorResponse (response)
│   ├── prompts/
│   │   └── tutor.py                    # System prompt + build_tutor_prompt()
│   ├── services/
│   │   ├── tutor_service.py            # TutorService — orchestration layer
│   │   ├── llm_service.py              # LLMService — provider-agnostic interface
│   │   ├── response_validator.py       # Semantic validation of LLM output
│   │   └── providers/
│   │       └── gemini.py               # Gemini SDK implementation
│   └── core/
│       ├── config.py                   # Settings (pydantic-settings)
│       ├── exceptions.py               # Application-level exception types
│       └── logging.py                  # Logging setup
├── tests/
│   ├── test_health.py                  # Health endpoint tests
│   ├── test_tutor.py                   # Phase 1 endpoint tests (all still pass)
│   └── test_llm_service.py             # Phase 2 LLM integration tests
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
| google-genai | Official Gemini SDK (Phase 2) |
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

# Copy the environment template
Copy-Item .env.example .env
```

Edit `.env` — for mock mode (no Gemini key needed):

```
TUTOR_MOCK_MODE=true
```

For real Gemini calls:

```
TUTOR_MOCK_MODE=false
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.0-flash
```

**Run locally:**

```powershell
uvicorn app.main:app --reload
```

**Run tests (no Gemini key required):**

```powershell
pytest
```

**Local API documentation:**

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Mock Mode

Set `TUTOR_MOCK_MODE=true` (the default) to run without calling the Gemini API.

- All tests pass in mock mode — no API key required.
- The mock response uses the **same schema** as a real Gemini response.
- Safe for local development and CI/CD.

Set `TUTOR_MOCK_MODE=false` to enable real Gemini calls. You must also set `GEMINI_API_KEY`.

---

## Architecture

```
LearnTrace Backend
       ↓
   Tutor API  (POST /api/v1/tutor/explain)
       ↓
 TutorService
  ├─ Mock mode → deterministic response
  └─ Real mode ↓
          LLMService        (provider-agnostic)
               ↓
          GeminiProvider    (google-genai SDK)
               ↓
          Gemini LLM
               ↓
          Structured JSON response (validated)
               ↓
          TutorResponse
```

The Gemini provider sits entirely behind the `LLMService` boundary. The API layer and schemas never depend on the Gemini SDK directly. Swapping providers requires only a new file under `app/services/providers/`.

---

## API Endpoints

### `GET /health`

Service health check.

```json
{ "status": "ok", "service": "ai-tutor" }
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

> `detected_gap` is optional.

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

**Error responses:**

| HTTP | Cause |
|---|---|
| 422 | Invalid request body (Pydantic validation) |
| 502 | Gemini API failure or malformed LLM response |
| 503 | LLM not configured (missing API key in real mode) |

---

## Structured Output

The Gemini provider uses `response_schema=TutorResponse` in the Gemini API config. This requests structured JSON output matching the `TutorResponse` Pydantic model directly — no manual JSON parsing from free-form text.

After receiving the response, the service additionally validates:
- All text fields are non-empty.
- Practice question has exactly four distinct options.
- `correct_option` matches one of the four options exactly.

If validation fails, one retry is attempted. If both fail, HTTP 502 is returned.

---

## Security

- API keys are never hardcoded — always read from environment.
- `.env` is in `.gitignore` and must never be committed.
- Learner-supplied fields (learner answer, question text, detected gap) are embedded inside clearly labelled prompt sections — they are treated as data, not as instructions.
- The system prompt and API keys are never exposed in responses.
- Raw provider exceptions are never returned to API consumers.

---

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | `development` | Runtime environment |
| `TUTOR_MOCK_MODE` | `true` | `false` to call Gemini |
| `GEMINI_API_KEY` | *(empty)* | Required when mock mode is off |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |

---

## Testing Without Gemini

All tests run in mock mode by default. No Gemini key is needed.

```powershell
pytest
```

The Phase 2 test file (`tests/test_llm_service.py`) mocks the Gemini provider at the service boundary so no network calls are made.

---

## Current Limitations

- No conversation persistence across requests (stateless by design).
- No database connection.
- No mastery logic, gap detection, or learning-path logic (those live in LearnTrace core).
- No frontend (separate team).
- One practice question per response (by design — MVP scope).

---

## Design Principles

**Focused responsibility** — The AI Tutor teaches. LearnTrace's core systems reason about the learner.

**Stable API** — Other teams integrate through the API contract, not internal implementation details.

**Modular internals** — The Gemini provider is isolated behind `LLMService`. Replacing it requires only a new provider file.

**Simple MVP** — A small, reliable system is preferred over unnecessary infrastructure.

**Safe failure** — LLM failures return clean HTTP errors, not raw exceptions.

---

## Roadmap

### Phase 1 — Backend Foundation ✅ Complete

FastAPI setup, API versioning, Pydantic schemas, TutorService, configuration, logging, tests, documentation.

### Phase 2 — LLM Integration ✅ Complete

Gemini integration, prompt layer, LLMService abstraction, structured output, response validation, mock mode, error handling, Phase 2 tests.

### Phase 3 — Prompt Tuning & Reliability

- Iterate prompt quality for real learner data.
- LLM timeout configuration and controlled retries.
- Malformed response fallback strategy.
- Prompt-injection hardening review.
- Improved observability.

### Phase 4 — LearnTrace Integration

Connect the Tutor API with the real LearnTrace backend and consume actual trusted assessment context from the mastery and competency systems.

### Optional Later Features

- Multilingual explanations.
- Contextual follow-up questions within a session.
- Additional tutoring strategies.
- Tutor analytics.

---

## Database

The AI Tutor does not own persistence and does not connect to the LearnTrace database. It is stateless — all context is provided per request.

## Frontend

This is a **backend-only** module. The LearnTrace frontend team is responsible for the UI and will consume the Tutor API endpoints.
