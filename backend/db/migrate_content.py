from sqlalchemy import text

from core.database import engine


def migrate_source_documents():
    statements = [
        """
        ALTER TABLE source_documents
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(50)
        NOT NULL DEFAULT 'textbook'
        """,
        """
        ALTER TABLE source_documents
        ADD COLUMN IF NOT EXISTS language VARCHAR(20)
        NOT NULL DEFAULT 'English'
        """,
    ]

    try:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

        print("source_documents table updated successfully.")

    except Exception as error:
        print("Migration failed:")
        print(error)


if __name__ == "__main__":
    migrate_source_documents()