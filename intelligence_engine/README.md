# LearnTrace Intelligence Engine

The intelligence engine turns completed learner attempts into explainable,
frontend-ready learning intelligence. It estimates concept mastery, finds the
likely prerequisite causing a gap, produces a gated learning path, and builds
learner and administrator visualizations as JSON.

The engine is kept separate from the main backend. The backend owns learners,
questions, assessments, attempts, and PostgreSQL. This package reads those
existing records through a thin adapter and does not add intelligence tables or
database migrations.

## What Is Included

| Part | Purpose | Main output |
| --- | --- | --- |
| Assessment evidence | Validates responses and groups evidence by concept | Accuracy, difficulty coverage, recency and improvement signals |
| Mastery engine | Estimates how well the learner understands each concept | Probability, score, confidence and five-tier classification |
| Competency graph | Represents prerequisite relationships | Validated nodes, weighted edges and dependency paths |
| Root-gap detection | Explains why a learner is struggling with a target | Ranked root causes, contributors and missing diagnostics |
| Learning-path engine | Orders remediation from prerequisite to target | Current, locked, completed and diagnostic-required steps |
| Frontend projection | Converts engine results into stable UI data | Cards, charts, graphs, progress and next action |
| Admin heatmap | Aggregates multiple learners | Cohort matrix, risk counts and root-gap distribution |

## Scope and Independence

The intelligence code itself uses only the Python standard library. It does not
depend on the frontend, AI tutor, LLM services, content generation, iGOT, or a
particular database.

Live integration depends only on data the existing backend already exposes:

- a completed assessment attempt;
- evaluated responses with `is_correct`;
- question difficulty and topic mapping;
- chapter, subject, and class information;
- the assessment to which each question belongs.

The adapter lives in `intelligence_engine/integration.py`. The small FastAPI
bridge lives in `backend/routes/intelligence.py`.

## End-to-End Flow

```text
Learner finishes assessment
        |
        v
Backend stores attempt and evaluated responses
        |
        v
Integration adapter reads the existing backend payloads
        |
        v
Assessment evidence -> Mastery -> Root gaps -> Learning path
        |
        v
Stable JSON projection
        |
        +--> Learner dashboard, mastery cards and graphs
        |
        +--> Admin cohort heatmap
```

## 1. Assessment Evidence

`assessment.py` validates questions and responses before they influence a
learner model. It prevents unknown questions, invalid options, duplicate
question IDs, and malformed telemetry from silently entering the pipeline.

Evidence is grouped by competency and can include:

- total and correct response counts;
- overall accuracy;
- difficulty-weighted accuracy;
- recent accuracy and recent failure rate;
- hard-question accuracy;
- response-time ratio;
- hint and retry usage;
- improvement trend;
- diagnostic versus reassessment change;
- difficulty-band coverage;
- an explicit list of unavailable optional features.

Diagnostic and reassessment evidence receives full weight. General and practice
work receives less weight. A correct hard answer is stronger evidence than a
correct easy answer, while an incorrect hard answer is treated more cautiously.

The current backend does not expose hint, retry, expected-time, or per-response
timestamp data. The adapter therefore marks those features as unavailable
instead of inventing values.

## 2. Mastery Engine

`mastery.py` converts concept evidence into a `MasteryEstimate` containing:

- `probability`: value from `0.0` to `1.0`;
- `score`: the same value expressed from `0` to `100`;
- `confidence` and `confidence_label`;
- `tier`;
- `can_progress`;
- estimator name and plain-language explanations.

At least two effective responses are required to classify a concept. With less
evidence, the result is `UNKNOWN` rather than a misleading score.

### Five mastery tiers

| Score | Tier | Meaning |
| --- | --- | --- |
| 0–39% | Critical Gap | Immediate remediation is needed |
| 40–54% | Emerging | Basic understanding is forming |
| 55–69% | Developing | Progressing, but not ready to unlock dependents |
| 70–84% | Proficient | Meets the progression gate |
| 85–100% | Mastered | Strong command of the concept |

The standalone engine supports a deterministic logistic model blended with a
statistical estimate according to evidence confidence. The live backend bridge
currently uses the transparent statistical estimator so deployment does not
depend on a separately trained artifact. The model can be enabled later without
changing the frontend contract.

## 3. Competency Graph

`concept_graph.py` provides a validated directed acyclic graph. It rejects:

- missing concept references;
- self-dependencies;
- duplicate dependencies;
- invalid edge weights;
- dependency cycles.

The Class 9–10 Mathematics and Science chapter catalogue and its prototype
prerequisite edges are defined in `curriculum.py`. Stable IDs are generated from
class, subject, and chapter names, for example:

```text
class-10:mathematics:introduction-to-trigonometry
```

The graph supports prerequisite and dependent lookup, ancestors, descendants,
topological ordering, bounded paths, and weighted influence calculations.

Important: these are chapter-level prerequisite relationships curated for the
prototype. A subject expert should review them before they are presented as an
authoritative curriculum standard.

## 4. Root-Gap Detection

`root_cause.py` looks upstream from the selected target concept. It combines:

- the learner's mastery gap;
- evidence confidence;
- graph distance;
- dependency influence;
- consistency of weakness along the path;
- the possibility that the cause is still unknown.

It returns:

- `target_gap_probability`;
- ranked `root_causes`;
- intermediate `contributing_gaps`;
- `unexplained_probability`;
- `diagnostic_required_concept_ids`;
- human-readable reasons for each root candidate.

If prerequisite evidence is missing or too weak, the engine asks for a
diagnostic instead of claiming a cause.

## 5. Learning Path

`learning_path.py` builds a prerequisite-first route from the strongest root
cause to the selected target. It only accepts graph-valid paths and limits path
search to keep the output deterministic and bounded.

Each step has one status:

| Status | Frontend meaning |
| --- | --- |
| `CURRENT` | The learner should work on this now |
| `READY` | Reserved for a separately ready state; the current planner promotes the first incomplete step directly to `CURRENT` |
| `LOCKED` | Blocked by an earlier incomplete step |
| `COMPLETED` | At or above the 70% progression gate |
| `DIAGNOSTIC_REQUIRED` | More evidence is required first |

Reassessment evidence recalculates the statuses without mutating an earlier path
snapshot. Mastered nodes can be compressed out of a path, while incomplete
prerequisites cannot be skipped.

## Outputs Returned to the Frontend

Learner analysis returns two layers in one JSON response:

1. Raw engine data for explainability and debugging.
2. A stable `frontend` object for application screens.

Frontend code should normally consume only `response.frontend`.

### Learner frontend contract

The schema version is `LEARNTRACE_FRONTEND_V1`.

```text
frontend
|-- schema_version
|-- summary
|   |-- target
|   |-- readiness_score
|   |-- strongest_concepts
|   |-- weakest_concepts
|   |-- root_gap_probability
|   `-- next_action
|-- mastery_profile[]
|-- graphs
|   |-- competency
|   `-- root_cause
|-- learning_path
`-- progress
    |-- assessment_scores[]
    `-- concept_improvement[]
```

`summary.next_action.type` is suitable for choosing the main dashboard button.
Current values include `LEARN_CURRENT_STEP`, `TAKE_DIAGNOSTIC`,
`REVIEW_TARGET`, and `MAINTAIN_MASTERY`.

### Graph JSON

Both graph views use the same simple contract:

```json
{
  "direction": "PREREQUISITE_TO_DEPENDENT",
  "node_count": 3,
  "edge_count": 2,
  "nodes": [
    {
      "id": "class-10:mathematics:triangles",
      "label": "Triangles",
      "mastery_score": 33.3,
      "tier": "CRITICAL_GAP",
      "confidence": 0.26,
      "can_progress": false,
      "level": 0,
      "roles": ["ROOT_CAUSE", "PATH_CURRENT"]
    }
  ],
  "edges": [
    {
      "id": "source->target",
      "source": "class-10:mathematics:triangles",
      "target": "class-10:mathematics:introduction-to-trigonometry",
      "weight": 0.9,
      "in_root_trace": true,
      "in_learning_path": true
    }
  ]
}
```

The frontend does not need to discover graph structure. It should:

1. place nodes by `level` or pass them to its graph layout library;
2. draw every edge from `source` to `target`;
3. colour nodes using `tier`;
4. add borders or badges using `roles`;
5. highlight edges where `in_root_trace` or `in_learning_path` is true.

`graphs.competency` contains the full class/subject graph. Use it for the
knowledge-map screen. `graphs.root_cause` contains only the focused path that
explains the selected target. Use it for learner feedback.

### Admin heatmap contract

The schema version is `LEARNTRACE_ADMIN_HEATMAP_V1`. It contains:

- `summary`: learner count, coverage, average readiness and tier totals;
- `scale`: score bounds and progression thresholds;
- `columns`: concepts in display order;
- `rows`: one learner with one cell per concept;
- `concept_summary`: average/median mastery and at-risk counts;
- `root_gap_distribution`: most common root gaps across the cohort.

Each cell already contains `mastery_score`, `tier`, `confidence`,
`can_progress`, and `is_root_gap`. A frontend can render the heatmap as a simple
CSS grid or table; no additional graph calculation is required.

## FastAPI Endpoints

The routes are registered automatically by `backend/main.py`.

### Analyze one completed attempt

```http
GET /intelligence/analyze/{attempt_id}
```

Optional query parameters:

- `assessment_type`: `diagnostic`, `reassessment`, `general`, or `practice`;
- `target_concept_id`: a stable concept ID or the exact assessed chapter title.

Example:

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:8000/intelligence/analyze/1?assessment_type=diagnostic&target_concept_id=Some%20Applications%20of%20Trigonometry'
```

### Analyze attempt history for one learner

```http
POST /intelligence/analyze
Content-Type: application/json
```

```json
{
  "attempts": [
    {"attempt_id": 1, "assessment_type": "diagnostic"},
    {"attempt_id": 4, "assessment_type": "reassessment"}
  ],
  "target_concept_id": "Some Applications of Trigonometry"
}
```

All supplied attempts must belong to the same learner. Use this endpoint for
progress and reassessment screens.

### Build the admin heatmap

```http
POST /intelligence/admin/heatmap
Content-Type: application/json
```

The request uses the same shape, but may contain attempts from multiple
learners. The backend groups them by learner before calculating the cohort.
Every learner must be analyzed within the same class and subject scope.

The current route accepts explicit attempt IDs. It does not discover an entire
class automatically.

### Common errors

| Status | Cause |
| --- | --- |
| `404` | Attempt or assessment does not exist |
| `422` | Empty request, incomplete attempt, mixed learners, mismatched assessment, missing correctness, duplicate response, or invalid target |

## Setup and Run

All commands below assume Windows PowerShell.

### 1. Configure PostgreSQL

Create `backend/.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Never commit this file. It is already ignored by Git.

### 2. Create the Python environment

From `LearnTrace-sih2026/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks activation, call the virtual-environment Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Seed repeatable demo data

```powershell
.\.venv\Scripts\python.exe -m db.seed_intelligence_demo
```

The seed creates three isolated Class 10 Mathematics demo learners, diagnostic
attempts, and one reassessment using the existing backend models. It prints the
actual attempt IDs. It is idempotent, so rerunning it does not duplicate those
records.

Do not assume the IDs will always be `1–4`; use the IDs printed by the command.

### 4. Start FastAPI

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Open:

- API root: `http://127.0.0.1:8000/`
- database check: `http://127.0.0.1:8000/database-test`
- Swagger: `http://127.0.0.1:8000/docs`

### 5. Run the engine without PostgreSQL

From `LearnTrace-sih2026`:

```powershell
backend\.venv\Scripts\python.exe -m intelligence_engine.demo
```

This runs deterministic in-memory data through all five engines. It is useful
when PostgreSQL or the frontend is unavailable.

### 6. Run tests

From `LearnTrace-sih2026`:

```powershell
backend\.venv\Scripts\python.exe -m unittest discover -s intelligence_engine\tests -v
```

The suite covers validation, evidence weighting, mastery, graph traversal,
root-cause analysis, learning-path gates, backend adaptation, frontend graph
contracts, reassessment, and admin heatmap aggregation.

### 7. Rebuild the optional model artifact

```powershell
backend\.venv\Scripts\python.exe -m intelligence_engine.train_model
```

This deterministically rebuilds
`intelligence_engine/artifacts/mastery_model_v1.json` from synthetic training
data. It does not download data or contact an external AI service.

## Frontend Integration

### Recommended screen flow

```text
Quiz completion
  -> receive attempt_id
  -> call learner analysis
  -> render summary and mastery profile
  -> render root-cause graph
  -> render learning-path stepper

Admin dashboard
  -> collect relevant completed attempt IDs
  -> call admin heatmap
  -> render cohort matrix and risk summaries
```

### Minimal frontend API client

```ts
const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export async function analyzeAttempt(attemptId: number) {
  const response = await fetch(
    `${API_URL}/intelligence/analyze/${attemptId}?assessment_type=diagnostic`,
  );
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  return result.frontend;
}

export async function analyzeHistory(
  attempts: Array<{ attempt_id: number; assessment_type: string }>,
  target: string,
) {
  const response = await fetch(`${API_URL}/intelligence/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attempts, target_concept_id: target }),
  });
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  return result.frontend;
}

export async function loadAdminHeatmap(
  attempts: Array<{ attempt_id: number; assessment_type: string }>,
  target: string,
) {
  const response = await fetch(`${API_URL}/intelligence/admin/heatmap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attempts, target_concept_id: target }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
```

The frontend should keep the schema-version check close to the API boundary:

```ts
if (payload.schema_version !== "LEARNTRACE_FRONTEND_V1") {
  throw new Error("Unsupported intelligence response");
}
```

### What each UI component reads

| UI component | JSON field |
| --- | --- |
| Readiness card | `frontend.summary.readiness_score` |
| Recommended action | `frontend.summary.next_action` |
| Mastery cards/bar chart | `frontend.mastery_profile` |
| Knowledge map | `frontend.graphs.competency` |
| Why-am-I-stuck graph | `frontend.graphs.root_cause` |
| Learning stepper | `frontend.learning_path.steps` |
| Assessment progress | `frontend.progress.assessment_scores` |
| Improvement chart | `frontend.progress.concept_improvement` |
| Admin cohort heatmap | top-level admin heatmap response |

Treat `null` mastery values as `UNKNOWN`; do not convert them to zero. A zero
means measured failure, while `null` means insufficient evidence.

If the frontend and backend run on different browser origins during development,
the backend team must either configure FastAPI CORS or route API calls through
the frontend development proxy. The intelligence routes do not add a separate
CORS policy.

## Project Files

```text
intelligence_engine/
|-- assessment.py        # response validation and evidence aggregation
|-- mastery.py           # mastery estimates, tiers and optional model
|-- concept_graph.py      # validated prerequisite DAG
|-- curriculum.py         # Class 9–10 chapter catalogue and edges
|-- root_cause.py         # probabilistic root-gap inference
|-- learning_path.py      # gated prerequisite-first path planning
|-- pipeline.py           # composes the five engines
|-- integration.py        # adapts existing backend payloads
|-- frontend.py           # learner and admin JSON projections
|-- demo.py               # deterministic standalone demonstration
|-- train_model.py        # reproducible optional model training
|-- artifacts/            # saved model artifact
|-- sample_outputs/       # example learner/admin JSON
`-- tests/                # standard-library unit tests

backend/
|-- routes/intelligence.py          # thin FastAPI bridge
`-- db/seed_intelligence_demo.py    # repeatable live demo data
```

## Current Limitations and Production Checklist

- The prerequisite graph is chapter-level prototype data and needs academic
  review before production use.
- The backend currently omits hint/retry telemetry and per-response timestamps.
- The admin endpoint requires the caller to supply attempt IDs.
- Authentication and authorization must protect the admin endpoint before it is
  exposed outside a trusted development environment.
- The live adapter uses the deterministic statistical estimator. Enable the
  trained artifact only after model evaluation and versioning are agreed.
- Only completed attempts with evaluated correctness can be analyzed.

These limits do not block frontend integration or the hackathon demonstration.
They are explicit so missing data is never presented as measured intelligence.
