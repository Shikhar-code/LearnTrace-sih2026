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
- **`/curriculum`**: NCERT curriculum hierarchy (`Class → Subject → Chapter → Topic`) & questions repository.
- **`/knowledge-graph`**: Interactive prerequisite DAG with zoom/drag canvas, 500ms hover inspector, and in-page topic remediation paths.
- **`/quiz`**: Interactive quiz runner with per-question latency tracking.
- **`/mastery`**: Mastery analytics, Bayesian profile grid, and root-cause remediation traces.

### Admin Portal (`AdminLayout`)
- **`/admin/ingest`**: PDF upload, chapter text extraction & chunk-to-topic bulk mapper.
- **`/admin/catalogue`**: Source document repository with class and subject filters.

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
│   │   ├── Admin/          # DocumentCatalogue
│   │   ├── Assessment/     # QuizRunner
│   │   ├── Curriculum/     # CurriculumExplorer
│   │   ├── Ingestion/      # PdfIngestion
│   │   ├── KnowledgeGraph/ # KnowledgeGraphExplorer
│   │   └── Mastery/        # MasteryDashboard
│   ├── services/           # api.ts (Centralized Axios client & API endpoints)
│   ├── types/              # Domain models, intelligence & graph schemas
│   ├── App.tsx             # Route definitions
│   └── main.tsx            # Entry point
```

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
