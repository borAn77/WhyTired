from app.engine.detective import run_detective
from app.store import restrict_to_level
from tests.factories import TODAY, kasia_like, make_days, tomek_like
import datetime as dt


def test_kasia_story():
    result = run_detective(make_days(90, change=kasia_like))
    assert result.triggered and result.low_energy_days == 5
    assert result.data_level == "full"
    top = result.causes[0]
    assert (top.id, top.confidence) == ("load_spike", "high")
    assert top.history_check.period_tag == "holiday"
    # the artifact night is excluded, with reasons
    artifact_day = TODAY - dt.timedelta(days=20)
    assert {(p.date, p.metric) for p in result.excluded} == {
        (artifact_day, "sleep"),
        (artifact_day, "resting_hr"),
    }
    assert result.suggested_experiment.cause_id == "load_spike"
    assert "40%" in result.suggested_experiment.title


def test_kasia_without_watch_drops_to_medium():
    result = run_detective(restrict_to_level(make_days(90, change=kasia_like), "basic"))
    assert result.data_level == "basic"
    assert result.causes[0].id == "load_spike"
    assert result.causes[0].confidence == "medium"
    assert all(cause.id != "rhr_elevated" for cause in result.causes)
    assert result.excluded == []


def test_tomek_story():
    result = run_detective(make_days(90, change=tomek_like))
    assert result.triggered
    assert result.data_level == "basic"
    assert result.causes[0].id == "sleep_debt"
    assert all(cause.confidence != "high" for cause in result.causes)
    assert result.suggested_experiment.cause_id == "sleep_debt"


def test_no_low_energy_means_not_triggered():
    result = run_detective(make_days(90))
    assert not result.triggered
    assert result.causes == [] and result.suggested_experiment is None
