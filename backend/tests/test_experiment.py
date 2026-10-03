import datetime as dt

from app.engine.artifacts import clean
from app.engine.detective import run_detective
from app.engine.experiment import evaluate_experiment
from app.models import Experiment
from tests.factories import TODAY, kasia_like, make_days

START = TODAY + dt.timedelta(days=1)  # tapped "Start" on TODAY, day 1 is tomorrow
EXPERIMENT = Experiment(cause_id="load_spike", start=START, days=7)


def kasia_with_experiment(after: dict, days_after: int = 7):
    """Kasia's story until TODAY, then `days_after` experiment days with lighter training."""

    def change(offset):
        story_offset = offset + days_after
        if story_offset <= 0:
            return kasia_like(story_offset)
        return {"sessions": ((40, 4),)} | after

    days = make_days(90 + days_after, today=TODAY + dt.timedelta(days=days_after), change=change)
    return clean(days)[0]


def evaluate(after: dict, days_after: int = 7):
    days = kasia_with_experiment(after, days_after)
    return evaluate_experiment(days, EXPERIMENT, days[-1].date)


def test_load_experiment_targets_60_percent_of_last_week():
    plan = run_detective(make_days(90, change=kasia_like)).suggested_experiment
    assert plan.steps[0] == "Keep the next 7 days under 2650 load points (last 7 days: 4410)."
    assert "Resting heart rate (your watch records it)" in plan.track


def test_starts_tomorrow():
    result = evaluate_experiment(clean(make_days(90, change=kasia_like))[0], EXPERIMENT, TODAY)
    assert (result.status, result.day) == ("running", 0)


def test_running_on_day_3():
    result = evaluate({"energy": 3}, days_after=3)
    assert (result.status, result.day, result.checkins_logged) == ("running", 3, 3)


def test_improved_when_energy_up_and_heart_rate_back():
    result = evaluate({"energy": 4, "rhr": 55.0})
    assert result.status == "improved"
    assert (result.energy_before, result.energy_during) == (2.0, 4.0)
    assert result.summary == (
        "Your energy recovered while you made this change (2.0 → 4.0 out of 5), and your resting heart "
        "rate is back to 55 bpm. Keep it going. This is a quick personal test, not proof."
    )


def test_not_improved_when_energy_stays_low():
    result = evaluate({"energy": 2, "rhr": 61.0})
    assert result.status == "not_improved"
    assert "still 6 bpm above your usual" in result.summary
    assert "family doctor" in result.summary


def test_not_improved_when_heart_rate_stays_high_even_if_energy_is_better():
    assert evaluate({"energy": 4, "rhr": 61.0}).status == "not_improved"


def test_not_enough_check_ins():
    result = evaluate({"checkin": False})
    assert result.status == "not_enough_data"
    assert result.checkins_logged == 0
