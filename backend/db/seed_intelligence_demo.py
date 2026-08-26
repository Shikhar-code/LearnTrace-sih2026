"""Seed a small, repeatable dataset for live intelligence-engine demos."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from core.database import Base, SessionLocal, engine
from models import (
    AcademicClass,
    Assessment,
    AssessmentAttempt,
    AssessmentQuestion,
    Chapter,
    Question,
    QuestionOption,
    Response,
    Subject,
    Topic,
    User,
)


QUESTION_SPECS = (
    ("Triangles", "Which condition proves two triangles similar?", "medium"),
    ("Triangles", "What is the angle sum of a triangle?", "easy"),
    ("Triangles", "Which theorem relates sides in similar triangles?", "hard"),
    ("Introduction to Trigonometry", "What is sin(theta) in a right triangle?", "easy"),
    ("Introduction to Trigonometry", "What is tan(theta)?", "medium"),
    ("Introduction to Trigonometry", "Which identity equals 1?", "hard"),
    ("Some Applications of Trigonometry", "Which ratio helps find a tower height?", "easy"),
    ("Some Applications of Trigonometry", "What is an angle of elevation?", "medium"),
    ("Some Applications of Trigonometry", "Which measurements solve a height-distance problem?", "hard"),
)

LEARNERS = (
    (
        "Asha Demo",
        "learntrace.demo.asha@example.invalid",
        (True, False, False, False, False, False, False, False, False),
    ),
    (
        "Ravi Demo",
        "learntrace.demo.ravi@example.invalid",
        (True, True, False, True, False, False, False, False, False),
    ),
    (
        "Meera Demo",
        "learntrace.demo.meera@example.invalid",
        (True, True, True, True, True, True, True, True, False),
    ),
)

ASHA_REASSESSMENT = (True, True, True, True, True, False, True, False, False)


def _one_or_create(db, model, **values):
    row = db.query(model).filter_by(**values).first()
    if row is None:
        row = model(**values)
        db.add(row)
        db.flush()
    return row


def _assessment(db, subject: Subject, title: str, questions: list[Question]):
    assessment = db.query(Assessment).filter_by(title=title, subject_id=subject.id).first()
    if assessment is None:
        assessment = Assessment(
            title=title,
            description="Repeatable data for the LearnTrace intelligence demo.",
            class_level=10,
            subject_id=subject.id,
            duration_minutes=20,
        )
        db.add(assessment)
        db.flush()
    for order, question in enumerate(questions, 1):
        if not db.query(AssessmentQuestion).filter_by(
            assessment_id=assessment.id,
            question_id=question.id,
        ).first():
            db.add(
                AssessmentQuestion(
                    assessment_id=assessment.id,
                    question_id=question.id,
                    question_order=order,
                )
            )
    db.flush()
    return assessment


def _attempt(
    db,
    user: User,
    assessment: Assessment,
    questions: list[Question],
    correctness: tuple[bool, ...],
):
    attempt = db.query(AssessmentAttempt).filter_by(
        user_id=user.id,
        assessment_id=assessment.id,
    ).first()
    if attempt is None:
        attempt = AssessmentAttempt(user_id=user.id, assessment_id=assessment.id)
        db.add(attempt)
        db.flush()

    for index, (question, is_correct) in enumerate(zip(questions, correctness), 1):
        options = (
            db.query(QuestionOption)
            .filter_by(question_id=question.id)
            .order_by(QuestionOption.id)
            .all()
        )
        selected = next(
            option for option in options if option.is_correct is is_correct
        )
        response = db.query(Response).filter_by(
            attempt_id=attempt.id,
            question_id=question.id,
        ).first()
        if response is None:
            response = Response(attempt_id=attempt.id, question_id=question.id)
            db.add(response)
        response.selected_option_id = selected.id
        response.is_correct = is_correct
        response.response_time_seconds = 25 + index * 4

    attempt.completed = True
    attempt.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
    attempt.score = round(sum(correctness) / len(correctness) * 100)
    db.flush()
    return attempt


def seed_intelligence_demo() -> dict:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _one_or_create(db, AcademicClass, class_level=10)
        subject = _one_or_create(db, Subject, name="Mathematics", class_level=10)

        topics: dict[str, Topic] = {}
        for title in dict.fromkeys(spec[0] for spec in QUESTION_SPECS):
            chapter = db.query(Chapter).filter_by(
                title=title,
                subject_id=subject.id,
            ).first()
            if chapter is None:
                chapter = Chapter(title=title, subject_id=subject.id)
                db.add(chapter)
                db.flush()
            topic = db.query(Topic).filter_by(title=title, chapter_id=chapter.id).first()
            if topic is None:
                topic = Topic(title=title, chapter_id=chapter.id)
                db.add(topic)
                db.flush()
            topics[title] = topic

        questions: list[Question] = []
        for chapter_title, prompt, difficulty in QUESTION_SPECS:
            topic = topics[chapter_title]
            question = db.query(Question).filter_by(
                question_text=prompt,
                topic_id=topic.id,
            ).first()
            if question is None:
                question = Question(
                    question_text=prompt,
                    question_type="mcq",
                    difficulty=difficulty,
                    topic_id=topic.id,
                    explanation="Demo question for intelligence-engine validation.",
                )
                db.add(question)
                db.flush()
            if not question.options:
                db.add_all(
                    (
                        QuestionOption(
                            question_id=question.id,
                            option_text="Correct demo option",
                            is_correct=True,
                        ),
                        QuestionOption(
                            question_id=question.id,
                            option_text="Incorrect demo option",
                            is_correct=False,
                        ),
                    )
                )
                db.flush()
            questions.append(question)

        diagnostic = _assessment(
            db,
            subject,
            "LearnTrace Intelligence Demo - Diagnostic",
            questions,
        )
        reassessment = _assessment(
            db,
            subject,
            "LearnTrace Intelligence Demo - Reassessment",
            questions,
        )

        attempts: dict[str, int] = {}
        users: dict[str, User] = {}
        for name, email, correctness in LEARNERS:
            user = db.query(User).filter_by(email=email).first()
            if user is None:
                user = User(name=name, email=email, class_level=10)
                db.add(user)
                db.flush()
            users[email] = user
            attempts[email] = _attempt(
                db,
                user,
                diagnostic,
                questions,
                correctness,
            ).id

        asha_reassessment = _attempt(
            db,
            users[LEARNERS[0][1]],
            reassessment,
            questions,
            ASHA_REASSESSMENT,
        )
        db.commit()
        return {
            "diagnostic_attempt_ids": attempts,
            "asha_reassessment_attempt_id": asha_reassessment.id,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print(json.dumps(seed_intelligence_demo(), indent=2, sort_keys=True))
