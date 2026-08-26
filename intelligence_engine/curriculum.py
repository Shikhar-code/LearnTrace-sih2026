"""Curated Class 9-10 chapter competency graph owned by the intelligence layer."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

from .concept_graph import Concept, ConceptGraph, Dependency


CURRICULUM_VERSION = "NCERT_CLASS_9_10_CHAPTERS_V1"


def _slug(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def concept_id(class_level: int, subject: str, chapter: str) -> str:
    """Return a stable ID independent of PostgreSQL row IDs."""
    return f"class-{int(class_level)}:{_slug(subject)}:{_slug(chapter)}"


CHAPTERS: dict[tuple[int, str], tuple[str, ...]] = {
    (9, "Mathematics"): (
        "Orienting Yourself: The Use of Coordinates",
        "Introduction to Linear Polynomials",
        "The World of Numbers",
        "Exploring Algebraic Identities",
        "I’m Up and Down, and Round and Round",
        "Measuring Space: Perimeter and Area",
        "The Mathematics of Maybe: Introduction to Probability",
        "Predicting What Comes Next: Exploring Sequences and Progressions",
    ),
    (9, "Science"): (
        "Exploration: Entering the World of Secondary Science",
        "Cell: The Building Block of Life",
        "Tissues in Action",
        "Describing Motion Around Us",
        "Exploring Mixtures and their Separation",
        "How Forces Affect Motion",
        "Work, Energy, and Simple Machines",
        "Journey Inside the Atom",
        "Atomic Foundations of Matter",
        "Sound Waves: Characteristics and Applications",
        "Reproduction: How Life Continues",
        "Patterns in Life: Diversity and Classification",
        "Earth as a System: Energy, Matter, and Life",
    ),
    (10, "Mathematics"): (
        "Real Numbers",
        "Polynomials",
        "Pair of Linear Equations in Two Variables",
        "Quadratic Equations",
        "Arithmetic Progressions",
        "Triangles",
        "Coordinate Geometry",
        "Introduction to Trigonometry",
        "Some Applications of Trigonometry",
        "Circles",
        "Areas Related to Circles",
        "Surface Areas and Volumes",
        "Statistics",
        "Probability",
        "Appendix A1: Proofs in Mathematics",
        "Appendix A2: Mathematical Modelling",
    ),
    (10, "Science"): (
        "Chemical Reactions and Equations",
        "Acids, Bases and Salts",
        "Metals and Non-metals",
        "Carbon and its Compounds",
        "Life Processes",
        "Control and Coordination",
        "How do Organisms Reproduce?",
        "Heredity",
        "Light – Reflection and Refraction",
        "The Human Eye and the Colourful World",
        "Electricity",
        "Magnetic Effects of Electric Current",
        "Our Environment",
    ),
}


# ponytail: chapter-level edges are the hackathon ceiling; replace them with
# subject-expert-reviewed topic edges when the backend's topic catalogue stabilizes.
# (class, subject, concept, prerequisite, influence weight)
DEPENDENCIES: tuple[tuple[int, str, str, str, float], ...] = (
    # Class 9 Mathematics
    (9, "Mathematics", "Introduction to Linear Polynomials", "The World of Numbers", 0.85),
    (9, "Mathematics", "Exploring Algebraic Identities", "Introduction to Linear Polynomials", 0.90),
    (9, "Mathematics", "Orienting Yourself: The Use of Coordinates", "The World of Numbers", 0.70),
    (9, "Mathematics", "I’m Up and Down, and Round and Round", "Orienting Yourself: The Use of Coordinates", 0.70),
    (9, "Mathematics", "Measuring Space: Perimeter and Area", "I’m Up and Down, and Round and Round", 0.80),
    (9, "Mathematics", "The Mathematics of Maybe: Introduction to Probability", "The World of Numbers", 0.65),
    (9, "Mathematics", "Predicting What Comes Next: Exploring Sequences and Progressions", "Introduction to Linear Polynomials", 0.80),
    # Class 9 Science
    (9, "Science", "Cell: The Building Block of Life", "Exploration: Entering the World of Secondary Science", 0.60),
    (9, "Science", "Tissues in Action", "Cell: The Building Block of Life", 0.90),
    (9, "Science", "Reproduction: How Life Continues", "Cell: The Building Block of Life", 0.80),
    (9, "Science", "Patterns in Life: Diversity and Classification", "Cell: The Building Block of Life", 0.65),
    (9, "Science", "Exploring Mixtures and their Separation", "Atomic Foundations of Matter", 0.75),
    (9, "Science", "Atomic Foundations of Matter", "Journey Inside the Atom", 0.90),
    (9, "Science", "How Forces Affect Motion", "Describing Motion Around Us", 0.90),
    (9, "Science", "Work, Energy, and Simple Machines", "How Forces Affect Motion", 0.85),
    (9, "Science", "Sound Waves: Characteristics and Applications", "Describing Motion Around Us", 0.70),
    (9, "Science", "Earth as a System: Energy, Matter, and Life", "Patterns in Life: Diversity and Classification", 0.65),
    (9, "Science", "Earth as a System: Energy, Matter, and Life", "Atomic Foundations of Matter", 0.55),
    # Class 10 Mathematics
    (10, "Mathematics", "Polynomials", "Real Numbers", 0.80),
    (10, "Mathematics", "Pair of Linear Equations in Two Variables", "Polynomials", 0.85),
    (10, "Mathematics", "Quadratic Equations", "Polynomials", 0.90),
    (10, "Mathematics", "Arithmetic Progressions", "Pair of Linear Equations in Two Variables", 0.65),
    (10, "Mathematics", "Coordinate Geometry", "Pair of Linear Equations in Two Variables", 0.70),
    (10, "Mathematics", "Introduction to Trigonometry", "Triangles", 0.90),
    (10, "Mathematics", "Some Applications of Trigonometry", "Introduction to Trigonometry", 0.95),
    (10, "Mathematics", "Circles", "Triangles", 0.80),
    (10, "Mathematics", "Areas Related to Circles", "Circles", 0.90),
    (10, "Mathematics", "Surface Areas and Volumes", "Areas Related to Circles", 0.80),
    (10, "Mathematics", "Statistics", "Real Numbers", 0.55),
    (10, "Mathematics", "Probability", "Statistics", 0.80),
    (10, "Mathematics", "Appendix A1: Proofs in Mathematics", "Triangles", 0.50),
    (10, "Mathematics", "Appendix A2: Mathematical Modelling", "Pair of Linear Equations in Two Variables", 0.60),
    (10, "Mathematics", "Appendix A2: Mathematical Modelling", "Statistics", 0.55),
    # Class 10 Science
    (10, "Science", "Acids, Bases and Salts", "Chemical Reactions and Equations", 0.85),
    (10, "Science", "Metals and Non-metals", "Chemical Reactions and Equations", 0.80),
    (10, "Science", "Carbon and its Compounds", "Chemical Reactions and Equations", 0.75),
    (10, "Science", "Control and Coordination", "Life Processes", 0.85),
    (10, "Science", "How do Organisms Reproduce?", "Life Processes", 0.80),
    (10, "Science", "Heredity", "How do Organisms Reproduce?", 0.90),
    (10, "Science", "The Human Eye and the Colourful World", "Light – Reflection and Refraction", 0.90),
    (10, "Science", "Magnetic Effects of Electric Current", "Electricity", 0.95),
    (10, "Science", "Our Environment", "Life Processes", 0.65),
    (10, "Science", "Our Environment", "Carbon and its Compounds", 0.55),
)


def build_curriculum_graph(extra_concepts: Iterable[Concept] = ()) -> ConceptGraph:
    concepts = [
        Concept(concept_id(level, subject, chapter), chapter)
        for (level, subject), chapters in CHAPTERS.items()
        for chapter in chapters
    ]
    known = {concept.id for concept in concepts}
    for concept in extra_concepts:
        if concept.id not in known:
            concepts.append(concept)
            known.add(concept.id)
    dependencies = [
        Dependency(
            concept_id(level, subject, concept),
            concept_id(level, subject, prerequisite),
            weight,
        )
        for level, subject, concept, prerequisite, weight in DEPENDENCIES
    ]
    return ConceptGraph(concepts, dependencies)


__all__ = [
    "CHAPTERS",
    "CURRICULUM_VERSION",
    "DEPENDENCIES",
    "build_curriculum_graph",
    "concept_id",
]
