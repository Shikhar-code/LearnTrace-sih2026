# LearnTrace Backend

Backend and database layer for the **LearnTrace SIH 2026** project.

The current backend focuses on **Class 9 and Class 10 Mathematics and Science content**, using **NCERT as the primary content source**.

---

## Tech Stack

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- Uvicorn
- PyPDF
- PyMuPDF

---

## Current Scope

The current supported academic scope is:

```text
Class 9
├── Mathematics
└── Science

Class 10
├── Mathematics
└── Science
```

NCERT is currently used as the base/reference source for the learning content.

---

## Backend Architecture

```text
NCERT PDF
    ↓
Document Upload
    ↓
PDF Text Extraction
    ↓
Document Chunking
    ↓
Source Document
    ↓
Class / Subject
    ↓
Chapter
    ↓
Topic
    ↓
Questions
    ↓
Assessment / Quiz
    ↓
Student Attempt
    ↓
Responses
    ↓
Mastery Engine
```

---

## Project Structure

```text
backend/
│
├── core/
│   ├── __init__.py
│   ├── config.py
│   └── database.py
│
├── db/
│   ├── __init__.py
│   ├── seed.py
│   ├── seed_subjects.py
│   ├── seed_ncert.py
│   ├── seed_ncert_catalogue.py
│   ├── migrate_content.py
│   ├── repair_class9_math.py
│   ├── repair_class9_science.py
│   ├── repair_class9_science_shift.py
│   ├── repair_class10_math.py
│   ├── repair_class10_science.py
│   ├── shift_class9_science.py
│   └── other database setup/repair scripts
│
├── models/
│   ├── __init__.py
│   ├── academic.py
│   ├── content.py
│   ├── quiz.py
│   └── attempt.py
│
├── routes/
│   ├── __init__.py
│   ├── academic.py
│   ├── documents.py
│   ├── chunks.py
│   ├── topics.py
│   ├── questions.py
│   ├── assessments.py
│   ├── attempts.py
│   └── mastery.py
│
├── services/
│   ├── __init__.py
│   ├── document_processor.py
│   └── bulk_ingestion.py
│
├── main.py
├── requirements.txt
└── .gitignore
```

---

## Database

PostgreSQL is used as the primary database.

The main tables include:

```text
academic_classes
subjects
chapters
topics
source_documents
document_chunks
learning_contents
questions
question_options
assessments
assessment_questions
users
assessment_attempts
responses
```

### Academic hierarchy

```text
Class
  ↓
Subject
  ↓
Chapter
  ↓
Topic
```

### Content hierarchy

```text
Source Document
  ↓
Document Chunk
```

### Quiz hierarchy

```text
Question
  ↓
Question Options

Assessment
  ↓
Assessment Questions
```

### Student activity

```text
User
  ↓
Assessment Attempt
  ↓
Responses
```

---

## PostgreSQL Integration

The backend connects FastAPI to PostgreSQL using SQLAlchemy.

The database connection is handled through:

```text
core/database.py
```

The application uses a PostgreSQL database named:

```text
learntrace
```

Environment-specific credentials are stored locally in `.env`.

`.env` is intentionally excluded from GitHub.

---

## NCERT Integration

NCERT is the primary content source for the current Class 9–10 scope.

The backend supports:

1. NCERT resource catalogue
2. PDF upload
3. PDF text extraction
4. Text chunking
5. PostgreSQL document storage
6. Class and subject association
7. Chapter mapping
8. Topic mapping
9. Source document tracking

### Content pipeline

```text
NCERT PDF
   ↓
Upload
   ↓
Source Document
   ↓
Text Extraction
   ↓
Document Chunks
   ↓
Chapter
   ↓
Topic
```

---

## NCERT Resource Catalogue

The backend maintains an NCERT resource catalogue for the supported academic scope.

Example endpoint:

```text
GET /documents/catalogue
```

Optional filters:

```text
class_level
subject_name
```

Examples:

```text
GET /documents/catalogue?class_level=9
```

```text
GET /documents/catalogue?class_level=10&subject_name=Mathematics
```

---

## Document APIs

### Upload a document

```text
POST /documents/upload
```

The endpoint accepts:

- source name
- class level
- subject
- optional chapter
- PDF file

The document is then processed and stored in PostgreSQL.

### List resources

```text
GET /documents/catalogue
```

---

## Academic APIs

The academic APIs allow the frontend to navigate the curriculum.

### Classes

```text
GET /academic/classes
```

### Subjects

```text
GET /academic/subjects?class_level=10
```

### Chapters

```text
GET /academic/chapters?subject_id=3
```

### Topics

```text
GET /academic/topics?chapter_id=1
```

The intended frontend flow is:

```text
Choose Class
    ↓
Choose Subject
    ↓
Choose Chapter
    ↓
Choose Topic
```

---

## Topic APIs

Topics are stored under chapters.

Example:

```text
POST /topics/
```

Topics can also be retrieved by chapter.

```text
GET /topics/?chapter_id=1
```

---

## Document Chunk APIs

Document chunks store extracted sections of textbook content.

### List chunks

```text
GET /chunks/?document_id=5
```

### Assign a chunk to a topic

```text
PATCH /chunks/{chunk_id}/topic
```

### Assign multiple chunks to a topic

```text
PATCH /chunks/bulk-topic
```

This allows extracted textbook content to be connected to the academic topic hierarchy.

---

## Question API

Questions are currently represented as structured MCQs.

### Create a question

```text
POST /questions/
```

Example:

```json
{
  "question_text": "Which of the following is an example of mathematical modelling mentioned in the NCERT material?",
  "question_type": "mcq",
  "difficulty": "easy",
  "topic_id": 1,
  "explanation": "The material describes mathematical modelling as a process used to represent and study real-life situations mathematically.",
  "source_document_id": 5,
  "options": [
    {
      "option_text": "Estimating the number of fishes in a lake",
      "is_correct": true
    },
    {
      "option_text": "Counting every fish in a lake individually",
      "is_correct": false
    },
    {
      "option_text": "Measuring every artery in an adult human body directly",
      "is_correct": false
    },
    {
      "option_text": "Measuring the surface of the Sun directly",
      "is_correct": false
    }
  ]
}
```

### Retrieve questions for a topic

```text
GET /questions/?topic_id=1
```

---

## Assessment / Quiz API

Assessments represent quizzes.

### Create an assessment

```text
POST /assessments/
```

Example:

```json
{
  "title": "Class 10 Mathematics - Mathematical Modelling Quiz",
  "description": "NCERT-based introductory assessment on mathematical modelling.",
  "class_level": 10,
  "subject_id": 3,
  "duration_minutes": 10
}
```

### Add a question to an assessment

```text
POST /assessments/{assessment_id}/questions
```

### Retrieve an assessment

```text
GET /assessments/{assessment_id}
```

---

## Attempt and Response API

### Start an assessment attempt

```text
POST /attempts/
```

### Submit a response

```text
POST /attempts/{attempt_id}/responses
```

### Finish an attempt

```text
POST /attempts/{attempt_id}/finish
```

The response data includes correctness information that can later be consumed by the mastery module.

---

## Mastery Integration

The backend provides a dedicated interface for the mastery engine.

### Endpoint

```text
GET /mastery/input/{attempt_id}
```

This returns structured evidence associated with the student's attempt, including:

- attempt ID
- user ID
- assessment ID
- score
- question ID
- topic ID
- topic
- chapter ID
- chapter
- subject ID
- subject
- class level
- correctness
- response time

Example structure:

```json
{
  "attempt_id": 1,
  "user_id": 5,
  "assessment_id": 1,
  "completed": true,
  "score": 60,
  "responses": [
    {
      "response_id": 12,
      "question_id": 21,
      "topic_id": 8,
      "topic": "Quadratic Equations",
      "chapter_id": 4,
      "chapter": "Quadratic Equations",
      "subject_id": 3,
      "subject": "Mathematics",
      "class_level": 10,
      "is_correct": false,
      "response_time_seconds": 18
    }
  ]
}
```

This endpoint is intended to provide the mastery engine with structured assessment evidence without requiring it to directly query PostgreSQL.

---

## Document Processing

The main PDF processing code is located in:

```text
services/document_processor.py
```

The processing pipeline is:

```text
PDF
 ↓
Text Extraction
 ↓
Page Text
 ↓
Chunking
 ↓
document_chunks
```

The bulk local ingestion utility is:

```text
services/bulk_ingestion.py
```

It can process PDFs from the local NCERT material folders and store the extracted data in PostgreSQL.

---

## Database Seed and Repair Scripts

The `db/` directory contains scripts used to:

- seed subjects
- seed NCERT catalogue data
- migrate content
- repair chapter mappings
- repair imported NCERT document metadata
- handle Class 9 and Class 10 content mapping

These scripts are intended to make the database setup reproducible and easier to maintain.

---

## Running the Backend

### Create the virtual environment

```powershell
python -m venv venv
```

### Activate the virtual environment

PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

### Install dependencies

```powershell
pip install -r requirements.txt
```

### Configure the database

Create a local `.env` file containing the PostgreSQL connection information.

Example:

```env
DATABASE_URL=postgresql+psycopg2://username:password@localhost:5432/learntrace
```

Do not commit `.env` to GitHub.

### Start the API

```powershell
uvicorn main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

---

## Current Status

### Completed

- PostgreSQL database setup
- SQLAlchemy integration
- Academic database schema
- Class 9 Mathematics integration
- Class 9 Science integration
- Class 10 Mathematics integration
- Class 10 Science integration
- NCERT resource catalogue
- NCERT PDF ingestion
- PDF text extraction
- Document chunking
- Chapter mapping
- Topic mapping
- Question and option APIs
- Assessment / quiz APIs
- Student attempt APIs
- Response APIs
- Mastery-engine input API
- Frontend-facing academic APIs
- GitHub integration

### Current Content Scope

```text
Class 9
├── Mathematics
└── Science

Class 10
├── Mathematics
└── Science
```

NCERT is currently the primary content base.

---

## Repository and Data Policy

The GitHub repository contains the backend source code and database setup/seed scripts.

The following are intentionally **not** committed:

```text
.env
venv/
ncert_materials/
__pycache__/
local database files
```

The live PostgreSQL database is maintained separately and is not stored directly in GitHub.

NCERT source PDFs are also kept outside the repository.

---

## Team Integration

### Frontend

The frontend can consume the FastAPI endpoints through:

```text
http://127.0.0.1:8000/docs
```

The main navigation flow is:

```text
Class
 ↓
Subject
 ↓
Chapter
 ↓
Topic
 ↓
Learning Content / Quiz
```

### Mastery Module

The mastery module can consume student-response evidence through:

```text
GET /mastery/input/{attempt_id}
```

The backend is responsible for providing structured assessment evidence; the mastery logic can operate on that data separately.

### Intelligence analysis

The thin integration route passes existing assessment payloads to the sibling
`intelligence_engine` package. It does not change the database schema.

```text
GET  /intelligence/analyze/{attempt_id}
POST /intelligence/analyze
POST /intelligence/admin/heatmap
```

For a repeatable live demo, seed three isolated Class 10 Mathematics learners
and their diagnostic/reassessment attempts:

```powershell
python -m db.seed_intelligence_demo
```

The command prints the generated attempt IDs and can be rerun without creating
duplicate demo records.

The JSON response contains raw concept evidence, five-tier mastery, explainable
root gaps, and a gated learning path. Its `frontend` object also provides
summary cards, chart series, a class/subject competency graph, and a focused
root-cause graph. POST accepts multiple attempts for diagnostic/reassessment
analysis.

The admin heatmap endpoint groups explicitly supplied attempt IDs by learner
and returns the cohort matrix, per-concept risk statistics, tier counts, and
root-gap distribution as JSON. Connect the project's authentication layer to
this route before exposing it outside the trusted development environment.

---

## Development Notes

- Keep secrets in `.env`.
- Do not commit `.env`.
- Do not commit `venv/`.
- Do not commit downloaded NCERT PDFs.
- Do not commit the live PostgreSQL database.
- Use the database seed/migration scripts for reproducible setup.
- Use the API endpoints rather than direct database access from the frontend.

---

## Current Repository Location

The backend is maintained inside the team repository:

```text
LearnTrace-sih2026/
└── backend/
```

The `backend` directory contains the database, API, document ingestion, quiz, assessment, and mastery integration components.
