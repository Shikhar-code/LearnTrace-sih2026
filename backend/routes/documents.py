from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.database import get_db
from models.academic import Subject, Chapter
from models.content import SourceDocument, DocumentChunk
from services.document_processor import (
    extract_text_from_pdf,
    split_into_chunks,
)

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    source_name: str = "NCERT",
    class_level: int = 10,
    subject_name: str = "Mathematics",
    chapter_title: str | None = None,
    db: Session = Depends(get_db),
):
    # 1. Validate file
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    # 2. Find subject
    subject = (
        db.query(Subject)
        .filter(
            Subject.class_level == class_level,
            Subject.name == subject_name,
        )
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Subject '{subject_name}' for Class "
                f"{class_level} was not found."
            ),
        )

    # 3. Find or create chapter
    chapter = None

    if chapter_title:
        chapter = (
            db.query(Chapter)
            .filter(
                Chapter.subject_id == subject.id,
                Chapter.title == chapter_title,
            )
            .first()
        )

        if not chapter:
            chapter = Chapter(
                title=chapter_title,
                subject_id=subject.id,
            )

            db.add(chapter)
            db.flush()

    # 4. Extract text from PDF
    try:
        pages = extract_text_from_pdf(pdf_bytes)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read PDF: {error}",
        )

    if not pages:
        raise HTTPException(
            status_code=400,
            detail="No extractable text was found in the PDF.",
        )

    # 5. Split into chunks
    chunks = split_into_chunks(pages)

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No text chunks could be created from the PDF.",
        )

    # 6. Save document metadata
    document = SourceDocument(
        title=file.filename or "Uploaded PDF",
        source_name=source_name,
        source_type="textbook",
        source_url="uploaded_file",
        file_type="pdf",
        language="English",
        class_level=class_level,
        subject_id=subject.id,
        chapter_id=chapter.id if chapter else None,
        document_status="processed",
    )

    db.add(document)
    db.flush()

    # 7. Save extracted chunks
    for chunk in chunks:
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_index=chunk["chunk_index"],
                content=chunk["content"],
                page_number=chunk["page_number"],
            )
        )

    db.commit()

    return {
        "status": "success",
        "document_id": document.id,
        "filename": file.filename,
        "class_level": class_level,
        "subject": subject.name,
        "chapter": chapter.title if chapter else None,
        "pages_extracted": len(pages),
        "chunks_created": len(chunks),
    }
@router.get("/catalogue")
def list_document_catalogue(
    class_level: int | None = None,
    subject_name: str | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(SourceDocument)
        .join(Subject)
        .filter(SourceDocument.source_name == "NCERT")
    )

    if class_level is not None:
        query = query.filter(
            SourceDocument.class_level == class_level
        )

    if subject_name is not None:
        query = query.filter(
            Subject.name == subject_name
        )

    documents = (
        query
        .order_by(
            SourceDocument.class_level,
            Subject.name,
            SourceDocument.id,
        )
        .all()
    )

    return [
        {
            "id": document.id,
            "title": document.title,
            "source_name": document.source_name,
            "source_type": document.source_type,
            "file_type": document.file_type,
            "language": document.language,
            "class_level": document.class_level,
            "subject": document.subject.name,
            "source_url": document.source_url,
            "status": document.document_status,
        }
        for document in documents
    ]    