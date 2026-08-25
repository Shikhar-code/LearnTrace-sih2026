from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.database import Base


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(255), nullable=False)

    source_name = Column(String(100), nullable=False)
    source_type = Column(
    String(50),
    nullable=False,
    default="textbook"
)

    source_url = Column(Text, nullable=False)

    file_type = Column(String(20), nullable=False)
    language = Column(
    String(20),
    nullable=False,
    default="English"
)

    class_level = Column(Integer, nullable=False)

    subject_id = Column(
        Integer,
        ForeignKey("subjects.id"),
        nullable=False
    )

    chapter_id = Column(
        Integer,
        ForeignKey("chapters.id"),
        nullable=True
    )

    document_status = Column(
        String(50),
        nullable=False,
        default="pending"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    subject = relationship("Subject")
    chapter = relationship("Chapter")
    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)

    document_id = Column(
        Integer,
        ForeignKey("source_documents.id"),
        nullable=False
    )

    chunk_index = Column(Integer, nullable=False)

    content = Column(Text, nullable=False)

    page_number = Column(Integer, nullable=True)

    topic_id = Column(
        Integer,
        ForeignKey("topics.id"),
        nullable=True
    )

    document = relationship(
        "SourceDocument",
        back_populates="chunks"
    )

    topic = relationship("Topic")


class LearningContent(Base):
    __tablename__ = "learning_contents"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(255), nullable=False)

    content_type = Column(
        String(50),
        nullable=False
    )

    content = Column(Text, nullable=False)

    topic_id = Column(
        Integer,
        ForeignKey("topics.id"),
        nullable=False
    )

    source_document_id = Column(
        Integer,
        ForeignKey("source_documents.id"),
        nullable=True
    )

    source_url = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    topic = relationship("Topic")
    source_document = relationship("SourceDocument")