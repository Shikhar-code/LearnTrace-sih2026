from core.database import SessionLocal
from models.academic import Subject
from models.content import SourceDocument


NCERT_CATALOGUE = [
    # -------------------------------------------------
    # CLASS 9
    # -------------------------------------------------

    {
        "class_level": 9,
        "subject_name": "Mathematics",
        "title": "NCERT Mathematics - Class IX",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 9,
        "subject_name": "Science",
        "title": "NCERT Science - Class IX",
        "source_url": "https://ncert.nic.in/textbook.php?iesc1=9-12",
    },

    # -------------------------------------------------
    # CLASS 10
    # -------------------------------------------------

    {
        "class_level": 10,
        "subject_name": "Mathematics",
        "title": "NCERT Mathematics - Class X",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 10,
        "subject_name": "Science",
        "title": "NCERT Science - Class X",
        "source_url": "https://ncert.nic.in/textbook.php",
    },

    # -------------------------------------------------
    # CLASS 11
    # -------------------------------------------------

    {
        "class_level": 11,
        "subject_name": "Mathematics",
        "title": "NCERT Mathematics - Class XI",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 11,
        "subject_name": "Physics",
        "title": "NCERT Physics - Class XI",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 11,
        "subject_name": "Chemistry",
        "title": "NCERT Chemistry - Class XI",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 11,
        "subject_name": "Biology",
        "title": "NCERT Biology - Class XI",
        "source_url": "https://ncert.nic.in/textbook.php",
    },

    # -------------------------------------------------
    # CLASS 12
    # -------------------------------------------------

    {
        "class_level": 12,
        "subject_name": "Mathematics",
        "title": "NCERT Mathematics - Class XII",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 12,
        "subject_name": "Physics",
        "title": "NCERT Physics - Class XII",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 12,
        "subject_name": "Chemistry",
        "title": "NCERT Chemistry - Class XII",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
    {
        "class_level": 12,
        "subject_name": "Biology",
        "title": "NCERT Biology - Class XII",
        "source_url": "https://ncert.nic.in/textbook.php",
    },
]


def seed_ncert_catalogue():
    db = SessionLocal()

    try:
        added = 0
        skipped = 0

        for item in NCERT_CATALOGUE:

            subject = (
                db.query(Subject)
                .filter(
                    Subject.class_level == item["class_level"],
                    Subject.name == item["subject_name"],
                )
                .first()
            )

            if not subject:
                print(
                    f"Subject not found: "
                    f"Class {item['class_level']} - "
                    f"{item['subject_name']}"
                )
                continue

            existing = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == item["title"],
                    SourceDocument.class_level == item["class_level"],
                    SourceDocument.subject_id == subject.id,
                )
                .first()
            )

            if existing:
                skipped += 1
                continue

            document = SourceDocument(
                title=item["title"],
                source_name="NCERT",
                source_type="textbook",
                source_url=item["source_url"],
                file_type="pdf",
                language="English",
                class_level=item["class_level"],
                subject_id=subject.id,
                chapter_id=None,
                document_status="catalogued",
            )

            db.add(document)
            added += 1

        db.commit()

        print(f"NCERT catalogue entries added: {added}")
        print(f"NCERT catalogue entries already present: {skipped}")

    except Exception as error:
        db.rollback()
        print("Error while seeding NCERT catalogue:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    seed_ncert_catalogue()