from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from core.database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)

    question_text = Column(Text, nullable=False)

    question_type = Column(
        String(30),
        nullable=False,
        default="mcq"
    )

    difficulty = Column(
        String(20),
        nullable=False,
        default="medium"
    )

    topic_id = Column(
        Integer,
        ForeignKey("topics.id"),
        nullable=False
    )

    explanation = Column(Text, nullable=True)

    source_document_id = Column(
        Integer,
        ForeignKey("source_documents.id"),
        nullable=True
    )

    topic = relationship("Topic")
    source_document = relationship("SourceDocument")

    options = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan"
    )


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)

    question_id = Column(
        Integer,
        ForeignKey("questions.id"),
        nullable=False
    )

    option_text = Column(Text, nullable=False)

    is_correct = Column(
        Boolean,
        default=False,
        nullable=False
    )

    question = relationship(
        "Question",
        back_populates="options"
    )


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(255), nullable=False)

    description = Column(Text, nullable=True)

    class_level = Column(Integer, nullable=False)

    subject_id = Column(
        Integer,
        ForeignKey("subjects.id"),
        nullable=False
    )

    duration_minutes = Column(
        Integer,
        nullable=True
    )

    subject = relationship("Subject")

    questions = relationship(
        "AssessmentQuestion",
        back_populates="assessment",
        cascade="all, delete-orphan"
    )


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(Integer, primary_key=True, index=True)

    assessment_id = Column(
        Integer,
        ForeignKey("assessments.id"),
        nullable=False
    )

    question_id = Column(
        Integer,
        ForeignKey("questions.id"),
        nullable=False
    )

    question_order = Column(
        Integer,
        nullable=False
    )

    assessment = relationship(
        "Assessment",
        back_populates="questions"
    )

    question = relationship("Question")