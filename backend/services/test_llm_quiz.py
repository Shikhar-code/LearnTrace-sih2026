import json
import os

from dotenv import load_dotenv
from google import genai
from groq import Groq
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.academic import Topic
from models.content import DocumentChunk


load_dotenv(dotenv_path=".env", override=True)


def build_prompt(topic, chunks):
    context = "\n\n".join(
        f"[Page {chunk.page_number or 'N/A'}]\n{chunk.content}"
        for chunk in chunks
    )

    return f"""
You are an educational quiz generator for the LearnTrace platform.

Generate exactly 3 multiple-choice questions for this topic:

Topic: {topic.title}

IMPORTANT RULES:
- Use ONLY the supplied NCERT context.
- Do not use outside knowledge.
- Each question must have exactly 4 options.
- Exactly ONE option must be correct.
- Include a brief explanation.
- Questions should be appropriate for school students.
- Return ONLY valid JSON.
- Do not use markdown.

Return exactly this structure:

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

NCERT CONTEXT:

{context}
""".strip()


def generate_with_gemini(prompt):
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    if not model:
        raise RuntimeError("GEMINI_MODEL is missing.")

    print(f"Trying Gemini: {model}")

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    return json.loads(response.text)


def generate_with_groq(prompt):
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing.")

    if not model:
        raise RuntimeError("GROQ_MODEL is missing.")

    print(f"Trying Groq fallback: {model}")

    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an educational quiz generator. "
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
    )

    text = response.choices[0].message.content

    if not text:
        raise RuntimeError("Groq returned an empty response.")

    return json.loads(text)


def main():
    db: Session = SessionLocal()

    try:
        topic_id = 1

        topic = (
            db.query(Topic)
            .filter(Topic.id == topic_id)
            .first()
        )

        if not topic:
            print(f"Topic {topic_id} was not found.")
            return

        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.topic_id == topic_id)
            .order_by(
                DocumentChunk.document_id,
                DocumentChunk.chunk_index,
            )
            .limit(10)
            .all()
        )

        if not chunks:
            print(
                f"No NCERT chunks are mapped to topic {topic_id}."
            )
            return

        print()
        print(f"Topic: {topic.title}")
        print(f"NCERT chunks found: {len(chunks)}")
        print()

        prompt = build_prompt(topic, chunks)

        try:
            result = generate_with_gemini(prompt)

            print()
            print("Gemini succeeded.")
            print()
            print(
                json.dumps(
                    result,
                    indent=2,
                    ensure_ascii=False,
                )
            )

            return

        except Exception as gemini_error:
            print()
            print(
                "Gemini failed. Using Groq fallback."
            )
            print(
                f"Reason: {gemini_error}"
            )
            print()

        try:
            result = generate_with_groq(prompt)

            print()
            print("Groq fallback succeeded.")
            print()
            print(
                json.dumps(
                    result,
                    indent=2,
                    ensure_ascii=False,
                )
            )

        except Exception as groq_error:
            print()
            print("Both Gemini and Groq failed.")
            print(f"Groq error: {groq_error}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
