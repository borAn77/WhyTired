"""Integration tests on the committed persona files: the demo story must hold end to end."""

import datetime as dt

import pytest

from app import store
from app.engine.artifacts import clean
from app.engine.detective import run_detective
from app.engine.experiment import evaluate_experiment
from app.models import Experiment
from scripts.generate_personas import DATA_DIR, DEMO_DAY, build_all

D7 = DEMO_DAY + dt.timedelta(days=7)


def detective(persona_id: str, level: str = "full", today: dt.date = DEMO_DAY):
    persona = store.get_persona(persona_id)
    return run_detective(store.restrict_to_level(store.days_until(persona, today, "not_improved"), level))


def experiment_result(persona_id: str, cause_id: str, scenario: str, level: str = "full"):
    persona = store.get_persona(persona_id)
    days, _ = clean(store.restrict_to_level(store.days_until(persona, D7, scenario), level))
    experiment = Experiment(cause_id=cause_id, start=DEMO_DAY + dt.timedelta(days=1))
    return evaluate_experiment(days, experiment, D7)


def test_committed_files_match_the_generator():
    for persona in build_all():
        committed = (DATA_DIR / f"{persona.profile.id}.json").read_text(encoding="utf-8")
        assert committed == persona.model_dump_json(indent=1) + "\n", (
            "Data files are out of date: run `uv run python -m scripts.generate_personas`"
        )


def test_kasia_detective_story():
    result = detective("kasia")
    assert result.triggered and result.low_energy_days == 5
    assert [(c.id, c.confidence) for c in result.causes] == [
        ("load_spike", "high"),
        ("rhr_elevated", "medium"),
        ("sleep_debt", "medium"),  # late caffeine on her 5 tired days
    ]
    assert result.causes[0].history_check.period_tag == "holiday"
    artifact_night = DEMO_DAY - dt.timedelta(days=10)
    assert {(p.date, p.metric) for p in result.excluded} == {(artifact_night, "sleep"), (artifact_night, "resting_hr")}


def test_kasia_without_watch_is_medium():
    result = detective("kasia", level="basic")
    assert [(c.id, c.confidence) for c in result.causes] == [("load_spike", "medium"), ("sleep_debt", "low")]


def test_kasia_not_triggered_before_the_low_days():
    assert not detective("kasia", today=DEMO_DAY - dt.timedelta(days=6)).triggered


def test_tomek_detective_story():
    result = detective("tomek")
    assert result.triggered and result.data_level == "basic"
    assert result.causes[0].id == "sleep_debt"
    assert {c.confidence for c in result.causes} <= {"medium", "low"}
    assert result.suggested_experiment.cause_id == "sleep_debt"


@pytest.mark.parametrize(
    "persona_id, cause_id",
    [("kasia", "load_spike"), ("tomek", "sleep_debt")],
)
@pytest.mark.parametrize("scenario", ["not_improved", "improved"])
def test_experiment_branches(persona_id, cause_id, scenario):
    assert experiment_result(persona_id, cause_id, scenario).status == scenario
