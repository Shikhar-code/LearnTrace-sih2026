from core.database import SessionLocal
from models.academic import Subject


SUBJECTS = [
    # Class 9
    (9, "Mathematics"),
    (9, "Science"),

    # Class 10
    (10, "Mathematics"),
    (10, "Science"),

    # Class 11
    (11, "Mathematics"),
    (11, "Physics"),
    (11, "Chemistry"),
    (11, "Biology"),

    # Class 12
    (12, "Mathematics"),
    (12, "Physics"),
    (12, "Chemistry"),
    (12, "Biology"),
]


def seed_subjects():
    db = SessionLocal()

    try:
        added = 0

        for class_level, subject_name in SUBJECTS:
            existing = (
                db.query(Subject)
                .filter(
                    Subject.class_level == class_level,
                    Subject.name == subject_name
                )
                .first()
            )

            if not existing:
                db.add(
                    Subject(
                        class_level=class_level,
                        name=subject_name
                    )
                )
                added += 1

        db.commit()

        print(f"Subjects added: {added}")

    except Exception as error:
        db.rollback()
        print("Error while seeding subjects:")
        print(error)

    finally:
        db.close()


if __name__ == "__main__":
    seed_subjects()