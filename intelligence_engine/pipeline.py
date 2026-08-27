"""Composition root for the five standalone LearnTrace intelligence parts."""

from __future__ import annotations

from dataclasses import asdict, dataclass, is_dataclass
from enum import Enum
from typing import Any, Iterable, Mapping

from .assessment import AssessmentService, ConceptEvidence, Response
from .learning_path import LearningPath, LearningPathEngine
from .mastery import MasteryEngine, MasteryEstimate
from .root_cause import GapAnalysis, RootCauseEngine


def _jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return _jsonable(asdict(value))
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


@dataclass(frozen=True)
class PipelineResult:
    target_concept_id: str
    evidence: Mapping[str, ConceptEvidence]
    mastery: Mapping[str, MasteryEstimate]
    gaps: GapAnalysis
    learning_path: LearningPath | None

    def to_dict(self) -> dict[str, Any]:
        return _jsonable(self)


class IntelligencePipeline:
    def __init__(
        self,
        assessment: AssessmentService,
        graph: Any,
        mastery: MasteryEngine,
        *,
        root_causes: RootCauseEngine | None = None,
    ) -> None:
        self.assessment = assessment
        self.graph = graph
        self.mastery_engine = mastery
        self.root_engine = root_causes or RootCauseEngine()
        self.path_engine = LearningPathEngine(graph)

    def run(
        self,
        responses: Iterable[Response],
        *,
        target_concept_id: str | None = None,
        assigned_question_ids: Iterable[str] | None = None,
        path_version: int = 1,
        previous_path: LearningPath | None = None,
    ) -> PipelineResult:
        evidence = self.assessment.aggregate_evidence(responses, assigned_question_ids)
        mastery = self.mastery_engine.estimate_many(evidence.values())
        target = target_concept_id or self._select_target(mastery)
        gaps = self.root_engine.analyze(target, mastery, self.graph)
        path = None
        if previous_path is not None:
            if previous_path.target_id != target:
                raise ValueError("previous path target does not match this pipeline run")
            path = self.path_engine.recalculate(
                previous_path,
                mastery,
                version=path_version,
            )
        elif gaps.root_causes:
            root = gaps.root_causes[0]
            path = self.path_engine.plan(
                root.concept_id,
                target,
                mastery,
                root_probability=root.posterior_probability,
                version=path_version,
            )
        return PipelineResult(target, evidence, mastery, gaps, path)

    def _select_target(self, mastery: Mapping[str, MasteryEstimate]) -> str:
        weak = {
            concept_id
            for concept_id, estimate in mastery.items()
            if estimate.probability is not None and estimate.probability < 0.70
        }
        if not weak:
            assessed = set(mastery)
            if not assessed:
                raise ValueError("no assessed concepts are available")
            downstream = [
                concept_id
                for concept_id in assessed
                if not assessed.intersection(self.graph.descendants(concept_id))
            ]
            return min(downstream or assessed)
        downstream = [
            concept_id
            for concept_id in weak
            if not weak.intersection(self.graph.descendants(concept_id))
        ]
        return min(
            downstream or weak,
            key=lambda concept_id: (
                mastery[concept_id].probability,
                concept_id,
            ),
        )
