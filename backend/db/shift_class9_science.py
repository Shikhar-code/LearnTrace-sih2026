from pathlib import Path

from core.database import SessionLocal
from models.content import SourceDocument, DocumentChunk


BASE_DIR = Path(
    "ncert_materials/class9/science/textbooks"
)

# Old database document for the incorrect iesc102.
OLD_WRONG_DOCUMENT_ID = 82


def shift_local_files():
    """
    Safely shift:

    iesc102 -> iesc103
    iesc103 -> iesc104
    ...
    iesc112 -> iesc113

    and place the correct downloaded Chapter 2 PDF
    at iesc102.pdf.
    """

    print("Starting local file renaming...")

    correct_chapter_2 = BASE_DIR / "iesc102 (1).pdf"

    old_102 = BASE_DIR / "iesc102.pdf"

    # Make sure the correct Chapter 2 file exists.
    if not correct_chapter_2.exists():
        raise FileNotFoundError(
            "Correct 'iesc102 (1).pdf' was not found."
        )

    # First move 102-112 to temporary names.
    for number in range(112, 101, -1):
        old_file = BASE_DIR / f"iesc{number:02d}.pdf"
        temp_file = BASE_DIR / f"__shift_iesc{number:02d}.pdf"

        if old_file.exists():
            old_file.rename(temp_file)

    # Put the correct Chapter 2 file in place.
    correct_chapter_2.rename(BASE_DIR / "iesc102.pdf")

    # Move temporary files forward by one chapter number.
    for number in range(102, 113):
        temp_file = BASE_DIR / f"__shift_iesc{number:02d}.pdf"
        new_file = BASE_DIR / f"iesc{number + 1:02d}.pdf"

        if temp_file.exists():
            temp_file.rename(new_file)

    print("Local file renaming completed.")


def update_database():
    """
    Remove the old incorrect Chapter 3 document that was
    incorrectly stored as iesc102.

    Then shift the titles of existing documents:
    iesc103 -> iesc104
    ...
    iesc112 -> iesc113

    Their document IDs and chunks remain intact.
    """

    db = SessionLocal()

    try:
        print("Updating PostgreSQL records...")

        # -----------------------------------------
        # 1. Remove the old incorrect iesc102
        # -----------------------------------------

        old_document = (
            db.query(SourceDocument)
            .filter(SourceDocument.id == OLD_WRONG_DOCUMENT_ID)
            .first()
        )

        if old_document:
            deleted_chunks = (
                db.query(DocumentChunk)
                .filter(
                    DocumentChunk.document_id
                    == old_document.id
                )
                .delete(
                    synchronize_session=False
                )
            )

            db.delete(old_document)

            print(
                f"Removed old iesc102 document "
                f"and {deleted_chunks} chunks."
            )

        else:
            print(
                "Old document ID 82 was already removed."
            )

        # -----------------------------------------
        # 2. Temporarily rename DB titles
        # -----------------------------------------

        for number in range(112, 102, -1):
            old_title = f"iesc{number:02d}.pdf"

            document = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == old_title,
                    SourceDocument.class_level == 9,
                    SourceDocument.subject_id == 2,
                    SourceDocument.source_type == "textbook",
                )
                .first()
            )

            if document:
                document.title = (
                    f"__shift_iesc{number:02d}.pdf"
                )

        db.flush()

        # -----------------------------------------
        # 3. Rename temporary DB titles
        # -----------------------------------------

        for number in range(103, 113):
            old_temp_title = (
                f"__shift_iesc{number - 1:02d}.pdf"
            )

            new_title = f"iesc{number:02d}.pdf"

            document = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == old_temp_title,
                    SourceDocument.class_level == 9,
                    SourceDocument.subject_id == 2,
                    SourceDocument.source_type == "textbook",
                )
                .first()
            )

            if document:
                document.title = new_title

        db.commit()

        print(
            "PostgreSQL title shifting completed."
        )

    except Exception as error:
        db.rollback()

        print("Database update failed:")
        print(error)

    finally:
        db.close()


def main():
    print("Class 9 Science shift starting...")
    print()

    shift_local_files()
    update_database()

    print()
    print(
        "Class 9 Science shift completed successfully."
    )
    print(
        "Next step: run the bulk ingestion command."
    )


if __name__ == "__main__":
    main()