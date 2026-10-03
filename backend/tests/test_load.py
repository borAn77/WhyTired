from app.engine.load import (
    injury_warning,
    load_ratio,
    longest_session_min,
    session_load,
    usual_weekly_load,
    weekly_load,
)
from app.models import PlannedSession, Session
from tests.factories import TODAY, make_days


def test_session_load_is_minutes_times_effort():
    assert session_load(Session(sport="running", duration_min=60, rpe=5)) == 300


def test_steady_training_has_ratio_one():
    days = make_days(60)
    assert weekly_load(days, TODAY) == 7 * 250
    assert usual_weekly_load(days, TODAY) == 7 * 250
    assert load_ratio(days, TODAY) == 1.0


def test_doubled_last_week_has_ratio_two():
    days = make_days(60, change=lambda o: {"sessions": ((100, 5),)} if o > -7 else {})
    assert load_ratio(days, TODAY) == 2.0


def test_no_usual_training_gives_no_ratio():
    days = make_days(60, change=lambda o: {"sessions": ()} if o <= -7 else {})
    assert load_ratio(days, TODAY) is None


def test_longest_session_ignores_today():
    days = make_days(40, change=lambda o: {"sessions": ((120, 5),)} if o == 0 else {})
    assert longest_session_min(days, TODAY) == 50


def test_injury_warning_above_ten_percent():
    days = make_days(40)  # longest session 50 min → limit 55 min
    assert injury_warning(PlannedSession(sport="running", duration_min=55), days, TODAY) is None
    warning = injury_warning(PlannedSession(sport="running", duration_min=60), days, TODAY)
    assert warning is not None and "50 min" in warning
