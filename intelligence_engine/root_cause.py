"""Explainable probabilistic root-gap inference over a prerequisite DAG."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Mapping


@dataclass(frozen=True)
class RootCauseCandidate:
    concept_id: str
    branch_id: str
    posterior_probability: float
    evidence_confidence: float
    gap_probability: float
    upstream_explanation: float
    target_influence: float
    graph_distance: int
    role: str
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class GapAnalysis:
    target_concept_id: str
    target_gap_probability: float
    root_causes: tuple[RootCauseCandidate, ...]
    contributing_gaps: tuple[RootCauseCandidate, ...]
    unexplained_probability: float
    diagnostic_required_concept_ids: tuple[str, ...]
    algorithm_version: str = "NOISY_OR_ROOT_V1"


def _read(estimate: Any, name: str, default: Any = None) -> Any:
    return estimate.get(name, default) if isinstance(estimate, Mapping) else getattr(estimate, name, default)


def _probability(estimate: Any) -> float | None:
    value = _read(estimate, "probability", _read(estimate, "mastery_probability"))
    return None if value is None else max(0.0, min(1.0, float(value)))


def _confidence(estimate: Any) -> float:
    return max(0.0, min(1.0, float(_read(estimate, "confidence", _read(estimate, "evidence_confidence", 0.0)))))


class RootCauseEngine:
    """Rank likely roots per immediate prerequisite branch.

    Scores multiply independent-gap evidence, noisy-OR target influence and
    observed chain consistency, then normalize alongside an unknown cause.
    """

    def __init__(self, *, minimum_confidence: float = 0.20, decay: float = 0.85):
        self.minimum_confidence = minimum_confidence
        self.decay = decay

    def analyze(
        self,
        target_concept_id: str,
        mastery: Mapping[str, Any],
        graph: Any,
    ) -> GapAnalysis:
        if target_concept_id not in mastery:
            raise ValueError(f"missing mastery for target concept: {target_concept_id}")
        target_probability = _probability(mastery[target_concept_id])
        if target_probability is None:
            return GapAnalysis(
                target_concept_id,
                0.0,
                (),
                (),
                1.0,
                (target_concept_id,),
            )
        if target_probability >= 0.70:
            return GapAnalysis(
                target_concept_id,
                1.0 - target_probability,
                (),
                (),
                0.0,
                (),
            )

        branch_roots: list[RootCauseCandidate] = []
        contributors: dict[str, RootCauseCandidate] = {}
        diagnostics: set[str] = set()
        unknown_probabilities: list[float] = []

        for branch_id in graph.prerequisites(target_concept_id):
            candidate_ids = [branch_id, *graph.ancestors(branch_id)]
            raw: list[tuple[str, float, float, float, float, int, tuple[str, ...]]] = []
            branch_confidences: list[float] = []
            for candidate_id in candidate_ids:
                estimate = mastery.get(candidate_id)
                probability = _probability(estimate) if estimate is not None else None
                confidence = _confidence(estimate) if estimate is not None else 0.0
                branch_confidences.append(confidence)
                if probability is None or confidence < self.minimum_confidence:
                    diagnostics.add(candidate_id)
                    continue
                # A weak, sufficiently observed direct prerequisite makes this
                # node an intermediary symptom rather than the earliest root.
                if any(
                    _probability(mastery.get(prerequisite)) is not None
                    and _confidence(mastery.get(prerequisite)) >= self.minimum_confidence
                    and _probability(mastery.get(prerequisite)) < 0.70
                    for prerequisite in graph.prerequisites(candidate_id)
                ):
                    continue
                gap = 1.0 - probability
                upstream = self._upstream_explanation(candidate_id, mastery, graph)
                influence = graph.influence(candidate_id, target_concept_id, decay=self.decay)
                paths = graph.paths(candidate_id, target_concept_id, max_paths=5, max_depth=8)
                if not paths or influence <= 0.0:
                    continue
                path = min(paths, key=lambda item: (len(item), item))
                chain_values = []
                for concept_id in path:
                    item = mastery.get(concept_id)
                    item_probability = _probability(item) if item is not None else None
                    if item_probability is not None:
                        chain_values.append(_confidence(item) * (1.0 - item_probability))
                chain_consistency = sum(chain_values) / len(chain_values) if chain_values else 0.0
                independent_gap = confidence * gap * (1.0 - upstream)
                # Square-root influence avoids automatically preferring the nearest
                # weak intermediary over a well-supported upstream root.
                support = (0.02 + independent_gap) * math.sqrt(influence) * (
                    0.5 + 0.5 * chain_consistency
                )
                reasons = self._reasons(candidate_id, probability, confidence, upstream, influence, path)
                raw.append(
                    (
                        candidate_id,
                        support,
                        confidence,
                        gap,
                        upstream,
                        len(path) - 1,
                        reasons,
                    )
                )

            unknown_support = 0.03 + 0.20 * (
                sum(1.0 - value for value in branch_confidences) / len(branch_confidences)
                if branch_confidences
                else 1.0
            )
            total = unknown_support + sum(item[1] for item in raw)
            unknown_probability = unknown_support / total if total else 1.0
            unknown_probabilities.append(unknown_probability)
            ranked = sorted(raw, key=lambda item: (-item[1], item[0]))
            if not ranked:
                continue
            winner = ranked[0]
            winner_probability = winner[1] / total
            root = RootCauseCandidate(
                concept_id=winner[0],
                branch_id=branch_id,
                posterior_probability=winner_probability,
                evidence_confidence=winner[2],
                gap_probability=winner[3],
                upstream_explanation=winner[4],
                target_influence=graph.influence(winner[0], target_concept_id, decay=self.decay),
                graph_distance=winner[5],
                role="ROOT",
                reasons=winner[6],
            )
            branch_roots.append(root)

            best_path = min(
                graph.paths(root.concept_id, target_concept_id, max_paths=5, max_depth=8),
                key=lambda item: (len(item), item),
            )
            for concept_id in best_path[1:-1]:
                item = mastery.get(concept_id)
                probability = _probability(item) if item is not None else None
                if probability is None or probability >= 0.70:
                    continue
                confidence = _confidence(item)
                contributors[concept_id] = RootCauseCandidate(
                    concept_id=concept_id,
                    branch_id=branch_id,
                    posterior_probability=confidence * (1.0 - probability),
                    evidence_confidence=confidence,
                    gap_probability=1.0 - probability,
                    upstream_explanation=self._upstream_explanation(concept_id, mastery, graph),
                    target_influence=graph.influence(concept_id, target_concept_id, decay=self.decay),
                    graph_distance=self._distance(concept_id, target_concept_id, graph),
                    role="CONTRIBUTOR",
                    reasons=("This weak concept lies between the likely root and the observed target.",),
                )

        roots = tuple(sorted(branch_roots, key=lambda item: (-item.posterior_probability, item.concept_id)))
        contribution_values = tuple(
            sorted(contributors.values(), key=lambda item: (-item.posterior_probability, item.concept_id))
        )
        return GapAnalysis(
            target_concept_id=target_concept_id,
            target_gap_probability=1.0 - target_probability,
            root_causes=roots,
            contributing_gaps=contribution_values,
            unexplained_probability=(
                sum(unknown_probabilities) / len(unknown_probabilities)
                if unknown_probabilities
                else 1.0
            ),
            diagnostic_required_concept_ids=tuple(sorted(diagnostics)),
        )

    def _upstream_explanation(self, concept_id: str, mastery: Mapping[str, Any], graph: Any) -> float:
        unexplained_product = 1.0
        for prerequisite in graph.prerequisites(concept_id):
            estimate = mastery.get(prerequisite)
            probability = _probability(estimate) if estimate is not None else None
            if probability is None:
                continue
            edge_influence = graph.influence(prerequisite, concept_id, decay=1.0)
            unexplained_product *= 1.0 - edge_influence * _confidence(estimate) * (1.0 - probability)
        return 1.0 - unexplained_product

    @staticmethod
    def _distance(source: str, target: str, graph: Any) -> int:
        paths = graph.paths(source, target, max_paths=5, max_depth=8)
        return min((len(path) - 1 for path in paths), default=0)

    @staticmethod
    def _reasons(
        concept_id: str,
        probability: float,
        confidence: float,
        upstream: float,
        influence: float,
        path: tuple[str, ...],
    ) -> tuple[str, ...]:
        reasons = [
            f"{concept_id} has {probability * 100:.0f}% estimated mastery with {confidence * 100:.0f}% evidence confidence.",
            f"Its graph influence on the target is {influence:.2f} across {len(path) - 1} dependency edge(s).",
        ]
        if upstream < 0.25:
            reasons.append("Its own prerequisites do not strongly explain the observed gap.")
        else:
            reasons.append("Some of this gap is already explained by weaker upstream prerequisites.")
        return tuple(reasons)
