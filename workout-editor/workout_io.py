"""Leitura e gravação de workouts JSON do WOD Timer."""

from __future__ import annotations

import json
import re
from pathlib import Path

WOD_ROOT = Path(__file__).resolve().parent.parent
WORKOUTS_DIR = WOD_ROOT / "workouts"
INDEX_FILE = WORKOUTS_DIR / "index.json"

from constants import CATEGORIES, EXERCISE_VIEWS, MODES, WEIGHT_UNITS

ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify(text: str) -> str:
    value = text.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def list_workout_ids() -> list[str]:
    if INDEX_FILE.exists():
        data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        if isinstance(data.get("workouts"), list):
            return sorted(data["workouts"])
    return sorted(
        path.stem
        for path in WORKOUTS_DIR.glob("*.json")
        if not path.name.startswith("_") and path.name != "index.json"
    )


def load_workout(workout_id: str) -> dict:
    path = WORKOUTS_DIR / f"{workout_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Treino não encontrado: {workout_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def default_exercise() -> dict:
    return {
        "name": "",
        "reps": "",
        "weightM": "",
        "weightF": "",
        "restSeconds": "",
    }


def default_block() -> dict:
    return {
        "category": "wod",
        "mode": "fortime",
        "workSeconds": 60,
        "restSeconds": 15,
        "intervalSeconds": 60,
        "totalMinutes": 12,
        "timeCapMinutes": 0,
        "tabataRounds": 8,
        "exerciseView": "list",
        "exercises": [default_exercise()],
    }


def default_workout() -> dict:
    return {
        "id": "",
        "name": "",
        "description": "",
        "classic": False,
        "config": {
            "restBetweenBlocks": 0,
            "weightUnit": "lb",
            "blockList": [default_block()],
        },
    }


def normalize_exercise(raw: dict | None) -> dict:
    base = default_exercise()
    if not raw:
        return base
    for key in base:
        value = raw.get(key, "")
        base[key] = "" if value is None else str(value)
    return base


def normalize_block(raw: dict | None) -> dict:
    base = default_block()
    if not raw:
        return base
    for key in ("workSeconds", "restSeconds", "intervalSeconds", "totalMinutes", "timeCapMinutes", "tabataRounds"):
        if key in raw:
            base[key] = int(raw[key] or 0)
    if raw.get("category") in CATEGORIES:
        base["category"] = raw["category"]
    if raw.get("mode") in MODES:
        base["mode"] = raw["mode"]
    if raw.get("exerciseView") in EXERCISE_VIEWS:
        base["exerciseView"] = raw["exerciseView"]
    exercises = raw.get("exercises")
    if isinstance(exercises, list) and exercises:
        base["exercises"] = [normalize_exercise(item) for item in exercises]
    else:
        base["exercises"] = [default_exercise()]
    return base


def normalize_workout(raw: dict | None) -> dict:
    base = default_workout()
    if not raw:
        return base
    base["id"] = str(raw.get("id", "")).strip()
    base["name"] = str(raw.get("name", "")).strip()
    base["description"] = str(raw.get("description", "")).strip()
    base["classic"] = bool(raw.get("classic"))

    config = raw.get("config") or {}
    base["config"]["restBetweenBlocks"] = int(config.get("restBetweenBlocks") or 0)
    if config.get("weightUnit") in WEIGHT_UNITS:
        base["config"]["weightUnit"] = config["weightUnit"]

    block_list = config.get("blockList")
    if isinstance(block_list, list) and block_list:
        base["config"]["blockList"] = [normalize_block(block) for block in block_list]
    return base


def validate_workout(data: dict) -> list[str]:
    errors: list[str] = []
    workout_id = data.get("id", "").strip()
    name = data.get("name", "").strip()

    if not name:
        errors.append("Informe o nome do treino.")
    if not workout_id:
        errors.append("Informe o id (slug) do treino.")
    elif not ID_PATTERN.match(workout_id):
        errors.append("Id inválido: use letras minúsculas, números e hífens (ex: meu-treino).")

    blocks = data.get("config", {}).get("blockList", [])
    if not blocks:
        errors.append("Adicione ao menos um bloco ao treino.")
        return errors

    has_active_exercise = False
    for block in blocks:
        for ex in block.get("exercises", []):
            if str(ex.get("name", "")).strip() or str(ex.get("reps", "")).strip():
                has_active_exercise = True
                break
        if has_active_exercise:
            break
    if not has_active_exercise:
        errors.append("Adicione ao menos um exercício com nome ou repetições.")

    return errors


def update_index() -> int:
    WORKOUTS_DIR.mkdir(parents=True, exist_ok=True)
    ids = sorted(
        path.stem
        for path in WORKOUTS_DIR.glob("*.json")
        if not path.name.startswith("_") and path.name != "index.json"
    )
    INDEX_FILE.write_text(
        json.dumps({"workouts": ids}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return len(ids)


def save_workout(data: dict, *, update_index_file: bool = True) -> Path:
    errors = validate_workout(data)
    if errors:
        raise ValueError("\n".join(errors))

    workout_id = data["id"].strip()
    path = WORKOUTS_DIR / f"{workout_id}.json"
    WORKOUTS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    if update_index_file:
        update_index()
    return path
