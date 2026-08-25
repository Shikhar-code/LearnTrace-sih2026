from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.content import DocumentChunk
from models.academic import Topic


router = APIRouter(
    prefix="/chunks",
    tags=["Document Chunks"],
)


class ChunkTopicUpdate(BaseModel):
    topic_id: int


@router.patch("/{chunk_id}/topic")
def assign_chunk_to_topic(
    chunk_id: int,
    data: ChunkTopicUpdate,
    db: Session = Depends(get_db),
):
    chunk = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.id == chunk_id)
        .first()
    )

    if not chunk:
        raise HTTPException(
            status_code=404,
            detail="Document chunk not found.",
        )

    topic = (
        db.query(Topic)
        .filter(Topic.id == data.topic_id)
        .first()
    )

    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Topic not found.",
        )

    chunk.topic_id = topic.id

    db.commit()
    db.refresh(chunk)

    return {
        "status": "success",
        "chunk_id": chunk.id,
        "topic_id": chunk.topic_id,
        "topic": topic.title,
    }


@router.get("/")
def list_chunks(
    document_id: int,
    db: Session = Depends(get_db),
):
    chunks = (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.document_id == document_id
        )
        .order_by(DocumentChunk.chunk_index)
        .all()
    )

    return [
        {
            "id": chunk.id,
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "page_number": chunk.page_number,
            "topic_id": chunk.topic_id,
            "content": chunk.content[:500],
        }
        for chunk in chunks
    ]
class BulkChunkTopicUpdate(BaseModel):
    chunk_ids: list[int]
    topic_id: int


@router.patch("/bulk-topic")
def assign_chunks_to_topic(
    data: BulkChunkTopicUpdate,
    db: Session = Depends(get_db),
):
    topic = (
        db.query(Topic)
        .filter(Topic.id == data.topic_id)
        .first()
    )

    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Topic not found.",
        )

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.id.in_(data.chunk_ids))
        .all()
    )

    if len(chunks) != len(data.chunk_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more document chunks were not found.",
        )

    for chunk in chunks:
        chunk.topic_id = topic.id

    db.commit()

    return {
        "status": "success",
        "topic_id": topic.id,
        "topic": topic.title,
        "chunks_updated": len(chunks),
    }    