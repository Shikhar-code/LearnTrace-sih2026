# Today's Backend Work – LearnTrace

## Date
27 August 2026

## Work Completed Today

### 1. LLM Integration
Implemented AI-based quiz generation in the LearnTrace backend.

Current LLM setup:

```text
Gemini 3.5 Flash
        ↓
      Primary
        ↓ if unavailable
Groq GPT-OSS 20B
        ↓
     Fallback
```

Environment variables configured:

```env
GEMINI_MODEL=gemini-3.5-flash
GROQ_MODEL=openai/gpt-oss-20b
```

Both APIs were tested successfully.

---

## 2. NCERT-Based Quiz Generation

Connected the AI quiz generator to the existing NCERT content stored in PostgreSQL.

Flow:

```text
Topic
   ↓
NCERT document chunks
   ↓
Gemini / Groq
   ↓
Generated MCQs
```

The generated questions are based on the NCERT chunks associated with the selected topic.

---

## 3. Quiz Validation

Added validation for generated questions.

The backend checks that:

- The requested number of questions is returned.
- Each question contains question text.
- Each question has a valid difficulty.
- Each question has exactly 4 options.
- Exactly one option is marked as correct.
- An explanation is included.
- The response is valid JSON.

---

## 4. Automatic Database Storage

Connected generated quizzes to the existing PostgreSQL database.

Generated data is stored in:

```text
questions
question_options
assessments
assessment_questions
```

Generated questions are linked to the selected topic and source NCERT document.

---

## 5. AI Quiz API

Added:

```http
POST /ai-quizzes/generate
```

Example request:

```json
{
  "topic_id": 1,
  "number_of_questions": 3,
  "difficulty": "easy",
  "duration_minutes": 10
}
```

The API:

1. Finds the selected topic.
2. Retrieves relevant NCERT chunks.
3. Generates questions using Gemini.
4. Uses Groq as fallback if Gemini fails.
5. Validates the generated questions.
6. Saves the questions and options.
7. Creates an assessment.
8. Returns the assessment ID.

---

## 6. Assessment Retrieval

Verified that generated assessments can be retrieved through:

```http
GET /assessments/{assessment_id}
```

A generated assessment was successfully created with:

```text
Assessment ID: 3
Questions: 3
Class: 10
Subject ID: 3
Topic: Introduction to Mathematical Modelling
```

The assessment API successfully returned the generated questions and options.

The correct-answer information is kept hidden from the student-facing response.

---

## 7. FastAPI Integration

Registered the AI quiz route in `main.py`.

Swagger/OpenAPI exposes:

```text
POST /ai-quizzes/generate
```

The endpoint was tested successfully through Swagger.

---

## 8. Dependencies

Updated the backend environment and `requirements.txt`.

Packages added or verified include:

```text
fastapi
uvicorn
sqlalchemy
psycopg2-binary
pypdf
python-multipart
python-dotenv
groq
google-genai
```

---

## 9. Testing Completed

```text
PostgreSQL connection             ✅
NCERT chunk retrieval             ✅
Gemini API                        ✅
Groq API                          ✅
AI quiz generation                ✅
MCQ validation                    ✅
Question storage                  ✅
Option storage                    ✅
Assessment creation               ✅
Assessment retrieval              ✅
Swagger API testing               ✅
```

---

## 10. GitHub Integration

The latest backend work was merged with the team's latest changes.

Main files for today's LLM work:

```text
backend/main.py
backend/routes/ai_quizzes.py
backend/services/llm_quiz_generator.py
backend/requirements.txt
```

Sensitive files such as `.env` remain local and are not committed.

---

## Remaining Improvement

The current system validates the structure of generated questions and the selected correct option.

A further improvement is to add stronger semantic answer verification against the NCERT source before accepting an AI-generated question.

---

## Today's Result

The LearnTrace backend can now automatically generate an NCERT-based quiz from a selected topic using:

```text
Gemini 3.5 Flash → Primary
Groq GPT-OSS 20B → Fallback
```

The generated assessment and questions are stored in PostgreSQL and can be retrieved by the frontend through the assessment API.
