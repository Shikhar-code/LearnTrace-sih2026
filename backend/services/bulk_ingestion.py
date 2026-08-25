import re
from pathlib import Path

from core.database import SessionLocal
from models.academic import Subject, Chapter
from models.content import SourceDocument, DocumentChunk
from services.document_processor import (
    extract_text_from_pdf,
    split_into_chunks,
)


BASE_DIR = Path("ncert_materials")


def get_class_level(class_folder: Path) -> int:
    return int(class_folder.name.replace("class", ""))


def get_source_type(material_folder: Path) -> str:
    name = material_folder.name.lower()

    if name == "textbooks":
        return "textbook"

    if name == "exemplars":
        return "exemplar"

    return name


def clean_text(text: str) -> str:
    """
    Clean extracted PDF text so heading detection is easier.
    """
    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def detect_chapter_title(pages: list[dict]) -> str | None:
    """
    Try to identify a chapter/section title from the first few pages.

    This is intentionally conservative. If we cannot identify a useful
    title, we return None instead of guessing.
    """

    if not pages:
        return None

    first_pages_text = ""

    for page in pages[:3]:
        first_pages_text += " " + page.get("text", "")

    text = clean_text(first_pages_text)

    # Common NCERT-style chapter markers.
    patterns = [
        r"Chapter\s+\d+\s*[:\-–]?\s*([A-Za-z][A-Za-z0-9 ,&'()\-–]+)",
        r"CHAPTER\s+\d+\s*[:\-–]?\s*([A-Za-z][A-Za-z0-9 ,&'()\-–]+)",
        r"UNIT\s+\d+\s*[:\-–]?\s*([A-Za-z][A-Za-z0-9 ,&'()\-–]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)

        if match:
            title = match.group(1).strip()

            if len(title) > 2:
                return title[:255]

    # Try lines containing common appendix markers.
    raw_text = pages[0].get("text", "")

    appendix_match = re.search(
        r"(Appendix\s+[A-Za-z0-9]+\s*[:\-–]?\s*[^\n]+)",
        raw_text,
        flags=re.IGNORECASE,
    )

    if appendix_match:
        title = appendix_match.group(1).strip()
        return title[:255]

    return None


def find_or_create_chapter(
    db,
    subject,
    chapter_title: str | None,
):
    if not chapter_title:
        return None

    existing = (
        db.query(Chapter)
        .filter(
            Chapter.subject_id == subject.id,
            Chapter.title == chapter_title,
        )
        .first()
    )

    if existing:
        return existing

    chapter = Chapter(
        title=chapter_title,
        subject_id=subject.id,
    )

    db.add(chapter)
    db.flush()

    return chapter


def process_pdf(
    db,
    pdf_path: Path,
    class_level: int,
    subject_name: str,
    source_type: str,
):
    subject = (
        db.query(Subject)
        .filter(
            Subject.class_level == class_level,
            Subject.name == subject_name,
        )
        .first()
    )

    if not subject:
        print(
            f"SKIPPED: Subject not found - "
            f"Class {class_level} | {subject_name}"
        )
        return

    existing = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.title == pdf_path.name,
            SourceDocument.class_level == class_level,
            SourceDocument.subject_id == subject.id,
            SourceDocument.source_type == source_type,
        )
        .first()
    )

    if existing:
        print(
            f"ALREADY EXISTS: "
            f"Class {class_level} | "
            f"{subject_name} | "
            f"{source_type} | "
            f"{pdf_path.name}"
        )
        return

    try:
        pdf_bytes = pdf_path.read_bytes()

        pages = extract_text_from_pdf(pdf_bytes)

        if not pages:
            print(
                f"FAILED: No text extracted | "
                f"{pdf_path.name}"
            )
            return

        chunks = split_into_chunks(pages)

        if not chunks:
            print(
                f"FAILED: No chunks created | "
                f"{pdf_path.name}"
            )
            return

        chapter_title = detect_chapter_title(pages)

        chapter = find_or_create_chapter(
            db,
            subject,
            chapter_title,
        )

        document = SourceDocument(
            title=pdf_path.name,
            source_name="NCERT",
            source_type=source_type,
            source_url="local_upload",
            file_type="pdf",
            language="English",
            class_level=class_level,
            subject_id=subject.id,
            chapter_id=chapter.id if chapter else None,
            document_status="processed",
        )

        db.add(document)
        db.flush()

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

        chapter_display = (
            chapter.title
            if chapter
            else "NOT AUTO-MAPPED"
        )

        print(
            f"SUCCESS: "
            f"Class {class_level} | "
            f"{subject_name} | "
            f"{source_type} | "
            f"{pdf_path.name} | "
            f"Chapter: {chapter_display} | "
            f"{len(pages)} pages | "
            f"{len(chunks)} chunks"
        )

    except Exception as error:
        db.rollback()

        print(
            f"FAILED: "
            f"Class {class_level} | "
            f"{subject_name} | "
            f"{pdf_path.name} | "
            f"{error}"
        )


def run_bulk_ingestion():
    if not BASE_DIR.exists():
        print("ncert_materials folder does not exist.")
        return

    db = SessionLocal()

    total_files = 0

    try:
        for class_folder in sorted(BASE_DIR.iterdir()):

            if not class_folder.is_dir():
                continue

            if not class_folder.name.startswith("class"):
                continue

            class_level = get_class_level(class_folder)

            for subject_folder in sorted(class_folder.iterdir()):

                if not subject_folder.is_dir():
                    continue

                subject_name = subject_folder.name.title()

                for material_folder in sorted(
                    subject_folder.iterdir()
                ):

                    if not material_folder.is_dir():
                        continue

                    source_type = get_source_type(material_folder)

                    for pdf_path in sorted(
                        material_folder.glob("*.pdf")
                    ):
                        total_files += 1

                        process_pdf(
                            db=db,
                            pdf_path=pdf_path,
                            class_level=class_level,
                            subject_name=subject_name,
                            source_type=source_type,
                        )

        print()
        print(
            f"Bulk ingestion finished. "
            f"PDF files found: {total_files}"
        )

    finally:
        db.close()


if __name__ == "__main__":
    run_bulk_ingestion()