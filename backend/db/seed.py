from core.database import SessionLocal
from models.academic import AcademicClass, Subject


def seed_database():
    db = SessionLocal()

    try:
        # -----------------------------
        # 1. Create Classes 9 to 12
        # -----------------------------

        class_levels = [9, 10, 11, 12]

        for level in class_levels:
            existing_class = (
                db.query(AcademicClass)
                .filter(AcademicClass.class_level == level)
                .first()
            )

            if not existing_class:
                db.add(
                    AcademicClass(
                        class_level=level
                    )
                )

        db.commit()

        # -----------------------------
        # 2. Create Subjects
        # -----------------------------

        subjects_to_create = [
            (9, "Mathematics"),
            (9, "Science"),

            (10, "Mathematics"),
            (10, "Science"),

            (11, "Mathematics"),
            (11, "Science"),

            (12, "Mathematics"),
            (12, "Science"),
        ]

        for class_level, subject_name in subjects_to_create:

            existing_subject = (
                db.query(Subject)
                .filter(
                    Subject.class_level == class_level,
                    Subject.name == subject_name
                )
                .first()
            )

            if not existing_subject:
                db.add(
                    Subject(
                        name=subject_name,
                        class_level=class_level
                    )
                )

        db.commit()

        print("Database seeding completed successfully.")

    except Exception as error:
        db.rollback()
        print("Error while seeding database:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()