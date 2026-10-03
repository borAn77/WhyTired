"""Loads the synthetic persona files into memory and builds the list of days the engine sees.

The backend is stateless: every request says which persona, which "today" (time travel),
which future branch and which data level to use. This module turns that into a plain
list of DayRecords, so the engine functions never deal with files or requests.
"""

from __future__ import annotations

import datetime as dt
from functools import lru_cache
from pathlib import Path

from .models import CheckIn, DataLevel, DayRecord, PersonaFile, Scenario

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache
def load_personas() -> dict[str, PersonaFile]:
    personas: dict[str, PersonaFile] = {}
    for path in sorted(DATA_DIR.glob("*.json")):
        persona = PersonaFile.model_validate_json(path.read_text(encoding="utf-8"))
        personas[persona.profile.id] = persona
    return personas


def get_persona(persona_id: str) -> PersonaFile:
    personas = load_personas()
    if persona_id not in personas:
        raise KeyError(persona_id)
    return personas[persona_id]


def days_until(
    persona: PersonaFile,
    today: dt.date,
    scenario: Scenario,
    checkins: dict[dt.date, CheckIn] | None = None,
) -> list[DayRecord]:
    """History plus the chosen future branch, cut at `today`.

    Check-ins logged in the app replace the synthetic check-in for the same date.
    """
    days = [*persona.history, *persona.future.get(scenario, [])]
    visible = [day for day in days if day.date <= today]
    if checkins:
        visible = [
            day.model_copy(update={"checkin": checkins[day.date]}) if day.date in checkins else day
            for day in visible
        ]
    return visible


def restrict_to_level(days: list[DayRecord], level: DataLevel) -> list[DayRecord]:
    """No-watch mode: hide the fields the chosen data level does not have.

    basic  = check-ins + logged sessions
    medium = basic + phone steps + manual pulse
    full   = medium + smartwatch data
    """
    if level == "full":
        return days
    hidden: dict = {"watch": None}
    if level == "basic":
        hidden |= {"steps": None, "manual_pulse": None}
    return [day.model_copy(update=hidden) for day in days]
