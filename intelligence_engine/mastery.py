"""Evidence-aware mastery estimation with a tiny, dependency-free ML model."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import Enum
import json
import math
import random
from typing import Any, Iterable, Mapping, Sequence


class MasteryTier(str, Enum):
    CRITICAL_GAP = "CRITICAL_GAP"
    EMERGING = "EMERGING"
    DEVELOPING = "DEVELOPING"
    PROFICIENT = "PROFICIENT"
    MASTERED = "MASTERED"


def mastery_tier(probability: float) -> MasteryTier:
    if probability < 0.40:
        return MasteryTier.CRITICAL_GAP
    if probability < 0.55:
        return MasteryTier.EMERGING
    if probability < 0.70:
        return MasteryTier.DEVELOPING
    if probability < 0.85:
        return MasteryTier.PROFICIENT
    return MasteryTier.MASTERED


@dataclass(frozen=True)
class MasteryEstimate:
    concept_id: str
    probability: float | None
    confidence: float
    confidence_label: str
    tier: MasteryTier | None
    estimator: str
    statistical_probability: float | None
    model_probability: float | None
    effective_evidence: float
    explanations: tuple[str, ...]

    @property
    def score(self) -> float | None:
        return None if self.probability is None else round(self.probability * 100, 1)

    @property
    def can_progress(self) -> bool:
        return self.probability is not None and self.probability >= 0.70


FEATURE_NAMES = (
    "overall_accuracy",
    "weighted_accuracy",
    "recent_accuracy",
    "hard_accuracy",
    "log_effective_evidence",
    "recent_failure_rate",
    "hint_usage_rate",
    "mean_retry_count",
    "improvement_trend",
    "high_quality_evidence_share",
    "difficulty_coverage",
)


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def _sigmoid(value: float) -> float:
    if value >= 0:
        z = math.exp(-value)
        return 1.0 / (1.0 + z)
    z = math.exp(value)
    return z / (1.0 + z)


def _read(source: Any, *names: str, default: float = 0.0) -> float:
    for name in names:
        value = source.get(name) if isinstance(source, Mapping) else getattr(source, name, None)
        if value is not None:
            return float(value)
    return float(default)


def evidence_features(evidence: Any) -> dict[str, float]:
    overall = _clip(_read(evidence, "overall_accuracy", "accuracy"))
    weighted = _clip(
        _read(evidence, "weighted_accuracy", "difficulty_weighted_accuracy", default=overall)
    )
    recent = _clip(_read(evidence, "recent_accuracy", "recent_accuracy_5", default=overall))
    hard = _clip(_read(evidence, "hard_accuracy", default=0.5))
    effective = max(0.0, _read(evidence, "effective_evidence", "effective_weight", "response_count"))
    return {
        "overall_accuracy": overall,
        "weighted_accuracy": weighted,
        "recent_accuracy": recent,
        "hard_accuracy": hard,
        "log_effective_evidence": math.log1p(effective),
        "recent_failure_rate": _clip(_read(evidence, "recent_failure_rate", default=1.0 - recent)),
        "hint_usage_rate": _clip(_read(evidence, "hint_usage_rate")),
        "mean_retry_count": _clip(_read(evidence, "mean_retry_count") / 3.0),
        "improvement_trend": _clip(
            _read(evidence, "improvement_trend", "improvement_slope") + 0.5
        ),
        "high_quality_evidence_share": _clip(
            _read(evidence, "high_quality_evidence_share", default=1.0)
        ),
        "difficulty_coverage": _clip(_read(evidence, "difficulty_coverage", default=1.0 / 3.0)),
    }


@dataclass
class LogisticMasteryModel:
    """Small batch-gradient logistic regression; JSON-serializable and deterministic."""

    feature_names: tuple[str, ...] = FEATURE_NAMES
    weights: list[float] | None = None
    bias: float = 0.0
    means: list[float] | None = None
    scales: list[float] | None = None

    def fit(
        self,
        rows: Sequence[Mapping[str, float]],
        labels: Sequence[int],
        *,
        iterations: int = 350,
        learning_rate: float = 0.08,
        l2: float = 0.01,
    ) -> "LogisticMasteryModel":
        if not rows or len(rows) != len(labels):
            raise ValueError("rows and labels must be non-empty and have equal length")
        matrix = [[float(row[name]) for name in self.feature_names] for row in rows]
        width = len(self.feature_names)
        self.means = [sum(row[j] for row in matrix) / len(matrix) for j in range(width)]
        self.scales = []
        for j, mean in enumerate(self.means):
            variance = sum((row[j] - mean) ** 2 for row in matrix) / len(matrix)
            self.scales.append(max(math.sqrt(variance), 1e-6))
        standardized = [
            [(row[j] - self.means[j]) / self.scales[j] for j in range(width)]
            for row in matrix
        ]
        self.weights = [0.0] * width
        self.bias = 0.0
        count = float(len(standardized))
        for _ in range(iterations):
            grad = [0.0] * width
            bias_grad = 0.0
            for row, label in zip(standardized, labels):
                prediction = _sigmoid(self.bias + sum(w * x for w, x in zip(self.weights, row)))
                error = prediction - int(label)
                bias_grad += error
                for j, value in enumerate(row):
                    grad[j] += error * value
            for j in range(width):
                grad[j] = grad[j] / count + l2 * self.weights[j]
                self.weights[j] -= learning_rate * grad[j]
            self.bias -= learning_rate * bias_grad / count
        return self

    @property
    def trained(self) -> bool:
        return self.weights is not None and self.means is not None and self.scales is not None

    def predict_probability(self, features: Mapping[str, float]) -> float:
        if not self.trained:
            raise RuntimeError("mastery model is not trained")
        assert self.weights is not None and self.means is not None and self.scales is not None
        row = [
            (float(features[name]) - self.means[j]) / self.scales[j]
            for j, name in enumerate(self.feature_names)
        ]
        return _clip(_sigmoid(self.bias + sum(w * x for w, x in zip(self.weights, row))))

    def to_json(self) -> str:
        if not self.trained:
            raise RuntimeError("mastery model is not trained")
        return json.dumps(asdict(self), sort_keys=True)

    @classmethod
    def from_json(cls, payload: str) -> "LogisticMasteryModel":
        data = json.loads(payload)
        data["feature_names"] = tuple(data["feature_names"])
        return cls(**data)


def synthetic_training_data(
    sample_count: int = 1800,
    *,
    seed: int = 42,
) -> tuple[list[dict[str, float]], list[int]]:
    """Generate histories and future diagnostic outcomes from a hidden ability."""
    rng = random.Random(seed)
    rows: list[dict[str, float]] = []
    labels: list[int] = []
    for _ in range(sample_count):
        ability = rng.betavariate(2.0, 2.0)
        evidence_count = rng.randint(3, 24)
        quality = rng.uniform(0.35, 1.0)
        trend = rng.gauss(0.0, 0.09)
        overall = _clip(ability + rng.gauss(0.0, 0.11))
        weighted = _clip(ability + rng.gauss(0.0, 0.08))
        recent = _clip(ability + trend + rng.gauss(0.0, 0.08))
        hard = _clip(ability - 0.12 + rng.gauss(0.0, 0.10))
        hint_rate = _clip((1.0 - ability) * 0.65 + rng.gauss(0.0, 0.08))
        retry_rate = _clip((1.0 - ability) * 0.55 + rng.gauss(0.0, 0.08))
        coverage = _clip(evidence_count / 12.0)
        rows.append(
            {
                "overall_accuracy": overall,
                "weighted_accuracy": weighted,
                "recent_accuracy": recent,
                "hard_accuracy": hard,
                "log_effective_evidence": math.log1p(evidence_count * quality),
                "recent_failure_rate": _clip(1.0 - recent + rng.gauss(0.0, 0.04)),
                "hint_usage_rate": hint_rate,
                "mean_retry_count": retry_rate,
                "improvement_trend": _clip(trend + 0.5),
                "high_quality_evidence_share": quality,
                "difficulty_coverage": coverage,
            }
        )
        future_probability = _clip(0.18 + 0.72 * _sigmoid(5.0 * (ability + trend - 0.5)))
        labels.append(1 if rng.random() < future_probability else 0)
    return rows, labels


def train_default_model(sample_count: int = 1800, seed: int = 42) -> LogisticMasteryModel:
    rows, labels = synthetic_training_data(sample_count, seed=seed)
    return LogisticMasteryModel().fit(rows, labels)


class MasteryEngine:
    def __init__(self, model: LogisticMasteryModel | None = None, *, minimum_evidence: float = 2.0):
        self.model = model
        self.minimum_evidence = minimum_evidence

    def estimate(self, evidence: Any) -> MasteryEstimate:
        concept_id = str(
            evidence.get("concept_id", "")
            if isinstance(evidence, Mapping)
            else getattr(evidence, "concept_id", "")
        )
        features = evidence_features(evidence)
        effective = max(0.0, _read(evidence, "effective_evidence", "effective_weight", "response_count"))
        weighted_accuracy = features["weighted_accuracy"]
        alpha = 1.0 + weighted_accuracy * effective
        beta = 1.0 + (1.0 - weighted_accuracy) * effective
        statistical = alpha / (alpha + beta)

        count_confidence = 1.0 - math.exp(-effective / 6.0)
        coverage_confidence = 0.5 + 0.5 * features["difficulty_coverage"]
        confidence = _clip(count_confidence * coverage_confidence)
        confidence_label = "LOW" if confidence < 0.40 else "MEDIUM" if confidence < 0.75 else "HIGH"

        if effective < self.minimum_evidence:
            return MasteryEstimate(
                concept_id=concept_id,
                probability=None,
                confidence=confidence,
                confidence_label="LOW",
                tier=None,
                estimator="INSUFFICIENT_EVIDENCE",
                statistical_probability=statistical,
                model_probability=None,
                effective_evidence=effective,
                explanations=("Insufficient evidence to classify this concept.",),
            )

        model_probability = None
        estimator = "STATISTICAL_FALLBACK"
        if self.model is not None and self.model.trained:
            model_probability = self.model.predict_probability(features)
            probability = confidence * model_probability + (1.0 - confidence) * statistical
            estimator = "LOGISTIC_HYBRID_V1"
        else:
            probability = statistical

        tier = mastery_tier(probability)
        explanations = [
            f"{effective:.1f} effective responses support this estimate.",
            f"The concept is classified as {tier.value.replace('_', ' ').title()}.",
        ]
        if estimator == "STATISTICAL_FALLBACK":
            explanations.append("The statistical fallback was used; no trained model was available.")
        elif model_probability is not None:
            explanations.append("The ML estimate was blended with statistical evidence according to evidence confidence.")
        return MasteryEstimate(
            concept_id=concept_id,
            probability=_clip(probability),
            confidence=confidence,
            confidence_label=confidence_label,
            tier=tier,
            estimator=estimator,
            statistical_probability=statistical,
            model_probability=model_probability,
            effective_evidence=effective,
            explanations=tuple(explanations),
        )

    def estimate_many(self, evidence: Iterable[Any]) -> dict[str, MasteryEstimate]:
        estimates = [self.estimate(item) for item in evidence]
        return {estimate.concept_id: estimate for estimate in estimates}
