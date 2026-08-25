from pathlib import Path

from core.database import SessionLocal
from models.content import SourceDocument, DocumentChunk


BASE_DIR = Path(
    "ncert_materials/class9/science/textbooks"
)

OLD_WRONG_DOCUMENT_ID = 82


def repair_local_files():
    print("Repairing local Class 9 Science files...")

    correct_chapter_2 = BASE_DIR / "iesc102 (1).pdf"
    old_wrong_102 = BASE_DIR / "iesc102.pdf"
    old_103 = BASE_DIR / "iesc103.pdf"

    # -------------------------------------------------
    # 1. Move the old/wrong iesc102 out of the way
    # -------------------------------------------------

    wrong_backup = BASE_DIR / "OLD_WRONG_iesc102.pdf"

    if old_wrong_102.exists():
        if wrong_backup.exists():
            wrong_backup.unlink()

        old_wrong_102.rename(wrong_backup)

        print(
            "Moved old iesc102.pdf -> "
            "OLD_WRONG_iesc102.pdf"
        )

    # -------------------------------------------------
    # 2. Put the correct Chapter 2 at iesc102.pdf
    # -------------------------------------------------

    if correct_chapter_2.exists():
        correct_target = BASE_DIR / "iesc102.pdf"

        if correct_target.exists():
            raise FileExistsError(
                "iesc102.pdf still exists after the "
                "backup step."
            )

        correct_chapter_2.rename(correct_target)

        print(
            "Moved correct iesc102 (1).pdf -> "
            "iesc102.pdf"
        )

    elif not (BASE_DIR / "iesc102.pdf").exists():
        raise FileNotFoundError(
            "Correct Chapter 2 PDF was not found."
        )

    # -------------------------------------------------
    # 3. Temporarily move old Chapter 4
    # -------------------------------------------------

    temp_103 = BASE_DIR / "__shift_iesc103.pdf"

    if old_103.exists():
        if temp_103.exists():
            temp_103.unlink()

        old_103.rename(temp_103)

        print(
            "Moved old iesc103.pdf -> "
            "__shift_iesc103.pdf"
        )

    # -------------------------------------------------
    # 4. Shift temporary files forward
    #
    # __shift_iesc103 -> iesc104
    # __shift_iesc104 -> iesc105
    # ...
    # __shift_iesc112 -> iesc113
    # -------------------------------------------------

    for number in range(112, 102, -1):
        temp_file = (
            BASE_DIR / f"__shift_iesc{number:02d}.pdf"
        )

        final_file = (
            BASE_DIR / f"iesc{number + 1:02d}.pdf"
        )

        if temp_file.exists():
            if final_file.exists():
                raise FileExistsError(
                    f"Cannot rename {temp_file.name}: "
                    f"{final_file.name} already exists."
                )

            temp_file.rename(final_file)

            print(
                f"Moved {temp_file.name} -> "
                f"{final_file.name}"
            )

    print("Local file repair completed.")


def repair_database():
    print()
    print("Repairing PostgreSQL document records...")

    db = SessionLocal()

    try:
        # -------------------------------------------------
        # 1. Delete the old incorrect document 82
        # -------------------------------------------------

        old_document = (
            db.query(SourceDocument)
            .filter(
                SourceDocument.id == OLD_WRONG_DOCUMENT_ID
            )
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
                f"Deleted old document ID "
                f"{OLD_WRONG_DOCUMENT_ID} "
                f"and {deleted_chunks} chunks."
            )

        else:
            print(
                "Old document ID 82 was already deleted."
            )

        # -------------------------------------------------
        # 2. Temporarily rename database titles
        #
        # iesc112 -> __shift_112
        # ...
        # iesc103 -> __shift_103
        # -------------------------------------------------

        for number in range(112, 102, -1):

            old_title = f"iesc{number:02d}.pdf"
            temp_title = (
                f"__shift_iesc{number:02d}.pdf"
            )

            document = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == old_title,
                    SourceDocument.class_level == 9,
                    SourceDocument.source_type == "textbook",
                )
                .first()
            )

            if document:
                document.title = temp_title
                print(
                    f"DB temporary rename: "
                    f"{old_title} -> {temp_title}"
                )

        db.flush()

        # -------------------------------------------------
        # 3. Shift DB titles forward
        #
        # __shift_103 -> iesc104
        # ...
        # __shift_112 -> iesc113
        # -------------------------------------------------

        for number in range(103, 113):

            temp_title = (
                f"__shift_iesc{number:02d}.pdf"
            )

            new_title = f"iesc{number + 1:02d}.pdf"

            document = (
                db.query(SourceDocument)
                .filter(
                    SourceDocument.title == temp_title,
                    SourceDocument.class_level == 9,
                    SourceDocument.source_type == "textbook",
                )
                .first()
            )

            if document:
                document.title = new_title

                print(
                    f"DB final rename: "
                    f"{temp_title} -> {new_title}"
                )

        db.commit()

        print(
            "PostgreSQL document-title repair completed."
        )

    except Exception as error:
        db.rollback()

        print("Database repair failed:")
        print(error)

    finally:
        db.close()


def main():
    print("Class 9 Science repair starting...")
    print()

    repair_local_files()
    repair_database()

    print()
    print(
        "Class 9 Science repair completed successfully."
    )


if __name__ == "__main__":
    main()