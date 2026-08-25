from core.database import SessionLocal
from models.academic import Subject, Chapter
from models.content import SourceDocument


# Official NCERT Class 10 Mathematics chapter mapping
# for the current textbook structure.
CHAPTERS = {
    "jemh101.pdf": "Real Numbers",
    "jemh102.pdf": "Polynomials",
    "jemh103.pdf": "Pair of Linear Equations in Two Variables",
    "jemh104.pdf": "Quadratic Equations",
    "jemh105.pdf": "Arithmetic Progressions",
    "jemh106.pdf": "Triangles",
    "jemh107.pdf": "Coordinate Geometry",
    "jemh108.pdf": "Introduction to Trigonometry",
    "jemh109.pdf": "Some Applications of Trigonometry",
    "jemh110.pdf": "Circles",
    "jemh111.pdf": "Areas Related to Circles",
    "jemh112.pdf": "Surface Areas and Volumes",
    "jemh113.pdf": "Statistics",
    "jemh114.pdf": "Probability",
    "jemh1a1.pdf": "Appendix A1: Proofs in Mathematics",
    "jemh1a2.pdf": "Appendix A2: Mathematical Modelling",
}


def repair_class10_math():
    db = SessionLocal()

    try:
        # Find Class 10 Mathematics.
        subject = (
            db.query(Subject)
            .filter(
                Subject.class_level == 10,
                Subject.name == "Mathematics",
            )
            .first()
        )

        if not subject:
            print("Class 10 Mathematics subject was not found.")
            return

        repaired = 0
        already_mapped = 0
        skipped = 0

        for filename, chapter_title in CHAPTERS.items():

            # Find the existing document.
            document = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == filename,
                    SourceDocument.class_level == 10,
                    SourceDocument.subject_id == subject.id,
                )
                .first()
            )

            if not document:
                print(f"DOCUMENT NOT FOUND: {filename}")
                skipped += 1
                continue

            # Find or create the correct chapter.
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

            # Attach document to chapter.
            if document.chapter_id == chapter.id:
                already_mapped += 1
                print(
                    f"ALREADY MAPPED: "
                    f"{filename} -> {chapter_title}"
                )
            else:
                document.chapter_id = chapter.id
                repaired += 1

                print(
                    f"MAPPED: "
                    f"{filename} -> {chapter_title}"
                )

        db.commit()

        print()
        print("Class 10 Mathematics repair completed.")
        print(f"Documents newly mapped: {repaired}")
        print(f"Documents already mapped: {already_mapped}")
        print(f"Documents skipped: {skipped}")

    except Exception as error:
        db.rollback()
        print("Repair failed:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    repair_class10_math()