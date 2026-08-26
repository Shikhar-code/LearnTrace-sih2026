"""Small, dependency-free prerequisite graph for the LearnTrace engines.

The edge orientation is ``concept -> prerequisite``.  For example, an edge
``algebra -> arithmetic`` means that arithmetic must be learned first.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from math import isfinite
from typing import Any


@dataclass(frozen=True, slots=True)
class Concept:
    """A graph node.  ``name`` is display metadata and is not used by the graph."""

    id: str
    name: str = ""


@dataclass(frozen=True, slots=True)
class Dependency:
    """An edge from a concept to one of its prerequisites."""

    concept_id: str
    prerequisite_id: str
    weight: float = 1.0


class ConceptGraph:
    """Validated prerequisite DAG with deterministic traversal helpers."""

    def __init__(
        self,
        concepts: Iterable[Concept | str | Mapping[str, Any]],
        dependencies: Iterable[Dependency | Mapping[str, Any]] = (),
    ) -> None:
        self._concepts = self._read_concepts(concepts)
        self._prerequisites: dict[str, dict[str, float]] = {
            concept_id: {} for concept_id in self._concepts
        }
        self._dependents: dict[str, dict[str, float]] = {
            concept_id: {} for concept_id in self._concepts
        }
        self._read_dependencies(dependencies)
        self._topological_order = self._topological_sort(set(self._concepts))

    @staticmethod
    def _read_concepts(
        concepts: Iterable[Concept | str | Mapping[str, Any]],
    ) -> dict[str, Concept]:
        result: dict[str, Concept] = {}
        for value in concepts:
            if isinstance(value, Concept):
                concept = value
            elif isinstance(value, str):
                concept = Concept(value)
            elif isinstance(value, Mapping):
                concept = Concept(str(value["id"]), str(value.get("name", "")))
            else:
                raise TypeError("concepts must contain Concept, string, or mapping values")
            if not concept.id:
                raise ValueError("concept id must not be empty")
            if concept.id in result:
                raise ValueError(f"duplicate concept: {concept.id}")
            result[concept.id] = concept
        return result

    def _read_dependencies(
        self,
        dependencies: Iterable[Dependency | Mapping[str, Any]],
    ) -> None:
        seen: set[tuple[str, str]] = set()
        for value in dependencies:
            if isinstance(value, Dependency):
                edge = value
            elif isinstance(value, Mapping):
                edge = Dependency(
                    str(value["concept_id"]),
                    str(value["prerequisite_id"]),
                    float(value.get("weight", 1.0)),
                )
            else:
                raise TypeError("dependencies must contain Dependency or mapping values")

            pair = (edge.concept_id, edge.prerequisite_id)
            if edge.concept_id not in self._concepts or edge.prerequisite_id not in self._concepts:
                raise ValueError(f"dependency references missing concept: {pair}")
            if edge.concept_id == edge.prerequisite_id:
                raise ValueError(f"self-dependency is not allowed: {edge.concept_id}")
            if pair in seen:
                raise ValueError(f"duplicate dependency: {pair}")
            if not isfinite(edge.weight) or not 0 < edge.weight <= 1:
                raise ValueError(f"dependency weight must be finite and in (0, 1]: {edge.weight}")
            seen.add(pair)
            self._prerequisites[edge.concept_id][edge.prerequisite_id] = edge.weight
            self._dependents[edge.prerequisite_id][edge.concept_id] = edge.weight

    def _require(self, concept_id: str) -> None:
        if concept_id not in self._concepts:
            raise KeyError(f"unknown concept: {concept_id}")

    def _topological_sort(self, nodes: set[str]) -> tuple[str, ...]:
        indegree = {
            node: sum(prerequisite in nodes for prerequisite in self._prerequisites[node])
            for node in nodes
        }
        ready = sorted(node for node, degree in indegree.items() if degree == 0)
        order: list[str] = []
        while ready:
            node = ready.pop(0)
            order.append(node)
            for dependent in sorted(self._dependents[node]):
                if dependent not in indegree:
                    continue
                indegree[dependent] -= 1
                if indegree[dependent] == 0:
                    ready.append(dependent)
                    ready.sort()
        if len(order) != len(nodes):
            raise ValueError("concept dependencies contain a cycle")
        return tuple(order)

    def concepts(self) -> tuple[Concept, ...]:
        """Return concepts in deterministic ID order."""

        return tuple(self._concepts[concept_id] for concept_id in sorted(self._concepts))

    def dependencies(self) -> tuple[Dependency, ...]:
        """Return dependency edges in deterministic prerequisite-first order."""

        return tuple(
            Dependency(concept_id, prerequisite_id, weight)
            for concept_id in self._topological_order
            for prerequisite_id, weight in sorted(self._prerequisites[concept_id].items())
        )

    def prerequisites(self, concept_id: str) -> tuple[str, ...]:
        self._require(concept_id)
        return tuple(sorted(self._prerequisites[concept_id]))

    def dependents(self, concept_id: str) -> tuple[str, ...]:
        self._require(concept_id)
        return tuple(sorted(self._dependents[concept_id]))

    def ancestors(self, concept_id: str) -> tuple[str, ...]:
        self._require(concept_id)
        found: set[str] = set()
        stack = list(self.prerequisites(concept_id))
        while stack:
            current = stack.pop()
            if current in found:
                continue
            found.add(current)
            stack.extend(self.prerequisites(current))
        return tuple(node for node in self._topological_order if node in found)

    def descendants(self, concept_id: str) -> tuple[str, ...]:
        self._require(concept_id)
        found: set[str] = set()
        stack = list(self.dependents(concept_id))
        while stack:
            current = stack.pop()
            if current in found:
                continue
            found.add(current)
            stack.extend(self.dependents(current))
        return tuple(node for node in self._topological_order if node in found)

    def topological_sort(self, nodes: Iterable[str] | None = None) -> tuple[str, ...]:
        """Return prerequisite-first order, optionally restricted to a node set."""

        selected = set(self._concepts) if nodes is None else set(nodes)
        unknown = selected.difference(self._concepts)
        if unknown:
            raise KeyError(f"unknown concepts: {sorted(unknown)}")
        return self._topological_sort(selected)

    def immediate_prerequisite_branches(self, concept_id: str) -> tuple[tuple[str, ...], ...]:
        """Return each immediate prerequisite and its upstream ancestor branch."""

        self._require(concept_id)
        return tuple(
            (prerequisite,) + self.ancestors(prerequisite)
            for prerequisite in self.prerequisites(concept_id)
        )

    def branch_nodes(self, prerequisite: str, target: str) -> tuple[str, ...]:
        """Return the upstream branch rooted at ``prerequisite`` through ``target``."""

        self._require(prerequisite)
        self._require(target)
        if prerequisite not in self.ancestors(target):
            raise ValueError(f"{prerequisite} is not a prerequisite of {target}")
        return tuple(
            node for node in self._topological_order
            if node == target or node == prerequisite or node in self.ancestors(prerequisite)
        )

    def influence(self, source: str, target: str, decay: float = 0.85) -> float:
        """Calculate noisy-OR prerequisite influence from ``source`` to ``target``."""

        self._require(source)
        self._require(target)
        if not isfinite(decay) or not 0 < decay <= 1:
            raise ValueError("decay must be finite and in (0, 1]")
        if source == target:
            return 1.0
        if source not in self.ancestors(target):
            return 0.0

        values: dict[str, float] = {source: 1.0}
        relevant = set(self.ancestors(target)) | {target}
        for node in self._topological_order:
            if node not in relevant or node == source:
                continue
            values[node] = 1.0
            for prerequisite, weight in self._prerequisites[node].items():
                values[node] *= 1.0 - decay * weight * values.get(prerequisite, 0.0)
            values[node] = 1.0 - values[node]
        return values.get(target, 0.0)

    def paths(
        self,
        root: str,
        target: str,
        max_paths: int = 5,
        max_depth: int = 8,
    ) -> tuple[tuple[str, ...], ...]:
        """Return bounded simple prerequisite-to-target paths."""

        self._require(root)
        self._require(target)
        if max_paths < 1 or max_depth < 1:
            raise ValueError("max_paths and max_depth must be positive")
        if root == target:
            return ((root,),)
        if root not in self.ancestors(target):
            return ()

        result: list[tuple[str, ...]] = []
        target_ancestors = set(self.ancestors(target)) | {target}

        def visit(node: str, path: list[str]) -> None:
            if len(result) >= max_paths or len(path) > max_depth:
                return
            if node == target:
                result.append(tuple(path))
                return
            for dependent in self.dependents(node):
                if dependent in target_ancestors and dependent not in path:
                    visit(dependent, path + [dependent])

        visit(root, [root])
        return tuple(result)

    candidate_paths = paths
    root_to_target_paths = paths


__all__ = ["Concept", "Dependency", "ConceptGraph"]
