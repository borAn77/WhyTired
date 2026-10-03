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


# ---------- data checks on the generated files (no engine) ----------
# docs/PERSONAS_BRIEF.md, "Validation". Covered above, so not repeated here: Tomek's data level
# "basic" (test_tomek_detective_story) and the artifact night being excluded by the engine
# (test_kasia_detective_story).

KASIA, TOMEK = build_all()
ARTIFACT_NIGHT = dt.date(2026, 9, 24)
LONG_RUN_DAY = dt.date(2026, 10, 3)


def checkins(persona):
    return [day.checkin for day in persona.history if day.checkin]


def mean(values):
    values = list(values)
    return sum(values) / len(values)


def test_generating_twice_gives_byte_identical_files(tmp_path, monkeypatch):
    import scripts.generate_personas as generator

    runs = []
    for run in ("first", "second"):
        monkeypatch.setattr(generator, "DATA_DIR", tmp_path / run)
        generator.main()
        runs.append({path.name: path.read_bytes() for path in sorted((tmp_path / run).iterdir())})
    assert runs[0] == runs[1]
    assert set(runs[0]) == {"kasia.json", "tomek.json"}


@pytest.mark.parametrize(
    "persona, missed",
    [
        (KASIA, {dt.date(2026, 7, 18), dt.date(2026, 8, 29)}),
        (TOMEK, {dt.date(2026, 7, 12), dt.date(2026, 7, 26), dt.date(2026, 8, 15)}),
    ],
    ids=["kasia", "tomek"],
)
def test_90_consecutive_days_with_only_the_planned_missing_checkins(persona, missed):
    dates = [day.date for day in persona.history]
    assert dates == [DEMO_DAY - dt.timedelta(days=89 - i) for i in range(90)]
    assert {day.date for day in persona.history if day.checkin is None} == missed


@pytest.mark.parametrize("persona", [KASIA, TOMEK], ids=["kasia", "tomek"])
def test_checkins_and_sessions_are_in_range(persona):
    for c in checkins(persona):
        assert 1 <= c.energy <= 5 and 1 <= c.stress <= 5
        assert 4.5 <= c.sleep_hours <= 9.5
    for day in persona.history:
        for session in day.sessions:
            assert 20 <= session.duration_min <= 125 and 1 <= session.rpe <= 10
        assert sum(s.duration_min * s.rpe for s in day.sessions) <= 900  # one day's load


def test_kasia_watch_values_are_in_range_except_the_artifact_night():
    for day in KASIA.history:
        if day.date == ARTIFACT_NIGHT:
            continue
        watch = day.watch
        assert 30 <= watch.resting_hr <= 120
        assert 5 <= watch.hrv_ms <= 250
        assert 6 * 60 <= watch.sleep_min <= 9 * 60
        assert watch.sleep_coverage >= 0.9


def test_tomek_has_no_watch_data():
    assert not TOMEK.profile.has_watch
    for day in TOMEK.history + TOMEK.future["improved"] + TOMEK.future["not_improved"]:
        assert day.watch is None and day.steps is None and day.manual_pulse is None


def test_kasia_holiday_week_resting_hr_is_at_least_5_bpm_lower():
    i = [n for n, day in enumerate(KASIA.history) if "holiday" in day.tags]
    assert len(i) == 7 and i == list(range(i[0], i[0] + 7))
    rhr = lambda days: mean(day.watch.resting_hr for day in days)
    holiday = rhr(KASIA.history[i[0] : i[-1] + 1])
    assert holiday <= rhr(KASIA.history[i[0] - 7 : i[0]]) - 5  # the week before
    assert holiday <= rhr(KASIA.history[i[-1] + 1 : i[-1] + 8]) - 5  # the week after


def test_kasia_load_spike_and_long_run_before_demo_day():
    minutes = lambda days: sum(s.duration_min for day in days for s in day.sessions)
    assert minutes(KASIA.history[-7:]) / 7 >= 1.3 * minutes(KASIA.history[-28:]) / 28
    long_run = next(day for day in KASIA.history if day.date == LONG_RUN_DAY).sessions
    longest_before = max(
        s.duration_min
        for day in KASIA.history
        if LONG_RUN_DAY - dt.timedelta(days=30) <= day.date < LONG_RUN_DAY
        for s in day.sessions
    )
    assert [s.duration_min for s in long_run] == [110]
    assert long_run[0].duration_min > 1.1 * longest_before  # Garmin-RUNSAFE single-session rule


def test_tomek_exam_sleep_is_at_least_1_5_h_below_his_summer():
    exams = [day.checkin.sleep_hours for day in TOMEK.history if "exams" in day.tags]
    summer = [day.checkin.sleep_hours for day in TOMEK.history if day.checkin and day.date.month in (7, 8)]
    assert len(exams) == 12
    assert mean(exams) <= mean(summer) - 1.5


def test_exactly_one_artifact_night():
    """A resting-HR jump of more than 25 bpm from the night before happens once: 2026-09-24.
    The next night is back on trend, and her check-in that morning is normal."""
    days = KASIA.history
    jumps = [b.date for a, b in zip(days, days[1:]) if b.watch.resting_hr - a.watch.resting_hr > 25]
    assert jumps == [ARTIFACT_NIGHT]
    i = next(n for n, day in enumerate(days) if day.date == ARTIFACT_NIGHT)
    night = days[i]
    assert (night.watch.resting_hr, night.watch.hrv_ms, night.checkin.energy) == (88, 18, 4)
    assert abs(days[i + 1].watch.resting_hr - days[i - 1].watch.resting_hr) <= 5
