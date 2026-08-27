"""Train and save the reproducible dependency-free mastery model."""

from pathlib import Path

from .mastery import train_default_model


ARTIFACT_PATH = Path(__file__).with_name("artifacts") / "mastery_model_v1.json"


def train_and_save(path: Path = ARTIFACT_PATH) -> Path:
    model = train_default_model(sample_count=2400, seed=42)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(model.to_json() + "\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    print(train_and_save())
