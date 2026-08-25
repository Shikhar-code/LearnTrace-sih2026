from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.academic import AcademicClass, Subject, Chapter, Topic


router = APIRouter(
    prefix="/academic",
    tags=["Academic"],
)


@router.get("/classes")
def list_classes(
    db: Session = Depends(get_db),
):
    classes = (
        db.query(AcademicClass)
        .order_by(AcademicClass.class_level)
        .all()
    )

    return [
        {
            "id": academic_class.id,
            "class_level": academic_class.class_level,
        }
        for academic_class in classes
    ]


@router.get("/subjects")
def list_subjects(
    class_level: int,
    db: Session = Depends(get_db),
):
    subjects = (
        db.query(Subject)
        .filter(Subject.class_level == class_level)
        .order_by(Subject.name)
        .all()
    )

    return [
        {
            "id": subject.id,
            "name": subject.name,
            "class_level": subject.class_level,
        }
        for subject in subjects
    ]


@router.get("/chapters")
def list_chapters(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found.",
        )

    chapters = (
        db.query(Chapter)
        .filter(Chapter.subject_id == subject_id)
        .order_by(Chapter.id)
        .all()
    )

    return [
        {
            "id": chapter.id,
            "title": chapter.title,
            "subject_id": chapter.subject_id,
        }
        for chapter in chapters
    ]


@router.get("/topics")
def list_topics(
    chapter_id: int,
    db: Session = Depends(get_db),
):
    chapter = (
        db.query(Chapter)
        .filter(Chapter.id == chapter_id)
        .first()
    )

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found.",
        )

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