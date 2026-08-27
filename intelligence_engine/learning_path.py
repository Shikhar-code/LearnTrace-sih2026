"""Small, dependency-free learning-path planner.

The planner deliberately knows nothing about HTTP, databases, or content.  It
accepts a concept graph plus mastery values and returns a graph-valid sequence
of concept IDs with progression gates.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from math import inf
from typing import Any, Iterable, Mapping, Sequence


PROGRESSION_GATE = 0.70
MASTERED_GATE = 0.85


class MasteryTier(str, Enum):
    CRITICAL_GAP = "Critical Gap"
    EMERGING = "Emerging"
    DEVELOPING = "Developing"
    PROFICIENT = "Proficient"
    MASTERED = "Mastered"
    UNKNOWN = "Unknown"


class StepStatus(str, Enum):
    CURRENT = "CURRENT"
    READY = "READY"
    LOCKED = "LOCKED"
    COMPLETED = "COMPLETED"
    DIAGNOSTIC_REQUIRED = "DIAGNOSTIC_REQUIRED"


def mastery_tier(score: float | None) -> MasteryTier:
    """Map a probability to the five user-facing tiers."""
    if score is None:
        return MasteryTier.UNKNOWN
    score = max(0.0, min(1.0, float(score)))
    if score < 0.40:
        return MasteryTier.CRITICAL_GAP
    if score < 0.55:
        return MasteryTier.EMERGING
    if score < PROGRESSION_GATE:
        return MasteryTier.DEVELOPING
    if score < MASTERED_GATE:
        return MasteryTier.PROFICIENT
    return MasteryTier.MASTERED


@dataclass(frozen=True)
class MasteryValue:
    concept_id: str
    score: float | None
    tier: MasteryTier | None = None

    @property
    def effective_tier(self) -> MasteryTier:
        return self.tier or mastery_tier(self.score)

    @property
    def meets_gate(self) -> bool:
        return self.score is not None and self.score >= PROGRESSION_GATE

    @property
    def is_mastered(self) -> bool:
        return self.score is not None and self.score >= MASTERED_GATE


@dataclass(frozen=True)
class PathCandidate:
    root_id: str
    target_id: str
    concept_ids: tuple[str, ...]
    root_coverage: float
    gap_coverage: float
    unknown_count: int
    estimated_minutes: int
    score_explanation: tuple[str, ...] = ()

    @property
    def score_key(self) -> tuple[Any, ...]:
        """Deterministic lexicographic ranking key (lower is better)."""
        return (
            -self.root_coverage,
            -self.gap_coverage,
            self.unknown_count,
            self.estimated_minutes,
            len(self.concept_ids),
            self.concept_ids,
        )


@dataclass
class PathStep:
    concept_id: str
    position: int
    status: StepStatus
    mastery: float | None
    tier: MasteryTier
    target_mastery: float = MASTERED_GATE
    blocked_by: tuple[str, ...] = ()
    root_probability: float | None = None
    estimated_minutes: int | None = None
    explanations: list[str] = field(default_factory=list)


@dataclass
class LearningPath:
    target_id: str
    steps: list[PathStep]
    candidate: PathCandidate
    version: int = 1

    @property
    def concept_ids(self) -> tuple[str, ...]:
        return tuple(step.concept_id for step in self.steps)


def _value(concept_id: str, raw: Any) -> MasteryValue:
    """Accept the plain mapping forms used by the other pipeline stages."""
    if isinstance(raw, MasteryValue):
        return raw
    if isinstance(raw, (int, float)):
        return MasteryValue(concept_id, float(raw))
    if raw is None:
        return MasteryValue(concept_id, None)
    if isinstance(raw, Mapping):
        score = raw.get(
            "probability",
            raw.get("mastery_probability", raw.get("mastery", raw.get("score"))),
        )
        tier = raw.get("tier")
        if isinstance(tier, str):
            try:
                tier = MasteryTier(tier)
            except ValueError:
                tier = None
        elif not isinstance(tier, MasteryTier):
            tier = None
        return MasteryValue(concept_id, None if score is None else float(score), tier)
    score = getattr(
        raw,
        "probability",
        getattr(raw, "mastery_probability", getattr(raw, "score", None)),
    )
    tier = getattr(raw, "tier", None)
    if not isinstance(tier, MasteryTier):
        tier = None
    return MasteryValue(concept_id, None if score is None else float(score), tier)


class LearningPathEngine:
    """Build, rank, and recalculate paths using a prerequisite graph adapter."""

    def __init__(
        self,
        graph: Any,
        *,
        progression_gate: float = PROGRESSION_GATE,
        mastered_gate: float = MASTERED_GATE,
        max_paths: int = 5,
        max_depth: int = 8,
    ) -> None:
        if not 0 < progression_gate <= 1 or not 0 < mastered_gate <= 1:
            raise ValueError("mastery gates must be between 0 and 1")
        if progression_gate > mastered_gate:
            raise ValueError("progression_gate cannot exceed mastered_gate")
        self.graph = graph
        self.progression_gate = progression_gate
        self.mastered_gate = mastered_gate
        self.max_paths = max_paths
        self.max_depth = max_depth

    def _mastery(self, mastery: Mapping[str, Any]) -> dict[str, MasteryValue]:
        return {str(k): _value(str(k), v) for k, v in mastery.items()}

    def _is_mastered(self, value: MasteryValue) -> bool:
        return value.score is not None and value.score >= self.mastered_gate

    def _prerequisites(self, concept_id: str) -> tuple[str, ...]:
        getter = getattr(self.graph, "get_prerequisites", None)
        if getter is not None:
            return tuple(str(x) for x in getter(concept_id))
        mapping = getattr(self.graph, "prerequisites", {})
        if callable(mapping):
            return tuple(str(x) for x in mapping(concept_id))
        return tuple(str(x) for x in mapping.get(concept_id, ()))

    def _valid_path(
        self,
        path: Sequence[str],
        root_id: str,
        target_id: str,
        values: Mapping[str, MasteryValue] | None = None,
    ) -> bool:
        ids = tuple(str(x) for x in path)
        if not ids or ids[0] != root_id or ids[-1] != target_id:
            return False
        if len(ids) != len(set(ids)) or len(ids) > self.max_depth:
            return False
        positions = {concept: i for i, concept in enumerate(ids)}
        for concept in ids:
            for prerequisite in self._prerequisites(concept):
                if prerequisite in positions:
                    if positions[prerequisite] >= positions[concept]:
                        return False
                elif values is None:
                    return False
                else:
                    omitted = values.get(prerequisite, MasteryValue(prerequisite, None))
                    root_ancestors = (
                        set(self.graph.ancestors(root_id))
                        if hasattr(self.graph, "ancestors")
                        else set()
                    )
                    # Mastered nodes may always be compressed out. A merely
                    # proficient node may be omitted only when it is upstream
                    # of the selected root, never when that would skip a step
                    # between the root and target.
                    if not self._is_mastered(omitted) and not (
                        omitted.meets_gate and prerequisite in root_ancestors
                    ):
                        return False
        return True

    def generate_candidates(
        self,
        root_id: str,
        target_id: str,
        mastery: Mapping[str, Any],
        *,
        root_probability: float = 1.0,
        estimated_minutes: Mapping[str, int] | None = None,
    ) -> list[PathCandidate]:
        """Create bounded, graph-valid candidates for one root/target pair."""
        values = self._mastery(mastery)
        if hasattr(self.graph, "bounded_paths"):
            paths = self.graph.bounded_paths(root_id, target_id, self.max_paths, self.max_depth)
        elif hasattr(self.graph, "paths"):
            paths = self.graph.paths(root_id, target_id, self.max_paths, self.max_depth)
        else:
            paths = ([root_id, target_id],) if root_id != target_id else ([root_id],)
        minutes = estimated_minutes or {}
        candidates: list[PathCandidate] = []
        seen_active: set[tuple[str, ...]] = set()
        for raw_path in paths:
            path = tuple(str(x) for x in raw_path)
            if not self._valid_path(path, str(root_id), str(target_id), values):
                continue
            active = tuple(x for x in path if not self._is_mastered(values.get(x, MasteryValue(x, None))))
            if not active:
                active = (path[-1],)
            if active in seen_active:
                continue
            seen_active.add(active)
            weak = sum(
                1 - (values[x].score or 0.0)
                for x in active
                if x in values and not values[x].meets_gate
            )
            unknown = sum(values.get(x, MasteryValue(x, None)).score is None for x in active)
            total_minutes = sum(int(minutes.get(x, 0)) for x in active)
            coverage = root_probability if str(root_id) in active else 0.0
            candidates.append(
                PathCandidate(
                    str(root_id), str(target_id), active, coverage, weak, unknown, total_minutes,
                    (f"Covers root probability {coverage:.2f}.", f"Covers {len(active)} non-mastered concept(s)."),
                )
            )
        return sorted(candidates, key=lambda candidate: candidate.score_key)[: self.max_paths]

    def rank_candidates(self, candidates: Iterable[PathCandidate]) -> list[PathCandidate]:
        return sorted(candidates, key=lambda candidate: candidate.score_key)

    def build_path(
        self,
        candidate: PathCandidate,
        mastery: Mapping[str, Any],
        *,
        root_probabilities: Mapping[str, float] | None = None,
        estimated_minutes: Mapping[str, int] | None = None,
        version: int = 1,
    ) -> LearningPath:
        values = self._mastery(mastery)
        minutes = estimated_minutes or {}
        roots = root_probabilities or {candidate.root_id: candidate.root_coverage}
        steps: list[PathStep] = []
        incomplete_seen = False
        for position, concept_id in enumerate(candidate.concept_ids, 1):
            value = values.get(concept_id, MasteryValue(concept_id, None))
            blocked = tuple(step.concept_id for step in steps if step.status in (StepStatus.LOCKED, StepStatus.DIAGNOSTIC_REQUIRED, StepStatus.CURRENT))
            if value.score is None:
                status = StepStatus.DIAGNOSTIC_REQUIRED
                incomplete_seen = True
                explanation = ["Diagnostic evidence is required before this step can unlock."]
            elif value.score >= self.progression_gate:
                status = StepStatus.COMPLETED
                explanation = [f"Mastery is at or above the {self.progression_gate:.0%} progression gate."]
            elif not incomplete_seen:
                status = StepStatus.CURRENT
                incomplete_seen = True
                explanation = ["Highest-priority incomplete step with prerequisites satisfied."]
            else:
                status = StepStatus.LOCKED
                explanation = ["Complete the preceding prerequisite step first."]
            if status in (StepStatus.LOCKED, StepStatus.CURRENT) and blocked:
                blocked_by = blocked if status is StepStatus.LOCKED else ()
            else:
                blocked_by = ()
            steps.append(PathStep(
                concept_id, position, status, value.score, value.effective_tier,
                self.progression_gate, blocked_by, roots.get(concept_id), minutes.get(concept_id), explanation,
            ))
        # A pre-existing completed step must not block a later current step.
        for step in steps:
            if step.status is StepStatus.LOCKED:
                step.blocked_by = tuple(
                    prior.concept_id for prior in steps[: step.position - 1]
                    if prior.status is not StepStatus.COMPLETED
                )
        return LearningPath(candidate.target_id, steps, candidate, version)

    def plan(
        self,
        root_id: str,
        target_id: str,
        mastery: Mapping[str, Any],
        *,
        root_probability: float = 1.0,
        estimated_minutes: Mapping[str, int] | None = None,
        version: int = 1,
    ) -> LearningPath:
        candidates = self.generate_candidates(root_id, target_id, mastery, root_probability=root_probability, estimated_minutes=estimated_minutes)
        if not candidates:
            raise ValueError(f"no valid path from {root_id!r} to {target_id!r}")
        return self.build_path(candidates[0], mastery, estimated_minutes=estimated_minutes, version=version)

    def recalculate(
        self,
        path: LearningPath,
        mastery: Mapping[str, Any],
        *,
        version: int | None = None,
    ) -> LearningPath:
        """Re-evaluate statuses after new evidence without mutating old snapshots."""
        candidates = self.generate_candidates(
            path.candidate.root_id,
            path.candidate.target_id,
            mastery,
            root_probability=path.candidate.root_coverage,
        )
        candidate = candidates[0] if candidates else path.candidate
        return self.build_path(candidate, mastery, version=path.version if version is None else version)


__all__ = [
    "LearningPathEngine", "LearningPath", "PathCandidate", "PathStep", "MasteryValue",
    "MasteryTier", "StepStatus", "mastery_tier", "PROGRESSION_GATE", "MASTERED_GATE",
]
