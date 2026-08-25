from core.database import SessionLocal
from models.academic import Subject, Chapter
from models.content import SourceDocument


CHAPTERS = {
    "jesc101.pdf": "Chemical Reactions and Equations",
    "jesc102.pdf": "Acids, Bases and Salts",
    "jesc103.pdf": "Metals and Non-metals",
    "jesc104.pdf": "Carbon and its Compounds",
    "jesc105.pdf": "Life Processes",
    "jesc106.pdf": "Control and Coordination",
    "jesc107.pdf": "How do Organisms Reproduce?",
    "jesc108.pdf": "Heredity",
    "jesc109.pdf": "Light – Reflection and Refraction",
    "jesc110.pdf": "The Human Eye and the Colourful World",
    "jesc111.pdf": "Electricity",
    "jesc112.pdf": "Magnetic Effects of Electric Current",
    "jesc113.pdf": "Our Environment",
}


def repair_class10_science():
    db = SessionLocal()

    try:
        subject = (
            db.query(Subject)
            .filter(
                Subject.class_level == 10,
                Subject.name == "Science",
            )
            .first()
        )

        if not subject:
            print("Class 10 Science subject was not found.")
            return

        mapped = 0
        already_mapped = 0
        skipped = 0

        for filename, chapter_title in CHAPTERS.items():

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
        print("Class 10 Science repair completed.")
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
    repair_class10_science()