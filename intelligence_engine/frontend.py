"""Frontend-ready JSON projections of the canonical intelligence result."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from statistics import mean, median
from typing import Any

from .concept_graph import ConceptGraph
from .pipeline import PipelineResult


SCHEMA_VERSION = "LEARNTRACE_FRONTEND_V1"
ADMIN_SCHEMA_VERSION = "LEARNTRACE_ADMIN_HEATMAP_V1"


def build_frontend_payload(
    result: PipelineResult,
    graph: ConceptGraph,
    assessment_scores: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Build the single JSON contract consumed by learner-facing screens."""

    labels = {concept.id: concept.name or concept.id for concept in graph.concepts()}
    roles = _roles(result)
    subject_nodes = _subject_nodes(result.target_concept_id, graph)
    trace_nodes, trace_edges = _root_trace(result, graph)
    path_ids = result.learning_path.concept_ids if result.learning_path else ()
    path_edges = set(zip(path_ids, path_ids[1:]))
    competency = _graph_view(
        subject_nodes, graph, result, labels, roles, trace_edges, path_edges
    )
    root_trace = _graph_view(
        trace_nodes, graph, result, labels, roles, trace_edges, path_edges
    )
    mastery_profile = [
        _mastery_card(concept_id, result, labels)
        for concept_id in graph.topological_sort(subject_nodes)
    ]
    assessed = [item for item in mastery_profile if item["assessed"]]

    return {
        "schema_version": SCHEMA_VERSION,
        "summary": {
            "target": _mastery_card(result.target_concept_id, result, labels),
            "readiness_score": _readiness_score(result),
            "readiness_formula": "CONFIDENCE_WEIGHTED_MEAN",
            "strongest_concepts": sorted(
                assessed,
                key=lambda item: (-item["mastery_probability"], item["id"]),
            )[:3],
            "weakest_concepts": sorted(
                assessed,
                key=lambda item: (item["mastery_probability"], item["id"]),
            )[:3],
            "root_gap_probability": round(result.gaps.target_gap_probability, 4),
            "next_action": _next_action(result, labels),
        },
        "mastery_profile": mastery_profile,
        "graphs": {
            "competency": competency,
            "root_cause": root_trace,
        },
        "learning_path": _learning_path(result, labels),
        "progress": {
            "assessment_scores": [dict(item) for item in assessment_scores],
            "concept_improvement": [
                {
                    "concept_id": concept_id,
                    "label": labels.get(concept_id, concept_id),
                    "change": round(evidence.reassessment_delta, 4),
                    "change_percentage_points": round(evidence.reassessment_delta * 100, 1),
                }
                for concept_id, evidence in sorted(result.evidence.items())
                if evidence.reassessment_delta is not None
            ],
        },
    }


def build_admin_heatmap(
    learner_payloads: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Aggregate learner JSON results into one class/subject heatmap."""

    if not learner_payloads:
        raise ValueError("at least one learner analysis is required")

    learners = [_read_learner_payload(payload) for payload in learner_payloads]
    user_ids = [learner["user_id"] for learner in learners]
    if len(user_ids) != len(set(user_ids)):
        raise ValueError("each learner must appear once in an admin heatmap")

    first_ids = tuple(item["id"] for item in learners[0]["profile"])
    first_scope = _concept_scope(learners[0]["target_id"])
    for learner in learners[1:]:
        if _concept_scope(learner["target_id"]) != first_scope:
            raise ValueError("all learners in a heatmap must share one class and subject")
        if tuple(item["id"] for item in learner["profile"]) != first_ids:
            raise ValueError("learner mastery profiles use different competency catalogues")

    columns = [
        {"concept_id": item["id"], "label": item["label"], "position": index}
        for index, item in enumerate(learners[0]["profile"])
    ]
    rows = [_heatmap_row(learner) for learner in sorted(learners, key=lambda item: item["user_id"])]
    concept_summary = [
        _concept_summary(column, rows)
        for column in columns
    ]
    all_cells = [cell for row in rows for cell in row["cells"]]
    readiness = [row["readiness_score"] for row in rows if row["readiness_score"] is not None]
    assessed_count = sum(cell["assessed"] for cell in all_cells)
    root_counts = [
        {
            "concept_id": summary["concept_id"],
            "label": summary["label"],
            "student_count": summary["root_gap_students"],
            "student_percentage": round(
                100 * summary["root_gap_students"] / len(rows), 1
            ),
        }
        for summary in concept_summary
        if summary["root_gap_students"]
    ]

    return {
        "schema_version": ADMIN_SCHEMA_VERSION,
        "scope": {
            "class_id": first_scope[0],
            "subject_id": first_scope[1],
        },
        "summary": {
            "student_count": len(rows),
            "concept_count": len(columns),
            "assessed_cell_count": assessed_count,
            "coverage_percentage": round(100 * assessed_count / len(all_cells), 1),
            "average_readiness_score": round(mean(readiness), 1) if readiness else None,
            "next_action_counts": _counts(row["next_action"]["type"] for row in rows),
            "tier_distribution": _counts(cell["tier"] for cell in all_cells),
        },
        "scale": {
            "value_field": "mastery_score",
            "minimum": 0,
            "maximum": 100,
            "unknown": None,
            "progression_gate": 70,
            "mastered_gate": 85,
        },
        "columns": columns,
        "rows": rows,
        "concept_summary": concept_summary,
        "root_gap_distribution": sorted(
            root_counts,
            key=lambda item: (-item["student_count"], item["concept_id"]),
        ),
    }


def _read_learner_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    try:
        integration = payload["integration"]
        frontend = payload["frontend"]
        summary = frontend["summary"]
        profile = frontend["mastery_profile"]
        competency_nodes = frontend["graphs"]["competency"]["nodes"]
        target_id = payload["target_concept_id"]
    except (KeyError, TypeError) as error:
        raise ValueError("invalid learner intelligence payload") from error
    if frontend.get("schema_version") != SCHEMA_VERSION or not profile:
        raise ValueError("unsupported or empty learner frontend payload")
    roles = {node["id"]: set(node.get("roles", ())) for node in competency_nodes}
    return {
        "user_id": int(integration["user_id"]),
        "target_id": str(target_id),
        "readiness_score": summary["readiness_score"],
        "next_action": summary["next_action"],
        "profile": profile,
        "roles": roles,
    }


def _concept_scope(concept_id: str) -> tuple[str, str]:
    parts = concept_id.split(":")
    if len(parts) < 3:
        raise ValueError(f"invalid curriculum concept ID: {concept_id}")
    return parts[0], parts[1]


def _heatmap_row(learner: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "user_id": learner["user_id"],
        "target_concept_id": learner["target_id"],
        "readiness_score": learner["readiness_score"],
        "next_action": learner["next_action"],
        "cells": [
            {
                "concept_id": item["id"],
                "assessed": item["assessed"],
                "mastery_probability": item["mastery_probability"],
                "mastery_score": item["mastery_score"],
                "tier": item["tier"],
                "confidence": item["confidence"],
                "can_progress": item["can_progress"],
                "is_root_gap": "ROOT_CAUSE" in learner["roles"].get(item["id"], ()),
            }
            for item in learner["profile"]
        ],
    }


def _concept_summary(column: Mapping[str, Any], rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    cells = [
        next(cell for cell in row["cells"] if cell["concept_id"] == column["concept_id"])
        for row in rows
    ]
    scores = [cell["mastery_score"] for cell in cells if cell["mastery_score"] is not None]
    return {
        "concept_id": column["concept_id"],
        "label": column["label"],
        "assessed_students": len(scores),
        "unknown_students": len(cells) - len(scores),
        "average_mastery_score": round(mean(scores), 1) if scores else None,
        "median_mastery_score": round(median(scores), 1) if scores else None,
        "at_risk_students": sum(score < 70 for score in scores),
        "can_progress_students": sum(score >= 70 for score in scores),
        "root_gap_students": sum(cell["is_root_gap"] for cell in cells),
        "tier_distribution": _counts(cell["tier"] for cell in cells),
    }


def _counts(values: Any) -> dict[str, int]:
    result: dict[str, int] = {}
    for value in values:
        result[str(value)] = result.get(str(value), 0) + 1
    return dict(sorted(result.items()))


def _subject_nodes(target_id: str, graph: ConceptGraph) -> set[str]:
    scope = ":".join(target_id.split(":")[:2]) + ":"
    return {concept.id for concept in graph.concepts() if concept.id.startswith(scope)}


def _roles(result: PipelineResult) -> dict[str, set[str]]:
    roles: dict[str, set[str]] = {result.target_concept_id: {"TARGET"}}
    for candidate in result.gaps.root_causes:
        roles.setdefault(candidate.concept_id, set()).add("ROOT_CAUSE")
    for candidate in result.gaps.contributing_gaps:
        roles.setdefault(candidate.concept_id, set()).add("CONTRIBUTOR")
    for concept_id in result.gaps.diagnostic_required_concept_ids:
        roles.setdefault(concept_id, set()).add("DIAGNOSTIC_REQUIRED")
    if result.learning_path:
        for step in result.learning_path.steps:
            roles.setdefault(step.concept_id, set()).add(f"PATH_{step.status.value}")
    return roles


def _root_trace(
    result: PipelineResult, graph: ConceptGraph
) -> tuple[set[str], set[tuple[str, str]]]:
    target = result.target_concept_id
    nodes = {target}
    edges: set[tuple[str, str]] = set()
    causes = (*result.gaps.root_causes, *result.gaps.contributing_gaps)
    for cause in causes:
        paths = graph.paths(cause.concept_id, target, max_paths=5, max_depth=8)
        for path in paths:
            nodes.update(path)
            edges.update(zip(path, path[1:]))
    return nodes, edges


def _graph_view(
    node_ids: set[str],
    graph: ConceptGraph,
    result: PipelineResult,
    labels: Mapping[str, str],
    roles: Mapping[str, set[str]],
    root_trace_edges: set[tuple[str, str]],
    path_edges: set[tuple[str, str]],
) -> dict[str, Any]:
    order = graph.topological_sort(node_ids)
    levels: dict[str, int] = {}
    for concept_id in order:
        parents = [item for item in graph.prerequisites(concept_id) if item in node_ids]
        levels[concept_id] = 0 if not parents else max(levels[item] for item in parents) + 1

    edges = []
    for edge in graph.dependencies():
        source, target = edge.prerequisite_id, edge.concept_id
        if source not in node_ids or target not in node_ids:
            continue
        edges.append(
            {
                "id": f"{source}->{target}",
                "source": source,
                "target": target,
                "weight": round(edge.weight, 4),
                "in_root_trace": (source, target) in root_trace_edges,
                "in_learning_path": (source, target) in path_edges,
            }
        )

    return {
        "direction": "PREREQUISITE_TO_DEPENDENT",
        "node_count": len(node_ids),
        "edge_count": len(edges),
        "nodes": [
            {
                **_mastery_card(concept_id, result, labels),
                "level": levels[concept_id],
                "roles": sorted(roles.get(concept_id, ())),
            }
            for concept_id in order
        ],
        "edges": edges,
    }


def _mastery_card(
    concept_id: str,
    result: PipelineResult,
    labels: Mapping[str, str],
) -> dict[str, Any]:
    estimate = result.mastery.get(concept_id)
    probability = None if estimate is None else estimate.probability
    return {
        "id": concept_id,
        "label": labels.get(concept_id, concept_id),
        "assessed": estimate is not None,
        "mastery_probability": None if probability is None else round(probability, 4),
        "mastery_score": None if estimate is None else estimate.score,
        "tier": "UNKNOWN" if estimate is None or estimate.tier is None else estimate.tier.value,
        "confidence": None if estimate is None else round(estimate.confidence, 4),
        "confidence_label": None if estimate is None else estimate.confidence_label,
        "can_progress": False if estimate is None else estimate.can_progress,
    }


def _readiness_score(result: PipelineResult) -> float | None:
    weighted = [
        (estimate.probability, estimate.confidence)
        for estimate in result.mastery.values()
        if estimate.probability is not None and estimate.confidence > 0
    ]
    if not weighted:
        return None
    return round(100 * sum(score * confidence for score, confidence in weighted) / sum(
        confidence for _, confidence in weighted
    ), 1)


def _next_action(result: PipelineResult, labels: Mapping[str, str]) -> dict[str, Any]:
    if result.learning_path:
        current = next(
            (step for step in result.learning_path.steps if step.status.value == "CURRENT"),
            None,
        )
        if current:
            return {
                "type": "LEARN_CURRENT_STEP",
                "concept_id": current.concept_id,
                "label": labels.get(current.concept_id, current.concept_id),
            }
        diagnostic = next(
            (
                step
                for step in result.learning_path.steps
                if step.status.value == "DIAGNOSTIC_REQUIRED"
            ),
            None,
        )
        if diagnostic:
            return {
                "type": "TAKE_DIAGNOSTIC",
                "concept_id": diagnostic.concept_id,
                "label": labels.get(diagnostic.concept_id, diagnostic.concept_id),
            }
    if result.gaps.diagnostic_required_concept_ids:
        concept_id = result.gaps.diagnostic_required_concept_ids[0]
        return {
            "type": "TAKE_DIAGNOSTIC",
            "concept_id": concept_id,
            "label": labels.get(concept_id, concept_id),
        }
    target = result.mastery[result.target_concept_id]
    return {
        "type": "MAINTAIN_MASTERY" if target.can_progress else "REVIEW_TARGET",
        "concept_id": result.target_concept_id,
        "label": labels.get(result.target_concept_id, result.target_concept_id),
    }


def _learning_path(result: PipelineResult, labels: Mapping[str, str]) -> dict[str, Any] | None:
    path = result.learning_path
    if path is None:
        return None
    return {
        "target_id": path.target_id,
        "version": path.version,
        "steps": [
            {
                "concept_id": step.concept_id,
                "label": labels.get(step.concept_id, step.concept_id),
                "position": step.position,
                "status": step.status.value,
                "mastery_probability": step.mastery,
                "mastery_score": None if step.mastery is None else round(step.mastery * 100, 1),
                "tier": step.tier.value,
                "target_mastery": step.target_mastery,
                "blocked_by": list(step.blocked_by),
                "estimated_minutes": step.estimated_minutes,
            }
            for step in path.steps
        ],
    }


__all__ = [
    "ADMIN_SCHEMA_VERSION",
    "SCHEMA_VERSION",
    "build_admin_heatmap",
    "build_frontend_payload",
]
