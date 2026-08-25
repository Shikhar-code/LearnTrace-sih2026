from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.academic import Chapter, Topic


router = APIRouter(
    prefix="/topics",
    tags=["Topics"],
)


class TopicCreate(BaseModel):
    chapter_id: int
    title: str


@router.post("/")
def create_topic(
    topic_data: TopicCreate,
    db: Session = Depends(get_db),
):
    chapter = (
        db.query(Chapter)
        .filter(Chapter.id == topic_data.chapter_id)
        .first()
    )

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found.",
        )

    existing_topic = (
        db.query(Topic)
        .filter(
            Topic.chapter_id == topic_data.chapter_id,
            Topic.title == topic_data.title,
        )
        .first()
    )

    if existing_topic:
        return {
            "status": "already_exists",
            "topic_id": existing_topic.id,
            "title": existing_topic.title,
        }

    topic = Topic(
        title=topic_data.title,
        chapter_id=topic_data.chapter_id,
    )

    db.add(topic)
    db.commit()
    db.refresh(topic)

    return {
        "status": "success",
        "topic_id": topic.id,
        "title": topic.title,
        "chapter_id": topic.chapter_id,
    }


@router.get("/")
def list_topics(
    chapter_id: int,
    db: Session = Depends(get_db),
):
    topics = (
        db.query(Topic)
        .filter(Topic.chapter_id == chapter_id)
        .order_by(Topic.id)
        .all()
    )

    return [
        {
            "id": topic.id,
            "title": topic.title,
            "chapter_id": topic.chapter_id,
        }
        for topic in topics
    ]