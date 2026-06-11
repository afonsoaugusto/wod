"""Constantes e rótulos compartilhados com o WOD Timer web."""

from __future__ import annotations

MODES = ("sequential", "emom", "tabata", "amrap", "fortime")
MODE_LABELS = {
    "sequential": "Sequencial",
    "emom": "EMOM",
    "tabata": "Tabata",
    "amrap": "AMRAP",
    "fortime": "For Time",
}

CATEGORIES = ("alongamento", "tecnica", "wod")
CATEGORY_LABELS = {
    "alongamento": "Alongamento",
    "tecnica": "Técnica",
    "wod": "WOD",
}

WEIGHT_UNITS = ("lb", "kg")
EXERCISE_VIEWS = ("list", "cards")
EXERCISE_VIEW_LABELS = {
    "list": "Lista completa",
    "cards": "Card a card",
}
