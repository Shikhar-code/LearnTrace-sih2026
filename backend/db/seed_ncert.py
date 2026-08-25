from core.database import SessionLocal
from models.academic import Subject
from models.content import SourceDocument


NCERT_SOURCES = [
    {
        "title": "Mathematics Textbook for Class X",
        "source_name": "NCERT",
        "source_type": "textbook",
        "source_url": "https://www.ncert.nic.in/textbook/pdf/jemh1ps.pdf",
        "file_type": "pdf",
        "language": "English",
        "class_level": 10,
        "subject_name": "Mathematics",
    },
    {
        "title": "Science Textbook for Class X",
        "source_name": "NCERT",
        "source_type": "textbook",
        "source_url": "https://www.ncert.nic.in/textbook/pdf/jesc1ps.pdf",
        "file_type": "pdf",
        "language": "English",
        "class_level": 10,
        "subject_name": "Science",
    },
    {
        "title": "Science Textbook for Class IX - Exploration",
        "source_name": "NCERT",
        "source_type": "textbook",
        "source_url": "https://ncert.nic.in/textbook/pdf/iesc1ps.pdf",
        "file_type": "pdf",
        "language": "English",
        "class_level": 9,
        "subject_name": "Science",
    },
]


def seed_ncert_sources():
    db = SessionLocal()

    try:
        added = 0

        for source in NCERT_SOURCES:
            subject = (
                db.query(Subject)
                .filter(
                    Subject.class_level == source["class_level"],
                    Subject.name == source["subject_name"]
                )
                .first()
            )

            if not subject:
                print(
                    f"Subject not found: "
                    f"Class {source['class_level']} "
                    f"{source['subject_name']}"
                )
                continue

            existing = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.source_url == source["source_url"]
                )
                .first()
            )

            if existing:
                print(f"Already exists: {source['title']}")
                continue

            document = SourceDocument(
                title=source["title"],
                source_name=source["source_name"],
                source_type=source["source_type"],
                source_url=source["source_url"],
                file_type=source["file_type"],
                language=source["language"],
                class_level=source["class_level"],
                subject_id=subject.id,
                document_status="source_only",
            )

            db.add(document)
            added += 1

        db.commit()

        print(f"NCERT sources added: {added}")

    except Exception as error:
        db.rollback()
        print("Error while seeding NCERT sources:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    seed_ncert_sources()