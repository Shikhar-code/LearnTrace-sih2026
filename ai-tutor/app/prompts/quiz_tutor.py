"""
Prompt templates for AI Tutor Mode 2 (Post-Quiz Analysis).

Generates prompts that instruct the LLM to analyze completed quiz mistakes
and return concise explanations without worked examples, practice questions,
or mastery calculations.
"""

from __future__ import annotations

from app.schemas.quiz_tutor import QuizTutorContext


QUIZ_TUTOR_SYSTEM_PROMPT = """You are an empathetic, concise AI Tutor for LearnTrace.
Your goal is to provide short, clear educational feedback on a student's quiz mistakes.

STRICT CONSTRAINTS:
1. Return ONLY a valid JSON object matching the requested schema.
2. Provide explanations ONLY for questions that the student answered incorrectly.
3. Keep each explanation extremely concise (1 to 3 sentences maximum, between 50 and 300 characters).
4. Explain why the student's answer was incorrect and why the correct answer is right.
5. Do NOT include worked examples, follow-up practice questions, or lengthy lessons.
6. Do NOT calculate mastery probabilities, root causes, or learning paths (the LearnTrace Engine handles this).
7. Do NOT include markdown code fences or conversational greetings outside the JSON.
"""


def build_quiz_tutor_prompt(context: QuizTutorContext) -> str:
    """
    Format a QuizTutorContext payload into a clean user prompt for the LLM.
    Filters to include only incorrect items.
    """
    incorrect_items = [q for q in context.questions if not q.is_correct]

    items_text = []
    for item in incorrect_items:
        items_text.append(
            f"- Question ID: {item.question_id}\n"
            f"  Topic: {item.topic}\n"
            f"  Question: {item.question_text}\n"
            f"  Student's Answer: {item.student_answer}\n"
            f"  Correct Answer: {item.correct_answer}"
        )

    formatted_items = "\n\n".join(items_text)

    return f"""Attempt ID: {context.attempt_id}
Subject: {context.subject}
Class Level: {context.class_level or 'N/A'}
Total Questions in Quiz: {len(context.questions)}
Total Incorrect Answers: {len(incorrect_items)}

The student made mistakes on the following questions:

{formatted_items}

Please generate a QuizTutorResponse JSON with concise explanations for each mistake above.
"""
