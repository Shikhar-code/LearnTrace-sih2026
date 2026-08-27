from fastapi import FastAPI
from sqlalchemy import text

from core.database import Base, engine
from routes.documents import router as documents_router
from routes.topics import router as topics_router
from routes.chunks import router as chunks_router
from routes.academic import router as academic_router
from routes.questions import router as questions_router
from routes.assessments import router as assessments_router
from routes.attempts import router as attempts_router
from routes.mastery import router as mastery_router
from routes.intelligence import router as intelligence_router



# Import all models so SQLAlchemy knows about every table.
from models import (
    AcademicClass,
    Subject,
    Chapter,
    Topic,
    SourceDocument,
    DocumentChunk,
    LearningContent,
    Question,
    QuestionOption,
    Assessment,
    AssessmentQuestion,
    User,
    AssessmentAttempt,
    Response,
)

# Create all database tables.
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="LearnTrace API",
    description="SIH 2026 Backend",
    version="1.0.0"
)
app.include_router(documents_router)
app.include_router(topics_router)
app.include_router(chunks_router)
app.include_router(academic_router)
app.include_router(questions_router)
app.include_router(assessments_router)
app.include_router(attempts_router)
app.include_router(mastery_router)
app.include_router(intelligence_router)

@app.get("/")
def root():
    return {
        "message": "LearnTrace backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/database-test")
def database_test():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "success",
            "message": "PostgreSQL database connected successfully"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
from routes.ai_quizzes import router as ai_quizzes_router

app.include_router(ai_quizzes_router)
