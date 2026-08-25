from core.database import SessionLocal
from models.academic import Subject, Chapter
from models.content import SourceDocument


CHAPTERS = {
    "iemh101.pdf": "Orienting Yourself: The Use of Coordinates",
    "iemh102.pdf": "Introduction to Linear Polynomials",
    "iemh103.pdf": "The World of Numbers",
    "iemh104.pdf": "Exploring Algebraic Identities",
    "iemh105.pdf": "I’m Up and Down, and Round and Round",
    "iemh106.pdf": "Measuring Space: Perimeter and Area",
    "iemh107.pdf": "The Mathematics of Maybe: Introduction to Probability",
    "iemh108.pdf": "Predicting What Comes Next: Exploring Sequences and Progressions",
}


def repair_class9_math():
    db = SessionLocal()

    try:
        subject = (
            db.query(Subject)
            .filter(
                Subject.class_level == 9,
                Subject.name == "Mathematics",
            )
            .first()
        )

        if not subject:
            print("Class 9 Mathematics subject was not found.")
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

            if document.chapter_id == chapter.id:
                already_mapped += 1

                print(
                    f"ALREADY MAPPED: "
                    f"{filename} -> {chapter_title}"
                )
            else:
                document.chapter_id = chapter.id
                mapped += 1

                print(
                    f"MAPPED: "
                    f"{filename} -> {chapter_title}"
                )

        db.commit()

        print()
        print("Class 9 Mathematics repair completed.")
        print(f"Documents newly mapped: {mapped}")
        print(f"Documents already mapped: {already_mapped}")
        print(f"Documents skipped: {skipped}")

    except Exception as error:
        db.rollback()

        print("Repair failed:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    repair_class9_math()