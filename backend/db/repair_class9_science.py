from core.database import SessionLocal
from models.academic import Subject, Chapter
from models.content import SourceDocument


CHAPTERS = {
    "iesc101.pdf": "Exploration: Entering the World of Secondary Science",
    "iesc102.pdf": "Cell: The Building Block of Life",
    "iesc103.pdf": "Tissues in Action",
    "iesc104.pdf": "Describing Motion Around Us",
    "iesc105.pdf": "Exploring Mixtures and their Separation",
    "iesc106.pdf": "How Forces Affect Motion",
    "iesc107.pdf": "Work, Energy, and Simple Machines",
    "iesc108.pdf": "Journey Inside the Atom",
    "iesc109.pdf": "Atomic Foundations of Matter",
    "iesc110.pdf": "Sound Waves: Characteristics and Applications",
    "iesc111.pdf": "Reproduction: How Life Continues",
    "iesc112.pdf": "Patterns in Life: Diversity and Classification",
    "iesc113.pdf": "Earth as a System: Energy, Matter, and Life",
}


def repair_class9_science():
    db = SessionLocal()

    try:
        subject = (
            db.query(Subject)
            .filter(
                Subject.class_level == 9,
                Subject.name == "Science",
            )
            .first()
        )

        if not subject:
            print("Class 9 Science subject was not found.")
            return

        mapped = 0
        already_mapped = 0
        skipped = 0

        for filename, chapter_title in CHAPTERS.items():

            document = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == filename,
                    SourceDocument.class_level == 9,
                    SourceDocument.subject_id == subject.id,
                    SourceDocument.source_type == "textbook",
                )
                .first()
            )

            if not document:
                print(f"DOCUMENT NOT FOUND: {filename}")
                skipped += 1
                continue

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

            document.title = chapter_title
            document.chapter_id = chapter.id

            mapped += 1

            print(
                f"MAPPED: {filename} -> {chapter_title}"
            )

        db.commit()

        print()
        print("Class 9 Science repair completed.")
        print(f"Documents mapped: {mapped}")
        print(f"Already mapped: {already_mapped}")
        print(f"Skipped: {skipped}")

    except Exception as error:
        db.rollback()
        print("Repair failed:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    repair_class9_science()