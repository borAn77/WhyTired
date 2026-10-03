from app.engine.artifacts import clean
from tests.factories import make_days


def by_metric(excluded):
    return {(point.date, point.metric) for point in excluded}


def test_clean_data_has_no_exclusions():
    days = make_days(30)
    cleaned, excluded = clean(days)
    assert excluded == []
    assert cleaned == days


def test_unexplained_rhr_jump_is_excluded_and_next_day_is_kept():
    days = make_days(30, change=lambda o: {"rhr": 92.0} if o == -10 else {})
    cleaned, excluded = clean(days)
    assert by_metric(excluded) == {(days[-11].date, "resting_hr")}
    assert cleaned[-11].watch.resting_hr is None
    assert cleaned[-10].watch.resting_hr == 54.0  # compared with the last valid value, so not flagged
    assert "Jumped 38 bpm" in excluded[0].reason


def test_rhr_jump_with_matching_check_in_change_is_kept():
    days = make_days(30, change=lambda o: {"rhr": 92.0, "energy": 1, "stress": 5} if o == -10 else {})
    _, excluded = clean(days)
    assert excluded == []


def test_hard_training_alone_does_not_explain_a_big_jump():
    # Berken's case: a very hard day before a +35 bpm night used to make the jump look "explained"
    def change(offset):
        if offset == -11:
            return {"sessions": ((180, 9),)}
        if offset == -10:
            return {"rhr": 89.0}
        return {}

    days = make_days(30, change=change)
    _, excluded = clean(days)
    assert {(p.date, p.metric) for p in excluded} == {(days[-11].date, "resting_hr")}
    assert "too big to come from training alone" in excluded[0].reason


def test_moderate_rise_after_a_hard_day_is_kept():
    def change(offset):
        if offset == -11:
            return {"sessions": ((180, 9),)}
        if offset == -10:
            return {"rhr": 66.0}  # +12 bpm: real, not an artifact
        return {}

    _, excluded = clean(make_days(30, change=change))
    assert excluded == []


def test_implausible_rhr_is_excluded():
    days = make_days(30, change=lambda o: {"rhr": 25.0} if o == -3 else {})
    _, excluded = clean(days)
    assert by_metric(excluded) == {(days[-4].date, "resting_hr")}
    assert "plausible range" in excluded[0].reason


def test_partial_night_excludes_sleep():
    days = make_days(30, change=lambda o: {"coverage": 0.35} if o == -5 else {})
    cleaned, excluded = clean(days)
    assert by_metric(excluded) == {(days[-6].date, "sleep")}
    assert cleaned[-6].watch.sleep_min is None
    assert "35% of the night" in excluded[0].reason


def test_sleep_hr_above_daytime_excludes_sleep():
    days = make_days(30, change=lambda o: {"sleep_hr": 80.0, "day_hr": 75.0} if o == -5 else {})
    _, excluded = clean(days)
    assert by_metric(excluded) == {(days[-6].date, "sleep")}


def test_no_watch_means_nothing_to_exclude():
    days = make_days(30, change=lambda o: {"watch": False})
    _, excluded = clean(days)
    assert excluded == []
