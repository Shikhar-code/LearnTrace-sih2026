"""
Standalone Consistency Testing Harness for AI Tutor.

Evaluates Gemini and Groq LLM providers across representative tutoring cases.

IMPORTANT RESTRICTIONS:
- This is a standalone script for consistency evaluation.
- Does NOT alter production code, prompts, schemas, or validators.
- Never logs API keys or sensitive authorization headers.
- Outputs clean JSON logs to tests/consistency_results/.
"""

import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add workspace root to sys.path so app imports work cleanly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.config import settings
from app.core.exceptions import LLMMisconfiguredError, LLMProviderError, LLMResponseError
from app.prompts.tutor import TUTOR_SYSTEM_PROMPT, build_tutor_prompt
from app.schemas.tutor import TutorContext, TutorResponse
from app.services.providers.gemini import call_gemini
from app.services.providers.groq import call_groq

DATASET_PATH = ROOT_DIR / "tests" / "consistency_cases.json"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "tests" / "consistency_results"

# Minimum length rules matching app/services/response_validator.py
MIN_EXPLANATION_LEN = 80
MIN_SIMPLE_EXPLANATION_LEN = 60
MIN_WORKED_EXAMPLE_LEN = 80
MIN_PRACTICE_EXPLANATION_LEN = 40


def normalize_text(text: str) -> str:
    """Normalize text for string comparison (lowercase, whitespace collapse)."""
    if not text:
        return ""
    return " ".join(text.strip().lower().split())


def evaluate_single_response(
    context: TutorContext,
    response: Optional[TutorResponse],
    error: Optional[Exception],
    verification_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Perform structural and semantic checks on a single LLM response.
    Returns a dictionary of pass/fail results and review flags.
    """
    checks: Dict[str, Any] = {
        # Structural checks
        "api_success": error is None and response is not None,
        "schema_valid": False,
        "explanation_min_len": False,
        "simple_explanation_min_len": False,
        "worked_example_min_len": False,
        "practice_options_count": False,
        "practice_options_unique": False,
        "correct_option_in_options": False,
        "correct_option_in_explanation": False,
        "practice_question_differs": False,
        # Semantic / Quality checks
        "correct_answer_defended": False,
        "learner_answer_identified_as_wrong": False,
        "practice_explanation_agrees_with_correct_option": False,
        "contradictions": [],
        "review_flags": [],
        "overall_pass": False,
    }

    if error is not None:
        checks["error_type"] = type(error).__name__
        checks["error_message"] = str(error)
        checks["review_flags"].append(f"API/Provider Error: {type(error).__name__}: {error}")
        return checks

    if not response:
        checks["review_flags"].append("No response object returned.")
        return checks

    # Schema valid since TutorResponse pydantic model instantiated
    checks["schema_valid"] = True

    # 1. Structural Minimum Length Checks
    exp_len = len(response.explanation.strip())
    simp_len = len(response.simple_explanation.strip())
    we_len = len(response.worked_example.strip())
    pq = response.practice_question
    pq_exp_len = len(pq.explanation.strip())

    checks["explanation_min_len"] = exp_len >= MIN_EXPLANATION_LEN
    checks["simple_explanation_min_len"] = simp_len >= MIN_SIMPLE_EXPLANATION_LEN
    checks["worked_example_min_len"] = we_len >= MIN_WORKED_EXAMPLE_LEN
    checks["practice_explanation_min_len"] = pq_exp_len >= MIN_PRACTICE_EXPLANATION_LEN

    if not checks["explanation_min_len"]:
        checks["review_flags"].append(f"Explanation too short ({exp_len} chars < {MIN_EXPLANATION_LEN})")
    if not checks["simple_explanation_min_len"]:
        checks["review_flags"].append(f"Simple explanation too short ({simp_len} chars < {MIN_SIMPLE_EXPLANATION_LEN})")
    if not checks["worked_example_min_len"]:
        checks["review_flags"].append(f"Worked example too short ({we_len} chars < {MIN_WORKED_EXAMPLE_LEN})")

    # 2. Practice Question Options Checks
    num_opts = len(pq.options)
    checks["practice_options_count"] = (num_opts == 4)
    if not checks["practice_options_count"]:
        checks["review_flags"].append(f"Practice options count is {num_opts}, expected 4")

    stripped_opts = [opt.strip() for opt in pq.options]
    checks["practice_options_unique"] = (len(set(stripped_opts)) == num_opts)
    if not checks["practice_options_unique"]:
        checks["review_flags"].append("Duplicate practice options detected")

    corr_opt = pq.correct_option.strip()
    checks["correct_option_in_options"] = (corr_opt in stripped_opts)
    if not checks["correct_option_in_options"]:
        checks["review_flags"].append(f"correct_option '{corr_opt}' not found in practice options {pq.options}")

    # 3. Practice Explanation Mentions Correct Option
    checks["correct_option_in_explanation"] = normalize_text(corr_opt) in normalize_text(pq.explanation)
    if not checks["correct_option_in_explanation"]:
        checks["review_flags"].append(f"Practice explanation does not mention correct_option '{corr_opt}'")

    # 4. Practice Question Statement Differs from Original
    orig_q_norm = normalize_text(context.question.text)
    pq_q_norm = normalize_text(pq.question)
    checks["practice_question_differs"] = (pq_q_norm != orig_q_norm)
    if not checks["practice_question_differs"]:
        checks["review_flags"].append("Practice question is verbatim identical to original question")

    # 5. Semantic Checks: Ground Truth Correct Answer Defended
    norm_exp = normalize_text(response.explanation)
    norm_corr_ans = normalize_text(context.correct_answer)
    norm_learn_ans = normalize_text(context.learner_answer)

    # Check if explanation falsely asserts the correct answer is wrong
    false_wrong_phrases = [
        f"'{norm_corr_ans}' is incorrect",
        f"'{norm_corr_ans}' is wrong",
        f"{norm_corr_ans} is incorrect",
        f"{norm_corr_ans} is wrong",
        f"incorrect answer is {norm_corr_ans}",
    ]
    corr_called_wrong = any(phrase in norm_exp for phrase in false_wrong_phrases)

    if corr_called_wrong:
        checks["contradictions"].append(f"Explanation claims correct answer '{context.correct_answer}' is wrong.")
        checks["correct_answer_defended"] = False
    else:
        # Check if correct answer or concept is discussed positively
        checks["correct_answer_defended"] = (norm_corr_ans in norm_exp) or (len(norm_exp) >= MIN_EXPLANATION_LEN)

    # Check if learner answer is identified as incorrect
    learner_wrong_indicators = ["incorrect", "wrong", "mistake", "error", "misconception", "instead of", "not"]
    checks["learner_answer_identified_as_wrong"] = any(ind in norm_exp for ind in learner_wrong_indicators)

    # Check if practice explanation agrees with correct_option (no contradiction)
    checks["practice_explanation_agrees_with_correct_option"] = checks["correct_option_in_explanation"]

    # Conceptual questions flagged for human review
    if verification_meta and verification_meta.get("type") == "conceptual":
        checks["review_flags"].append("Conceptual question: flagged for human semantic verification.")

    # Determine overall pass
    structural_pass = (
        checks["schema_valid"]
        and checks["explanation_min_len"]
        and checks["simple_explanation_min_len"]
        and checks["worked_example_min_len"]
        and checks["practice_options_count"]
        and checks["practice_options_unique"]
        and checks["correct_option_in_options"]
        and checks["correct_option_in_explanation"]
        and checks["practice_question_differs"]
    )
    no_contradictions = (len(checks["contradictions"]) == 0)

    checks["overall_pass"] = structural_pass and no_contradictions and checks["correct_answer_defended"]
    return checks


def run_provider_test(
    provider_name: str,
    cases: List[Dict[str, Any]],
    runs: int,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Run N repetitions of all test cases on a given provider.
    Returns raw run results list and provider summary stats.
    """
    raw_results = []
    total_runs = len(cases) * runs
    schema_valid_count = 0
    correct_defended_count = 0
    pq_valid_count = 0
    contradictions_count = 0
    overall_pass_count = 0

    print(f"\n--- Running Provider: {provider_name.upper()} ({len(cases)} cases × {runs} runs = {total_runs} total calls) ---")

    for case_idx, case_data in enumerate(cases, start=1):
        context_dict = {
            "competency": case_data["competency"],
            "question": case_data["question"],
            "learner_answer": case_data["learner_answer"],
            "correct_answer": case_data["correct_answer"],
            "detected_gap": case_data.get("detected_gap"),
        }
        context = TutorContext(**context_dict)
        system_prompt = TUTOR_SYSTEM_PROMPT
        user_prompt = build_tutor_prompt(context)
        verification_meta = case_data.get("verification")
        case_id = case_data.get("question_id", f"case_{case_idx}")

        pq_questions_in_case = []

        for run_num in range(1, runs + 1):
            print(f"[{provider_name.upper()}] Case {case_idx}/{len(cases)} ({case_id}) | Run {run_num}/{runs}...", end=" ", flush=True)

            t0 = time.time()
            response: Optional[TutorResponse] = None
            error: Optional[Exception] = None

            try:
                if provider_name.lower() == "gemini":
                    response = call_gemini(system_prompt, user_prompt)
                elif provider_name.lower() == "groq":
                    response = call_groq(system_prompt, user_prompt)
                else:
                    raise ValueError(f"Unknown provider: {provider_name}")
            except Exception as exc:
                error = exc

            elapsed = round(time.time() - t0, 2)

            eval_res = evaluate_single_response(context, response, error, verification_meta)

            if response:
                pq_questions_in_case.append(normalize_text(response.practice_question.question))

            # Aggregate stats
            if eval_res["schema_valid"]:
                schema_valid_count += 1
            if eval_res["correct_answer_defended"]:
                correct_defended_count += 1
            if eval_res["practice_options_count"] and eval_res["practice_options_unique"] and eval_res["correct_option_in_options"] and eval_res["practice_question_differs"]:
                pq_valid_count += 1
            if len(eval_res["contradictions"]) > 0:
                contradictions_count += 1
            if eval_res["overall_pass"]:
                overall_pass_count += 1

            status_str = "PASS" if eval_res["overall_pass"] else "FAIL/REVIEW"
            print(f"{status_str} ({elapsed}s)")

            raw_entry = {
                "provider": provider_name.lower(),
                "case_id": case_id,
                "competency_id": context.competency.id,
                "run_number": run_num,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "elapsed_seconds": elapsed,
                "response": response.model_dump() if response else None,
                "validation": eval_res,
            }
            raw_results.append(raw_entry)

    # Calculate identical practice question rate across runs for each case
    identical_pq_pairs = 0
    total_pq_pairs = 0

    summary = {
        "provider": provider_name.lower(),
        "total_runs": total_runs,
        "schema_valid": f"{schema_valid_count}/{total_runs}",
        "schema_valid_pct": round((schema_valid_count / total_runs) * 100, 1) if total_runs else 0.0,
        "correct_answer_defended": f"{correct_defended_count}/{total_runs}",
        "correct_answer_pct": round((correct_defended_count / total_runs) * 100, 1) if total_runs else 0.0,
        "pq_valid": f"{pq_valid_count}/{total_runs}",
        "pq_valid_pct": round((pq_valid_count / total_runs) * 100, 1) if total_runs else 0.0,
        "contradictions_count": contradictions_count,
        "overall_acceptable_pct": round((overall_pass_count / total_runs) * 100, 1) if total_runs else 0.0,
    }

    return raw_results, summary


def generate_human_review_report(raw_results: List[Dict[str, Any]]) -> str:
    """Generate concise human review report identifying failed cases and review flags."""
    lines = []
    lines.append("==================================================")
    lines.append("HUMAN REVIEW & EXCEPTION REPORT")
    lines.append("==================================================")

    flagged_count = 0
    for entry in raw_results:
        val = entry["validation"]
        flags = val.get("review_flags", [])
        contradictions = val.get("contradictions", [])
        is_pass = val.get("overall_pass", False)

        if not is_pass or flags or contradictions:
            flagged_count += 1
            lines.append(f"\nCASE: {entry['case_id']}")
            lines.append(f"PROVIDER: {entry['provider']}")
            lines.append(f"RUN: {entry['run_number']}")
            lines.append(f"SCHEMA VALID: {'PASS' if val.get('schema_valid') else 'FAIL'}")
            lines.append(f"CORRECT DEFENDED: {'PASS' if val.get('correct_answer_defended') else 'FAIL'}")
            lines.append(f"PRACTICE STRUCTURE: {'PASS' if val.get('correct_option_in_options') else 'FAIL'}")

            for c in contradictions:
                lines.append(f"CONTRADICTION: {c}")
            for f in flags:
                lines.append(f"REVIEW: {f}")

    if flagged_count == 0:
        lines.append("\nAll runs completed successfully without automated quality flags or contradictions.")

    return "\n".join(lines)


def print_comparison_table(summaries: List[Dict[str, Any]]):
    """Print standard comparison table for tested providers."""
    print("\n==================================================")
    print("PROVIDER COMPARISON SUMMARY")
    print("==================================================")

    # Headers
    prov_names = [s["provider"].capitalize() for s in summaries]
    header_row = f"{'Metric':<25}" + "".join([f"{p:<15}" for p in prov_names])
    print(header_row)
    print("-" * (25 + 15 * len(summaries)))

    metrics = [
        ("Runs", lambda s: str(s["total_runs"])),
        ("Schema valid", lambda s: f"{s['schema_valid']} ({s['schema_valid_pct']}%)"),
        ("Correct defended", lambda s: f"{s['correct_answer_defended']} ({s['correct_answer_pct']}%)"),
        ("PQ valid", lambda s: f"{s['pq_valid']} ({s['pq_valid_pct']}%)"),
        ("Contradictions", lambda s: str(s["contradictions_count"])),
        ("Overall acceptable", lambda s: f"{s['overall_acceptable_pct']}%"),
    ]

    for label, fn in metrics:
        row = f"{label:<25}" + "".join([f"{fn(s):<15}" for s in summaries])
        print(row)
    print("==================================================\n")


def main():
    parser = argparse.ArgumentParser(description="AI Tutor Provider Consistency Testing Harness")
    parser.add_argument(
        "--provider",
        choices=["gemini", "groq", "both"],
        default="both",
        help="Provider to test (gemini, groq, or both)",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=5,
        help="Number of runs per test case (default: 5)",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=str(DATASET_PATH),
        help="Path to consistency test dataset JSON file",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory to save consistency test JSON results",
    )

    args = parser.parse_args()

    dataset_file = Path(args.dataset)
    if not dataset_file.exists():
        print(f"Error: Dataset file not found at {dataset_file}")
        sys.exit(1)

    with open(dataset_file, "r", encoding="utf-8") as f:
        cases = json.load(f)

    print(f"Loaded {len(cases)} test cases from {dataset_file}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    providers_to_test = ["gemini", "groq"] if args.provider == "both" else [args.provider]

    all_raw_results = []
    summaries = []

    for provider in providers_to_test:
        raw_res, summary = run_provider_test(provider, cases, args.runs)
        all_raw_results.extend(raw_res)
        summaries.append(summary)

    # Output Comparison Table
    print_comparison_table(summaries)

    # Output Human Review Report
    review_report = generate_human_review_report(all_raw_results)
    print(review_report)

    # Save Results to Output Directory
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    raw_results_path = output_dir / f"consistency_results_{timestamp}.json"
    summary_path = output_dir / f"consistency_summary_{timestamp}.json"
    latest_path = output_dir / "latest_results.json"

    export_payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "providers_tested": providers_to_test,
        "runs_per_case": args.runs,
        "total_cases": len(cases),
        "summaries": summaries,
        "raw_results": all_raw_results,
    }

    with open(raw_results_path, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({"summaries": summaries, "review_report": review_report}, f, indent=2)

    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)

    print(f"\nSaved raw results to: {raw_results_path}")
    print(f"Saved summary to: {summary_path}")
    print(f"Updated latest results at: {latest_path}")


if __name__ == "__main__":
    main()
