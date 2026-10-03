import datetime as dt

from app.engine.coach import coach_today
from app.models import Experiment, PlannedSession
from tests.factories import TODAY, kasia_like, make_days, tomek_like


def test_steady_data_means_hard_is_fine():
    result = coach_today(make_days(60), TODAY)
    assert result.recommendation == "hard"
    assert result.reasons[0].startswith("All clear: energy 4 out of 5, 7.5 h of sleep")
    assert result.has_checkin and not result.detective_triggered


def test_kasia_rests_with_reasons():
    result = coach_today(make_days(90, change=kasia_like), TODAY)
    assert result.recommendation == "rest"
    assert result.reasons[0] == "Low energy this morning (2 out of 5)"
    assert any("Resting heart rate" in reason for reason in result.reasons)
    assert len(result.reasons) <= 3
    assert result.detective_triggered


def test_tomek_rests_on_sleep_and_stress():
    result = coach_today(make_days(90, change=tomek_like), TODAY)
    assert result.recommendation == "rest"
    assert any("less than usual" in reason for reason in result.reasons)
    assert any("High stress" in reason for reason in result.reasons)


def test_feeling_ill_always_means_rest():
    days = make_days(60)
    days[-1] = days[-1].model_copy(update={"checkin": days[-1].checkin.model_copy(update={"ill": True})})
    result = coach_today(days, TODAY)
    assert result.recommendation == "rest"
    assert "ill" in result.reasons[0]


def test_never_two_hard_days_in_a_row():
    days = make_days(60, change=lambda o: {"sessions": ((60, 8),)} if o == -1 else {})
    result = coach_today(days, TODAY)
    assert result.recommendation == "easy"
    assert result.reasons[0].startswith("Yesterday was a hard session")


def test_load_cut_experiment_keeps_training_easy():
    experiment = Experiment(cause_id="load_spike", start=TODAY - dt.timedelta(days=2))
    result = coach_today(make_days(60), TODAY, experiment=experiment)
    assert result.recommendation == "easy"
    assert result.reasons[0].startswith("Day 3 of your experiment")


def test_sleep_experiment_does_not_limit_training():
    experiment = Experiment(cause_id="sleep_debt", start=TODAY - dt.timedelta(days=2))
    assert coach_today(make_days(60), TODAY, experiment=experiment).recommendation == "hard"


def test_injury_warning_for_a_much_longer_planned_session():
    days = make_days(60)  # longest session in 30 days: 50 min
    assert coach_today(days, TODAY, planned=PlannedSession(sport="running", duration_min=55)).injury_warning is None
    warning = coach_today(days, TODAY, planned=PlannedSession(sport="running", duration_min=70)).injury_warning
    assert warning is not None and "longest session in the last 30 days (50 min)" in warning


def test_without_check_in_the_coach_still_answers():
    days = make_days(60, change=lambda o: {"checkin": False} if o == 0 else {})
    result = coach_today(days, TODAY)
    assert not result.has_checkin and result.checkin is None
    assert result.recommendation == "hard"
    assert result.measured_sleep_hours == 7.5


def test_load_cut_experiment_does_not_flag_the_old_spike():
    experiment = Experiment(cause_id="load_spike", start=TODAY - dt.timedelta(days=2))
    days = make_days(90, change=lambda o: kasia_like(o) | ({"energy": 4} if o >= -4 else {}))
    result = coach_today(days, TODAY, experiment=experiment)
    assert not any("training were" in reason for reason in result.reasons)
