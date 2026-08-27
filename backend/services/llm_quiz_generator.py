import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from groq import Groq
from google import genai
from sqlalchemy.orm import Session

from models.academic import Topic
from models.content import DocumentChunk
from models.quiz import (
    Assessment,
    AssessmentQuestion,
    Question,
    QuestionOption,
)


load_dotenv(dotenv_path=".env", override=True)


class QuizGenerationError(Exception):
    """Raised when quiz generation fails."""


def get_required_env(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise QuizGenerationError(
            f"Missing required environment variable: {name}"
        )

    return value


def clean_json_text(text: str) -> str:
    text = text.strip()

    text = re.sub(
        r"^```json\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"^```\s*",
        "",
        text,
    )

    text = re.sub(
        r"\s*```$",
        "",
        text,
    )

    return text.strip()


def parse_quiz_json(text: str) -> dict[str, Any]:
    cleaned = clean_json_text(text)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise QuizGenerationError(
            f"LLM returned invalid JSON: {error}"
        ) from error

    if not isinstance(data, dict):
        raise QuizGenerationError(
            "LLM response must be a JSON object."
        )

    questions = data.get("questions")

    if not isinstance(questions, list):
        raise QuizGenerationError(
            "LLM response must contain a 'questions' array."
        )

    return data


def validate_questions(
    data: dict[str, Any],
    expected_count: int,
) -> list[dict[str, Any]]:
    questions = data["questions"]

    if not questions or len(questions) < expected_count:
        raise QuizGenerationError(
            f"Expected {expected_count} questions, "
            f"but received only {len(questions)}."
        )

    # Take the exact expected number of questions
    questions = questions[:expected_count]

    validated = []

    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            raise QuizGenerationError(
                f"Question {index} is not an object."
            )

        question_text = str(
            question.get("question_text", "")
        ).strip()

        explanation = str(
            question.get("explanation", "")
        ).strip()

        difficulty = str(
            question.get("difficulty", "")
        ).strip().lower()

        options = question.get("options")

        if not question_text:
            raise QuizGenerationError(
                f"Question {index} has no question_text."
            )

        if not explanation:
            raise QuizGenerationError(
                f"Question {index} has no explanation."
            )

        if difficulty not in {
            "easy",
            "medium",
            "hard",
        }:
            raise QuizGenerationError(
                f"Question {index} has invalid difficulty."
            )

        if not isinstance(options, list) or len(options) != 4:
            raise QuizGenerationError(
                f"Question {index} must have exactly 4 options."
            )

        correct_count = 0
        cleaned_options = []

        for option_index, option in enumerate(
            options,
            start=1,
        ):
            if not isinstance(option, dict):
                raise QuizGenerationError(
                    f"Question {index}, option {option_index} "
                    "is invalid."
                )

            option_text = str(
                option.get("option_text", "")
            ).strip()

            is_correct = option.get("is_correct")

            if not option_text:
                raise QuizGenerationError(
                    f"Question {index}, option "
                    f"{option_index} is empty."
                )

            if not isinstance(is_correct, bool):
                raise QuizGenerationError(
                    f"Question {index}, option "
                    f"{option_index} has invalid is_correct."
                )

            if is_correct:
                correct_count += 1

            cleaned_options.append(
                {
                    "option_text": option_text,
                    "is_correct": is_correct,
                }
            )

        if correct_count != 1:
            raise QuizGenerationError(
                f"Question {index} must have exactly "
                "one correct option."
            )

        validated.append(
            {
                "question_text": question_text,
                "difficulty": difficulty,
                "explanation": explanation,
                "options": cleaned_options,
            }
        )

    return validated


def build_prompt(
    topic: Topic,
    chunks: list[DocumentChunk],
    number_of_questions: int,
    requested_difficulty: str,
) -> str:
    context_parts = []

    for chunk in chunks:
        context_parts.append(
            f"[Page {chunk.page_number or 'N/A'}]\n"
            f"{chunk.content}"
        )

    context = "\n\n".join(context_parts)

    return f"""
You are generating school-level multiple-choice questions
for the LearnTrace learning platform.

IMPORTANT:
Use ONLY the supplied NCERT source context.
Do not use outside facts.
Do not invent information that is not supported by the context.

Academic topic:
{topic.title}

Requested difficulty:
{requested_difficulty}

Number of questions:
{number_of_questions}

CRITICAL: You MUST generate EXACTLY {number_of_questions} distinct multiple-choice question objects in the "questions" array.

Each MCQ must contain exactly:
- question_text
- difficulty
- explanation
- options

Each question must have exactly 4 options.

Exactly ONE option must have:
"is_correct": true

The other THREE options must have:
"is_correct": false

Return ONLY valid JSON matching the exact schema below.
Do NOT use markdown fences or extra commentary.

Required JSON structure:

{{
  "questions": [
    {{
      "question_text": "string",
      "difficulty": "easy",
      "explanation": "string",
      "options": [
        {{
          "option_text": "string",
          "is_correct": true
        }},
        {{
          "option_text": "string",
          "is_correct": false
        }},
        {{
          "option_text": "string",
          "is_correct": false
        }},
        {{
          "option_text": "string",
          "is_correct": false
        }}
      ]
    }}
  ]
}}

NCERT SOURCE CONTEXT:

{context}
""".strip()


def generate_with_gemini(prompt: str) -> dict[str, Any]:
    api_key = get_required_env("GEMINI_API_KEY")
    model = get_required_env("GEMINI_MODEL")

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "temperature": 0.2,
            "response_mime_type": "application/json",
            "max_output_tokens": 4096,
        },
    )

    if not response.text:
        raise QuizGenerationError(
            "Gemini returned an empty response."
        )

    return parse_quiz_json(response.text)


def generate_with_groq(prompt: str) -> dict[str, Any]:
    api_key = get_required_env("GROQ_API_KEY")
    model = get_required_env("GROQ_MODEL")

    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a school educational assistant. "
                    "Return only valid JSON."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
        response_format={
            "type": "json_object"
        },
        max_tokens=4096,
    )

    content = response.choices[0].message.content

    if not content:
        raise QuizGenerationError(
            "Groq returned an empty response."
        )

    return parse_quiz_json(content)


def generate_quiz_data(
    topic: Topic,
    chunks: list[DocumentChunk],
    number_of_questions: int,
    requested_difficulty: str,
) -> list[dict[str, Any]]:
    prompt = build_prompt(
        topic=topic,
        chunks=chunks,
        number_of_questions=number_of_questions,
        requested_difficulty=requested_difficulty,
    )

    try:
        gemini_data = generate_with_gemini(prompt)

        return validate_questions(
            gemini_data,
            number_of_questions,
        )

    except Exception as gemini_error:
        print(
            "Gemini generation failed. "
            f"Falling back to Groq: {gemini_error}"
        )

    try:
        groq_data = generate_with_groq(prompt)

        return validate_questions(
            groq_data,
            number_of_questions,
        )

    except Exception as groq_error:
        raise QuizGenerationError(
            "Both Gemini and Groq failed to generate "
            f"a valid quiz. Groq error: {groq_error}"
        ) from groq_error


def create_assessment_with_questions(
    db: Session,
    topic: Topic,
    questions_data: list[dict[str, Any]],
    source_document_id: int | None,
    duration_minutes: int | None = 10,
) -> Assessment:

    assessment = Assessment(
        title=f"{topic.title} - AI Generated Quiz",
        description="NCERT-grounded AI-generated assessment.",
        class_level=topic.chapter.subject.class_level,
        subject_id=topic.chapter.subject_id,
        duration_minutes=duration_minutes,
    )

    db.add(assessment)
    db.flush()

    for order, question_data in enumerate(
        questions_data,
        start=1,
    ):
        question = Question(
            question_text=question_data["question_text"],
            question_type="mcq",
            difficulty=question_data["difficulty"],
            topic_id=topic.id,
            explanation=question_data["explanation"],
            source_document_id=source_document_id,
        )

        db.add(question)
        db.flush()

        for option_data in question_data["options"]:
            db.add(
                QuestionOption(
                    question_id=question.id,
                    option_text=option_data["option_text"],
                    is_correct=option_data["is_correct"],
                )
            )

        db.add(
            AssessmentQuestion(
                assessment_id=assessment.id,
                question_id=question.id,
                question_order=order,
            )
        )

    db.commit()
    db.refresh(assessment)

    return assessment


def generate_and_save_quiz(
    db: Session,
    topic_id: int,
    number_of_questions: int = 5,
    difficulty: str = "medium",
    duration_minutes: int = 10,
) -> Assessment:

    if not 1 <= number_of_questions <= 20:
        raise QuizGenerationError(
            "number_of_questions must be between 1 and 20."
        )

    difficulty = difficulty.lower()

    if difficulty not in {
        "easy",
        "medium",
        "hard",
    }:
        raise QuizGenerationError(
            "difficulty must be easy, medium, or hard."
        )

    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id)
        .first()
    )

    if not topic:
        raise QuizGenerationError(
            "Topic not found."
        )

    chunks = (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.topic_id == topic_id
        )
        .order_by(
            DocumentChunk.document_id,
            DocumentChunk.chunk_index,
        )
        .limit(6)
        .all()
    )

    if not chunks:
        raise QuizGenerationError(
            "No NCERT document chunks are mapped "
            "to this topic."
        )

    questions_data = generate_quiz_data(
        topic=topic,
        chunks=chunks,
        number_of_questions=number_of_questions,
        requested_difficulty=difficulty,
    )

    source_document_id = chunks[0].document_id

    return create_assessment_with_questions(
        db=db,
        topic=topic,
        questions_data=questions_data,
        source_document_id=source_document_id,
        duration_minutes=duration_minutes,
    )
