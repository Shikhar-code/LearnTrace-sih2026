# LearnTrace Frontend Client (SIH 2026)

Modern, developer-friendly React + TypeScript + Vite dashboard for **LearnTrace**.

---

## Tech Stack

- **React 18** (`react`, `react-dom`)
- **React Router 6** (`react-router-dom`)
- **TypeScript** (strict mode, modular types)
- **Vite** (fast bundling & hot module reloading)
- **Tailwind CSS** (clean, high-contrast, slate-themed UI)
- **Lucide React** (`lucide-react` icons)
- **Axios** (type-safe REST client with centralized error handling)

---

## Routing & Layout Architecture

The application is structured into two dedicated layout shells:

### 1. Student Portal (`StudentLayout`)
- **`/` or `/curriculum`**: Cascading Curriculum Explorer (`Class → Subject → Chapter → Topic`) & Topic Questions.
- **`/quiz`**: Interactive Quiz Runner with active per-question latency measurement and scoring.
- **`/mastery`**: Mastery & Learning Velocity Analytics (supports `?attempt_id=...`).
- *Note:* The content ingestion tools are excluded from the Student sidebar for a focused learning experience. A subtle button in the sidebar footer allows authorized users to switch to the Admin Portal.

### 2. Admin Portal (`AdminLayout`)
- **`/admin` or `/admin/ingest`**: Multipart PDF Ingestion, Text Extractor & Bulk Chunk-to-Topic Mapper (`PATCH /chunks/bulk-topic`).
- **`/admin/catalogue`**: NCERT Source Document Catalogue with class and subject filters.
- A "Back to Student Portal" quick-action button in the sidebar footer allows immediate return to `/curriculum`.

---

## Project Directory Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AlertBanner.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── StatCard.tsx
│   │   └── layout/
│   │       ├── AdminLayout.tsx       # Dedicated Admin shell with admin navigation
│   │       ├── StudentLayout.tsx     # Student learning shell (curriculum, quiz, mastery)
│   │       └── index.ts
│   ├── pages/
│   │   ├── Admin/
│   │   │   └── DocumentCatalogue.tsx # Source repository & catalogue view
│   │   ├── Assessment/
│   │   │   └── QuizRunner.tsx        # Interactive quiz runner with timer & grading
│   │   ├── Curriculum/
│   │   │   └── CurriculumExplorer.tsx# Academic hierarchy explorer
│   │   ├── Ingestion/
│   │   │   └── PdfIngestion.tsx      # PDF Uploader & Chunk Topic Mapper
│   │   └── Mastery/
│   │       └── MasteryDashboard.tsx  # Pedagogical mastery telemetry
│   ├── services/
│   │   └── api.ts                   # Centralized Axios client
│   ├── types/
│   │   └── index.ts                 # TypeScript types matching backend schemas
│   ├── App.tsx                      # BrowserRouter and nested layout routes
│   ├── index.css                    # Tailwind CSS directives
│   └── main.tsx                     # React root entry
├── .env
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

- Student Portal: [http://localhost:5173/curriculum](http://localhost:5173/curriculum)
- Admin Portal: [http://localhost:5173/admin](http://localhost:5173/admin)
