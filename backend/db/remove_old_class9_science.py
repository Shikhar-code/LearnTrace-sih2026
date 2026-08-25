from core.database import SessionLocal
from models.content import SourceDocument, DocumentChunk


def remove_old_document():
    db = SessionLocal()

    try:
        documents = (
            db.query(SourceDocument)
            .filter(
                SourceDocument.title == "OLD_WRONG_iesc102.pdf",
                SourceDocument.class_level == 9,
                SourceDocument.source_type == "textbook",
            )
            .all()
        )

        if not documents:
            print(
                "OLD_WRONG_iesc102.pdf was not found in the database."
            )
            return

        for document in documents:
            deleted_chunks = (
                db.query(DocumentChunk)
                .filter(
                    DocumentChunk.document_id == document.id
                )
                .delete(
                    synchronize_session=False
                )
            )

            db.delete(document)

            print(
                f"Removed document ID {document.id} "
                f"and {deleted_chunks} chunks."
            )

        db.commit()

        print("Old wrong document removed successfully.")

    except Exception as error:
        db.rollback()
        print("Cleanup failed:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    remove_old_document()