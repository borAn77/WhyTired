from app.engine.artifacts import clean
from app.engine.causes import (
    candidate_signals,
    history_check,
    load_spike,
    low_energy_streak,
    objective_support,
    rhr_elevated,
    score_confidence,
    sleep_debt,
    stress_spike,
)
from app.store import restrict_to_level
from tests.factories import TODAY, kasia_like, make_days


def test_low_energy_streak_counts_back_from_today():
    days = make_days(30, change=lambda o: {"energy": 2} if o >= -4 else {})
    assert low_energy_streak(days) == 5


def test_low_energy_streak_skips_days_without_check_in():
    days = make_days(30, change=lambda o: {"energy": 1} if o in (0, -2) else {"checkin": False} if o == -1 else {})
    assert low_energy_streak(days) == 2


def test_steady_data_fires_nothing():
    assert candidate_signals(make_days(90), TODAY) == []


def test_load_spike_fires_and_is_strong():
    days = make_days(60, change=lambda o: {"sessions": ((100, 5),)} if o > -7 else {})
    signal = load_spike(days, TODAY)
    assert signal.fires and signal.strong
    assert signal.evidence[0].value == 3500 and signal.evidence[0].baseline == 1750


def test_sleep_debt_fires_with_short_nights():
    days = make_days(60, change=lambda o: {"sleep_min": 330.0} if o > -7 else {})  # 5.5 h vs 7.5 h
    signal = sleep_debt(days, TODAY)
    assert signal.fires and signal.strong
    assert signal.evidence[0].value == 14.0


def test_sleep_debt_uses_check_in_hours_without_watch():
    days = make_days(60, change=lambda o: {"watch": False, "sleep_hours": 6.8 if o > -7 else 7.5})
    signal = sleep_debt(days, TODAY)
    assert signal.fires and not signal.strong  # 7 nights × 0.7 h = 4.9 h short
    assert signal.evidence[0].value == 4.9


def test_stress_spike_fires():
    days = make_days(60, change=lambda o: {"stress": 4} if o > -7 else {})
    assert stress_spike(days, TODAY).fires


def test_rhr_elevated_needs_heart_rate_data():
    days = make_days(60, change=lambda o: {"rhr": 62.0} if o > -7 else {})
    assert rhr_elevated(days, TODAY).fires
    assert rhr_elevated(restrict_to_level(days, "basic"), TODAY) is None


def test_history_check_finds_the_holiday_week():
    days, _ = clean(make_days(90, change=kasia_like))
    history = history_check(days, TODAY, "load_spike")
    assert history.supports
    assert history.period_tag == "holiday"
    assert history.rhr_delta == -6
    assert "holiday week" in history.text and "lower" in history.text


def test_history_check_does_not_support_when_energy_was_the_same():
    def change(offset):
        if -60 <= offset <= -54:
            return {"sessions": ((30, 3),)}  # light week, but energy and HR unchanged
        return kasia_like(offset) if offset > -14 else {}

    days, _ = clean(make_days(90, change=change))
    assert not history_check(days, TODAY, "load_spike").supports


def test_objective_support_is_none_without_watch():
    days = restrict_to_level(make_days(60, change=lambda o: {"stress": 4} if o > -7 else {}), "basic")
    assert objective_support(days, TODAY, "stress_spike") is None


def test_full_evidence_is_high_but_basic_is_capped_at_medium():
    days, _ = clean(make_days(90, change=kasia_like))
    signal = load_spike(days, TODAY)
    history = history_check(days, TODAY, "load_spike")
    confidence, score, checks = score_confidence(signal, history, True, "full")
    assert (confidence, score) == ("high", 4)
    assert all(check.passed for check in checks)
    confidence, _, _ = score_confidence(signal, history, True, "basic")
    assert confidence == "medium"


def test_missing_data_lowers_confidence():
    days = make_days(60, change=lambda o: {"stress": 4, "checkin": o in (0, -1, -2, -3) or o < -6} if o > -7 else {})
    signal = stress_spike(days, TODAY)
    confidence, score, _ = score_confidence(signal, None, None, "full")
    assert signal.coverage < 0.7
    assert score == 1 and confidence == "low"
