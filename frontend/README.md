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

Fixed persistent sidebar and sticky top navbar across all pages with Role-Based Access Control (RBAC).

### Public Authentication

- **`/login`**: Single unified login screen with dynamic role detection (Student $\to$ `/curriculum`, Admin $\to$ `/admin/heatmap`), email/password validation, and 1-click **SIH Demo Personas** (Asha, Ravi, Meera, Curriculum Admin).
- **`/register`**: Student self-registration with password confirmation, real-time matching indicator, and NCERT Class 9/10 selection.

### Student Portal (`StudentLayout`) — Role: `student` (Strict)

- **`/curriculum`**: Streamlined NCERT curriculum hierarchy (`Class → Subject → Chapter → Topic`) for Classes 9 & 10.
- **`/knowledge-graph`**: Interactive prerequisite DAG with zoom/drag canvas, 500ms hover inspector, and in-page topic remediation paths.
- **`/quiz`**: Interactive quiz runner with on-demand RAG-grounded AI 10-question quiz generation, per-question response latency tracking, auto-timer, dynamic `user_id` telemetry, and post-submission AI tutoring review.
- **`/mastery`**: Mastery analytics, Bayesian profile grid, and root-cause remediation traces.
- **`/tutor`**: Socratic AI Tutor for targeted misconception analysis, ELI5 concept breakdowns, step-by-step worked examples, and interactive adaptive practice questions with instant feedback.

### Admin Portal (`AdminLayout`) — Role: `admin` (Strict)

- **`/admin/ingest`**: PDF upload, chapter text extraction & chunk-to-topic bulk mapper with multi-source viewing.
- **`/admin/catalogue`**: Source document repository with class and subject filters.
- **`/admin/heatmap`**: Class & cohort mastery heatmap, root-cause bottleneck distribution, and intervention planning.

---

## Directory Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── auth/           # ProtectedRoute, UserMenu
│   │   ├── common/         # StatCard, Badge, LoadingSpinner, AlertBanner
│   │   ├── intelligence/   # KnowledgeGraphView, LearningPathStepper, MasteryProfileGrid
│   │   └── layout/         # StudentLayout, AdminLayout, Sidebar, Navbar
│   ├── context/            # AuthContext (React auth provider & session state)
│   ├── pages/
│   │   ├── Admin/          # DocumentCatalogue, CohortHeatmap
│   │   ├── Assessment/     # QuizRunner (Interactive 10-MCQ runner & AI quiz generator)
│   │   ├── Auth/           # Login (Unified single login), Register (Student sign-up)
│   │   ├── Curriculum/     # CurriculumExplorer (Clean 2-column curriculum browser)
│   │   ├── Ingestion/      # PdfIngestion (PDF upload & chunk mapper)
│   │   ├── KnowledgeGraph/ # KnowledgeGraphExplorer (Prerequisite DAG & graph analysis)
│   │   ├── Mastery/        # MasteryDashboard (Bayesian analytics & remediation engine)
│   │   └── Tutor/          # AiTutor (Socratic misconception remediation & adaptive practice)
│   ├── services/           # api.ts (Axios client with interceptors), authService.ts
│   ├── types/              # Domain models, intelligence schemas, auth types
│   ├── App.tsx             # Protected & public route definitions
│   └── main.tsx            # Entry point
```

---

## Proxy Architecture (Local Development)

Vite is configured with development proxies for dual-service communication:

| Path Prefix  | Target Service        | Default Port            | Description                                               |
| ------------ | --------------------- | ----------------------- | --------------------------------------------------------- |
| `/api`       | LearnTrace Backend    | `http://127.0.0.1:8000` | Core mastery engine, database, and RAG quiz generator     |
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

---

## Backend Integration Plan for Authentication

The frontend authentication architecture is built and active. It operates with local session storage and fallback demo personas, and automatically attaches JWT tokens and user headers to all outgoing requests. 

Follow this integration plan to connect the FastAPI backend to the frontend authentication system.

### 1. Database Schema Migration (`models/attempt.py`)

Add `hashed_password` and `role` columns to the `User` model:

```python
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)   # Add this
    role = Column(String(50), default="student", nullable=False)  # "student" | "admin"
    class_level = Column(Integer, nullable=True)           # 9 | 10
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

---

### 2. Required Endpoints & API Contract

Create a new router `routes/auth.py` registered under `/api/auth` (or `/auth`):

#### A. User Registration (`POST /api/auth/register`)
- **Request Body**:
  ```json
  {
    "name": "Priya Sharma",
    "email": "priya@school.edu",
    "password": "securepassword123",
    "class_level": 10
  }
  ```
- **Response Body (`201 Created`)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
      "id": 4,
      "name": "Priya Sharma",
      "email": "priya@school.edu",
      "role": "student",
      "class_level": 10
    }
  }
  ```

#### B. User Login (`POST /api/auth/login`)
- **Request Body**:
  ```json
  {
    "email": "priya@school.edu",
    "password": "securepassword123"
  }
  ```
- **Response Body (`200 OK`)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
      "id": 4,
      "name": "Priya Sharma",
      "email": "priya@school.edu",
      "role": "student",
      "class_level": 10
    }
  }
  ```

#### C. Current User Profile (`GET /api/auth/me`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Body (`200 OK`)**:
  ```json
  {
    "id": 4,
    "name": "Priya Sharma",
    "email": "priya@school.edu",
    "role": "student",
    "class_level": 10
  }
  ```

---

### 3. Request Headers Attached by Frontend

The frontend Axios client (`frontend/src/services/api.ts`) automatically attaches the following headers to **all** backend HTTP requests:

| Header Name | Format / Example | Description |
|---|---|---|
| `Authorization` | `Bearer eyJhbGciOiJIUzI1Ni...` | Standard Bearer JWT access token |
| `X-User-Id` | `4` | Stringified current authenticated user ID |

Backend endpoints can extract the current user using standard FastAPI dependency injection:
```python
from fastapi import Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    x_user_id: int | None = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db)
) -> User:
    # 1. Decode JWT or verify X-User-Id
    # 2. Return User database instance
    ...
```

---

### 4. Role-Based Access Control (RBAC) Gating

Protect backend routes based on the authenticated user's role:

1. **Student Endpoints**:
   - `POST /attempts/`: Validate that the payload `user_id` matches the authenticated `current_user.id`.
2. **Admin Endpoints**:
   - `POST /intelligence/admin/heatmap`: Restrict to `current_user.role == "admin"`.
   - `POST /documents/upload`: Restrict to `current_user.role == "admin"`.
   - `POST /chunks/bulk-update-topic`: Restrict to `current_user.role == "admin"`.

---

### 5. Seeded Personas for Validation

Seed the following test accounts in your database to test compatibility with the frontend's 1-click persona switcher:

| Name | Email | Role | Class Level | Purpose |
|---|---|---|---|---|
| Asha Demo | `learntrace.demo.asha@example.invalid` | `student` | `10` | Student needing Trigonometry remediation |
| Ravi Demo | `learntrace.demo.ravi@example.invalid` | `student` | `10` | Student with developing mastery |
| Meera Demo | `learntrace.demo.meera@example.invalid` | `student` | `10` | Student with high mastery |
| Curriculum Admin | `admin@learntrace.edu` | `admin` | `None` | Staff administrator for PDF ingestion & heatmap |
