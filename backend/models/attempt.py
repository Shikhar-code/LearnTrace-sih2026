from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), nullable=False)

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    class_level = Column(
        Integer,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    attempts = relationship(
        "AssessmentAttempt",
        back_populates="user"
    )


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    assessment_id = Column(
        Integer,
        ForeignKey("assessments.id"),
        nullable=False
    )

    started_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    finished_at = Column(
        DateTime,
        nullable=True
    )

    score = Column(
        Integer,
        nullable=True
    )

    completed = Column(
        Boolean,
        default=False,
        nullable=False
    )

    user = relationship(
        "User",
        back_populates="attempts"
    )

    assessment = relationship("Assessment")

    responses = relationship(
        "Response",
        back_populates="attempt",
        cascade="all, delete-orphan"
    )


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)

    attempt_id = Column(
        Integer,
        ForeignKey("assessment_attempts.id"),
        nullable=False
    )

    question_id = Column(
        Integer,
        ForeignKey("questions.id"),
        nullable=False
    )

    selected_option_id = Column(
        Integer,
        ForeignKey("question_options.id"),
        nullable=True
    )

    answer_text = Column(
        Text,
        nullable=True
    )

    is_correct = Column(
        Boolean,
        nullable=True
    )

    response_time_seconds = Column(
        Integer,
        nullable=True
    )

    attempt = relationship(
        "AssessmentAttempt",
        back_populates="responses"
    )

    question = relationship("Question")

    selected_option = relationship("QuestionOption")