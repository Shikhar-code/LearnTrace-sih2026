# LearnTrace Frontend Client (SIH 2026)

React + TypeScript + Vite dashboard for **LearnTrace** — an AI-powered mastery and learning intelligence engine for NCERT curriculum (Classes 9 & 10).

---

## Tech Stack

- **React 18** (`react`, `react-dom`, `react-router-dom`)
- **TypeScript** & **Vite**
- **Tailwind CSS** & **Lucide React**
- **Axios** (type-safe REST client)

---

## Routing & Layouts

Fixed persistent sidebar and sticky top navbar across all pages.

### Student Portal (`StudentLayout`)

- **`/curriculum`**: Streamlined NCERT curriculum hierarchy (`Class → Subject → Chapter → Topic`) for Classes 9 & 10.
- **`/knowledge-graph`**: Interactive prerequisite DAG with zoom/drag canvas, 500ms hover inspector, and in-page topic remediation paths.
- **`/quiz`**: Interactive quiz runner with on-demand RAG-grounded AI 10-question quiz generation, per-question response latency tracking, auto-timer, and post-submission AI tutoring review.
- **`/mastery`**: Mastery analytics, Bayesian profile grid, and root-cause remediation traces.
- **`/tutor`**: Socratic AI Tutor for targeted misconception analysis, ELI5 concept breakdowns, step-by-step worked examples, and interactive adaptive practice questions with instant feedback.

### Admin Portal (`AdminLayout`)

- **`/admin/ingest`**: PDF upload, chapter text extraction & chunk-to-topic bulk mapper with multi-source viewing.
- **`/admin/catalogue`**: Source document repository with class and subject filters.
- **`/admin/heatmap`**: Class & cohort mastery heatmap, root-cause bottleneck distribution, and intervention planning.

---

## Directory Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── common/         # StatCard, Badge, LoadingSpinner, AlertBanner
│   │   ├── intelligence/   # KnowledgeGraphView, LearningPathStepper, MasteryProfileGrid
│   │   └── layout/         # StudentLayout, AdminLayout, Sidebar, Navbar
│   ├── pages/
│   │   ├── Admin/          # DocumentCatalogue, CohortHeatmap
│   │   ├── Assessment/     # QuizRunner (Interactive 10-MCQ runner & AI quiz generator)
│   │   ├── Curriculum/     # CurriculumExplorer (Clean 2-column curriculum browser)
│   │   ├── Ingestion/      # PdfIngestion (PDF upload & chunk mapper)
│   │   ├── KnowledgeGraph/ # KnowledgeGraphExplorer (Prerequisite DAG & graph analysis)
│   │   ├── Mastery/        # MasteryDashboard (Bayesian analytics & remediation engine)
│   │   └── Tutor/          # AiTutor (Socratic misconception remediation & adaptive practice)
│   ├── services/           # api.ts (Centralized Axios client, AI Quiz & AI Tutor API endpoints)
│   ├── types/              # Domain models, intelligence schemas, AI Quiz & AI Tutor types
│   ├── App.tsx             # Route definitions
│   └── main.tsx            # Entry point
```

---

## Proxy Architecture (Local Development)

Vite is configured with development proxies for dual-service communication:

| Path Prefix | Target Service | Default Port | Description |
|---|---|---|---|
| `/api` | LearnTrace Backend | `http://127.0.0.1:8000` | Core mastery engine, database, and RAG quiz generator |
| `/tutor-api` | AI Tutor Microservice | `http://127.0.0.1:8001` | Socratic misconception explanations and adaptive practice |

---

## Quick Start

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Run dev server
npm run dev

# 3. Build for production
npm run build
```
