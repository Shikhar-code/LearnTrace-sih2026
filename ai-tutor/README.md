# LearnTrace AI Tutor

> **Backend-only module.** Phase 3.5: Groq fallback provider added.

The AI Tutor is a focused backend service within the LearnTrace platform. It receives structured assessment context from the LearnTrace backend and returns tutoring content that helps a learner understand their mistake.

---

## Responsibility

The AI Tutor does one thing:

```
LearnTrace trusted context
        ↓
      AI Tutor
        ↓
  Explain why the answer is wrong
  Explain the concept simply
  Give one useful example
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
│   │   ├── llm_service.py              # LLMService — provider-agnostic interface + fallback
│   │   ├── response_validator.py       # Semantic + quality validation of LLM output
│   │   └── providers/
│   │       ├── gemini.py               # Gemini SDK implementation (primary)
│   │       └── groq.py                 # Groq SDK implementation (fallback)
│   └── core/
│       ├── config.py                   # Settings (pydantic-settings)
│       ├── exceptions.py               # Application-level exception types
│       └── logging.py                  # Logging setup
├── tests/
│   ├── test_health.py                  # Health endpoint tests
│   ├── test_tutor.py                   # Phase 1 endpoint tests
│   ├── test_llm_service.py             # Phase 2 LLM integration tests
│   ├── test_prompt_quality.py          # Phase 3 tutoring quality tests
│   └── test_groq_fallback.py           # Phase 3.5 Groq provider + fallback tests
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
| google-genai | Official Gemini SDK (primary LLM) |
| groq | Official Groq SDK (fallback LLM) |
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

Edit `.env` — for mock mode (no API keys needed):

```
TUTOR_MOCK_MODE=true
```

For real calls with Gemini primary + Groq fallback:

```
TUTOR_MOCK_MODE=false
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-2.0-flash
GROQ_API_KEY=your-groq-key-here
GROQ_MODEL=openai/gpt-oss-20b
```

Groq is optional — if `GROQ_API_KEY` is absent, fallback calls will raise
`LLMMisconfiguredError` rather than silently failing.

**Run locally:**

```powershell
uvicorn app.main:app --reload
```

**Run tests (no API keys required):**

```powershell
pytest
```

Tests never call real Gemini or Groq APIs. Both SDKs are mocked at the
provider boundary.

**Local API documentation:**

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Mock Mode

Set `TUTOR_MOCK_MODE=true` (the default) to run without calling any LLM provider.

- All tests pass in mock mode — no API keys required.
- Neither Gemini nor Groq is called.
- The mock response is fully context-aware: it adapts to the supplied competency, learner answer, and correct answer. No subject-specific content is hard-coded.
- The mock uses the same `TutorResponse` schema as the real LLM path.
- Safe for local development and CI/CD.

Set `TUTOR_MOCK_MODE=false` to enable real LLM calls. Gemini is the primary provider
and Groq is the automatic fallback.

---

## Tutoring Quality (Phase 3)

### Misconception-focused explanations

The system prompt instructs Gemini to explain **why** the learner's specific answer is wrong — not merely restate the correct answer. The model is directed to identify the likely misconception or reasoning error and clarify the distinction.

### Learner-friendly tone

The system prompt explicitly requires warm, encouraging, teacher-like language. Phrases like "you were wrong" are prohibited. The model is instructed to write as if sitting beside the learner.

### Concrete examples

The worked example must be directly relevant to the concept or misconception in the original question — not an unrelated scenario.

### Practice question safeguards

- The practice question must be meaningfully different from the original — not a copy or paraphrase.
- Exactly four distinct options are required.
- Exactly one correct option is required.
- An explanation of the correct option is required.
- The original question text is passed into the validator, which rejects any practice question that is exactly identical to the original.

### Response quality validation

Beyond Pydantic's schema checks, the validator enforces:

| Field | Minimum length |
|---|---|
| `explanation` | 80 characters |
| `simple_explanation` | 60 characters |
| `worked_example` | 80 characters |
| `practice_question.explanation` | 40 characters |

Additional structural checks:
- Exactly 4 options
- All options non-empty
- No duplicate options
- `correct_option` must match one of the listed options exactly
- Practice question must not be identical to the original question (after normalisation)

If validation fails, one retry is attempted before HTTP 502 is returned.

### Context-aware mock mode

The mock response dynamically adapts to whatever `TutorContext` is supplied. All four fields reference the actual `competency.name`, `learner_answer`, and `correct_answer` from the incoming request. This makes mock mode representative across any subject domain.

---

## Architecture

```
LearnTrace Backend
       ↓
   Tutor API  (POST /api/v1/tutor/explain)
       ↓
 TutorService
  ├─ Mock mode → context-aware deterministic response (no LLM call)
  └─ Real mode ↓
          LLMService        (provider-agnostic; passes original question text)
               ↓
          GeminiProvider    (primary: google-genai SDK)
               ↓
     ┌────────────────────────────────────┐
     │ success │ recoverable failure (429, timeout)  │
     └────────────────────────────────────┘
               ↓                   ↓
          Structured JSON    GroqProvider (fallback: groq SDK)
               ↓                   ↓
          ResponseValidator (schema + min-length + identical-question check)
               ↓
          TutorResponse
```

### Fallback Conditions

Groq is activated automatically when Gemini raises a **recoverable provider error**:

| Condition | Fallback triggered? |
|---|---|
| HTTP 429 / rate limit | Yes |
| Timeout | Yes |
| Transient network/API error | Yes |
| Missing `GEMINI_API_KEY` (misconfiguration) | No — propagates as 503 |
| Malformed LLM output (validation failure) | No — retry logic handles it |
| Invalid application input | No — propagates as 422 |

If both Gemini and Groq fail, a clean `LLMProviderError` is raised, which the API
route maps to HTTP 502.

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

> `detected_gap` is optional. When absent, the prompt includes a fallback statement directing the model to address the distinction between the learner's answer and the correct answer.

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
| 502 | Both providers failed, or malformed response after retries |
| 503 | LLM misconfigured (missing API key in real mode) |

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
| `TUTOR_MOCK_MODE` | `true` | `false` to enable real LLM calls |
| `LLM_PROVIDER` | `gemini` | Primary provider (`gemini` only currently) |
| `GEMINI_API_KEY` | *(empty)* | Required when mock mode is off |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |
| `GROQ_API_KEY` | *(empty)* | Required when Gemini fails and fallback is needed |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq model to use for fallback |

---

## Testing

All tests run in mock mode by default. No API keys are required.
Neither Gemini nor Groq is called during `pytest` — both SDKs are mocked.

```powershell
pytest
```

| Test file | Coverage |
|---|---|
| `test_health.py` | Health endpoint |
| `test_tutor.py` | API contract, request validation, response schema |
| `test_llm_service.py` | LLM path delegation, retry logic, error mapping, prompt injection |
| `test_prompt_quality.py` | Prompt construction, min-length validation, identical-question check, mock context-awareness |
| `test_groq_fallback.py` | Groq provider, fallback orchestration, configuration, mock mode isolation |

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

**Quality over features** — Each tutoring output field has explicit instructions and validation floors.

---

## Roadmap

### Phase 1 — Backend Foundation ✅ Complete

FastAPI setup, API versioning, Pydantic schemas, TutorService, configuration, logging, tests, documentation.

### Phase 2 — LLM Integration ✅ Complete

Gemini integration, prompt layer, LLMService abstraction, structured output, response validation, mock mode, error handling, Phase 2 tests.

### Phase 3 — Tutoring Quality ✅ Complete

Misconception-focused explanations, learner-friendly tone, concrete examples, practice-question safeguards (not-identical check), response quality validation (minimum lengths), context-aware mock mode, Phase 3 tests.

### Phase 3.5 — Groq Fallback Provider ✅ Complete

Groq as automatic fallback provider when Gemini encounters a recoverable failure (HTTP 429, timeout, transient errors). Fallback is transparent to TutorService and the API contract. Neither provider is called during tests. 17 new tests added covering provider success, failure, fallback logic, configuration, and mock-mode isolation.

### Phase 4 — LearnTrace Integration

Connect the Tutor API with the real LearnTrace backend and consume actual trusted assessment context from the mastery and competency systems.

---

## Database

The AI Tutor does not own persistence and does not connect to the LearnTrace database. It is stateless — all context is provided per request.

## Frontend

This is a **backend-only** module. The LearnTrace frontend team is responsible for the UI and will consume the Tutor API endpoints.
