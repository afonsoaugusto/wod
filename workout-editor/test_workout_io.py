#!/usr/bin/env python3
"""Testes do módulo workout_io."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import workout_io as io


class WorkoutIoTests(unittest.TestCase):
    def test_slugify(self) -> None:
        self.assertEqual(io.slugify("Meu Treino RX"), "meu-treino-rx")

    def test_validate_requires_name_and_exercise(self) -> None:
        data = io.default_workout()
        errors = io.validate_workout(data)
        self.assertTrue(any("nome" in item.lower() for item in errors))
        self.assertTrue(any("exercício" in item.lower() for item in errors))

    def test_save_and_update_index(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workouts_dir = Path(tmp)
            index_file = workouts_dir / "index.json"
            with patch.object(io, "WORKOUTS_DIR", workouts_dir), patch.object(io, "INDEX_FILE", index_file):
                data = io.default_workout()
                data["id"] = "teste-app"
                data["name"] = "Teste App"
                data["config"]["blockList"][0]["exercises"][0]["name"] = "Burpee"
                data["config"]["blockList"][0]["exercises"][0]["reps"] = "10"

                path = io.save_workout(data)
                self.assertTrue(path.exists())
                index = json.loads(index_file.read_text(encoding="utf-8"))
                self.assertEqual(index["workouts"], ["teste-app"])


if __name__ == "__main__":
    unittest.main()
