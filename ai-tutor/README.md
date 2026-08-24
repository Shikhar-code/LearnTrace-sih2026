# LearnTrace AI Tutor — Phase 1

> **Backend-only module.** No frontend, no database, no LLM.

---

## 1. Purpose

The AI Tutor is a dedicated backend service within the LearnTrace platform. It accepts structured context from the LearnTrace core backend and returns personalised tutoring content to help learners understand their mistakes, reinforce concepts, and practise similar problems.

It is designed to be:
- **Stateless** — carries no learner data itself; all context is provided per request.
- **Independently deployable** — runs as its own service.
- **Extensible** — structured so that the LLM layer can be added without rewriting the API.

---

## 2. Phase 1 Scope

Phase 1 establishes the **backend foundation only**.

| Feature | Phase 1 |
|---|---|
| FastAPI server | ✅ |
| `/health` endpoint | ✅ |
| `/api/v1/tutor/explain` endpoint | ✅ |
| Request validation (Pydantic) | ✅ |
| Deterministic placeholder response | ✅ |
| Centralised configuration | ✅ |
| Logging foundation | ✅ |
| pytest test suite | ✅ |
| LLM integration | ❌ Phase 2+ |
| Database | ❌ Not in scope |
| Frontend | ❌ Separate team |
| RAG / embeddings | ❌ Phase 3+ |

---

## 3. Architecture

```
LearnTrace Backend
       │
       │  TutorContext (POST /api/v1/tutor/explain)
       ▼
┌──────────────────────┐
│      AI Tutor        │
│                      │
│  FastAPI             │
│  └─ /health          │
│  └─ /api/v1          │
│      └─ TutorRoute   │
│          └─ TutorService          │
│              └─ [placeholder]     │
│              └─ [LLM — Phase 2]   │
└──────────────────────┘
       │
       │  TutorResponse
       ▼
  LearnTrace Frontend (separate team)
```

### Future LLM pipeline (Phase 2+)

```
TutorService
    └─ PromptService   (builds prompt from TutorContext)
        └─ LLMService  (calls LLM provider)
            └─ LLM     (OpenAI / Anthropic / Gemini / …)
```

The API layer and response schema remain unchanged between phases.

---

## 4. Project Structure

```
ai-tutor/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, /health endpoint, startup
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py            # Top-level /api/v1 router
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── tutor.py         # POST /api/v1/tutor/explain
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── tutor.py             # TutorContext, TutorResponse (Pydantic)
│   ├── services/
│   │   ├── __init__.py
│   │   └── tutor_service.py     # TutorService — business logic layer
│   └── core/
│       ├── __init__.py
│       ├── config.py            # Settings via pydantic-settings
│       └── logging.py           # Logging setup
├── tests/
│   ├── __init__.py
│   ├── test_health.py           # Health endpoint tests
│   └── test_tutor.py            # Tutor endpoint tests
├── .env.example                 # Environment variable template
├── .gitignore
├── README.md
├── requirements.txt
└── pytest.ini
```

---

## 5. Installation

### Prerequisites

- Python 3.11+
- pip

### Steps

```bash
# From the ai-tutor/ directory:
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 6. Running Locally

```bash
# Ensure the virtual environment is activated.
uvicorn app.main:app --reload --port 8001
```

The service will be available at:
- **API docs (Swagger):** http://localhost:8001/docs
- **API docs (ReDoc):** http://localhost:8001/redoc
- **Health:** http://localhost:8001/health

> Port 8001 avoids conflict with the LearnTrace main backend (typically 8000).

---

## 7. Testing

```bash
# Run the full test suite from ai-tutor/
pytest
```

All tests run **without** an LLM, database, or internet connection.

---

## 8. API Endpoints

### `GET /health`

Service health check.

**Response**

```json
{
  "status": "ok",
  "service": "ai-tutor"
}
```

---

### `POST /api/v1/tutor/explain`

Generate a tutoring explanation for a learner's incorrect answer.

**Request body** — `TutorContext`

| Field | Type | Required | Description |
|---|---|---|---|
| `competency` | object | ✅ | Competency being assessed |
| `competency.id` | string | ✅ | Machine-readable ID |
| `competency.name` | string | ✅ | Human-readable name |
| `question` | object | ✅ | The question posed to the learner |
| `question.id` | string | ✅ | Unique question ID |
| `question.text` | string | ✅ | Full question text |
| `question.options` | string[] | ✅ | At least 2 answer options |
| `learner_answer` | string | ✅ | The option the learner chose |
| `correct_answer` | string | ✅ | The correct option |
| `detected_gap` | object | ❌ | Gap detected by LearnTrace mastery engine |
| `detected_gap.description` | string | ✅ if gap present | Description of the gap |

**Response** — `TutorResponse`

| Field | Type | Description |
|---|---|---|
| `explanation` | string | Detailed explanation of the mistake |
| `simple_explanation` | string | Simplified (ELI5) explanation |
| `worked_example` | string | Concrete worked example |
| `practice_question` | object | A new practice question |
| `practice_question.question` | string | Practice question text |
| `practice_question.options` | string[] | Answer options |
| `practice_question.correct_option` | string | Correct option |
| `practice_question.explanation` | string | Explanation of correct option |

---

## 9. Sample Request

```json
POST /api/v1/tutor/explain
Content-Type: application/json

{
  "competency": {
    "id": "sampling_concepts",
    "name": "Sampling Concepts"
  },
  "question": {
    "id": "q123",
    "text": "What is a sampling frame?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ]
  },
  "learner_answer": "Option A",
  "correct_answer": "Option B",
  "detected_gap": {
    "description": "Confusion between population and sampling frame"
  }
}
```

---

## 10. Sample Response

```json
{
  "explanation": "You selected 'Option A', but the correct answer is 'Option B'. ...",
  "simple_explanation": "Think of Sampling Concepts this way: ...",
  "worked_example": "Worked example for Sampling Concepts: ...",
  "practice_question": {
    "question": "A researcher studies employed adults in a city ...",
    "options": [
      "The target population",
      "The sampling frame",
      "The sample",
      "The census"
    ],
    "correct_option": "The sampling frame",
    "explanation": "The employment-office list is the sampling frame ..."
  }
}
```

---

## 11. Current Placeholder Behaviour

Phase 1 returns a **deterministic placeholder response**.

- The explanation includes the competency name, learner answer, correct answer, and detected gap.
- The practice question is a fixed example related to sampling.
- Identical requests always return identical responses.
- No LLM is called.
- No network I/O occurs.

This allows:
- Full API contract verification before Phase 2.
- Integration testing by the LearnTrace frontend team.
- CI/CD pipeline setup with no external dependencies.

---

## 12. Future LLM Integration (Phase 2+)

When Phase 2 begins:

1. Add the chosen LLM SDK to `requirements.txt`.
2. Populate `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY` in `.env`.
3. Create `app/services/prompt_service.py` to build prompts from `TutorContext`.
4. Create `app/services/llm_service.py` to call the LLM provider.
5. Replace `TutorService._generate_placeholder()` with calls to those services.

The API route, request schema, and response schema remain **unchanged**.

---

## 13. Integration Boundary with LearnTrace

The AI Tutor is a **consumer** of LearnTrace intelligence.

The following are determined **outside** this module by other LearnTrace components:

- Correctness of learner answers
- Mastery and competency scores
- Prerequisite relationships
- Root competency gap detection
- Learning path planning

The AI Tutor receives this information via `TutorContext` and uses it to generate tutoring content. It must not re-derive any of these values.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values as needed.

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `development` | Runtime environment |
| `LLM_PROVIDER` | *(empty)* | LLM provider name (Phase 2+) |
| `LLM_MODEL` | *(empty)* | Model identifier (Phase 2+) |
| `LLM_API_KEY` | *(empty)* | API key — **never commit** (Phase 2+) |

---

*LearnTrace AI Tutor — Phase 1 | Backend-only foundation.*
