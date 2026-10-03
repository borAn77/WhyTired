import datetime as dt

import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app
from app.models import PersonaFile, Profile
from tests.factories import TODAY, kasia_like, make_day, make_days

client = TestClient(app)


def future(energy: int, rhr: float) -> list:
    return [
        make_day(TODAY + dt.timedelta(days=i), energy=energy, rhr=rhr, sessions=((40, 4),))
        for i in range(1, 15)
    ]


@pytest.fixture
def kasia(monkeypatch):
    """An in-memory Kasia built from the test factories (independent of backend/data/)."""
    persona = PersonaFile(
        profile=Profile(id="kasia", name="Kasia", age=23, goal="Half marathon", sports=["running"], has_watch=True),
        history=make_days(90, change=kasia_like),
        future={"not_improved": future(energy=2, rhr=61.0), "improved": future(energy=4, rhr=55.0)},
    )
    monkeypatch.setattr(store, "load_personas", lambda: {"kasia": persona})


def ctx(**overrides) -> dict:
    return {"persona_id": "kasia", "today": TODAY.isoformat(), "data_level": "full"} | overrides


def test_health_is_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_personas_returns_profiles(kasia):
    assert client.get("/api/personas").json()[0]["id"] == "kasia"


def test_detective_finds_the_load_spike(kasia):
    body = client.post("/api/detective", json=ctx()).json()
    assert body["triggered"] is True
    assert body["causes"][0]["id"] == "load_spike"
    assert body["causes"][0]["confidence"] == "high"
    assert len(body["excluded"]) == 2


def test_detective_without_watch_is_less_confident(kasia):
    body = client.post("/api/detective", json=ctx(data_level="basic")).json()
    assert body["data_level"] == "basic"
    assert body["causes"][0]["confidence"] == "medium"


def test_logged_check_in_overrides_synthetic_one(kasia):
    good_morning = {"energy": 5, "sleep_hours": 8, "sleep_quality": 5, "stress": 1, "soreness": 1}
    body = client.post("/api/detective", json=ctx(checkins={TODAY.isoformat(): good_morning})).json()
    assert body["triggered"] is False


@pytest.mark.parametrize("scenario, status", [("not_improved", "not_improved"), ("improved", "improved")])
def test_experiment_branches(kasia, scenario, status):
    experiment = {"cause_id": "load_spike", "start": (TODAY + dt.timedelta(days=1)).isoformat(), "days": 7}
    today = (TODAY + dt.timedelta(days=7)).isoformat()
    body = client.post("/api/experiment", json=ctx(today=today, scenario=scenario, experiment=experiment)).json()
    assert body["status"] == status


def test_unknown_persona_is_404(kasia):
    assert client.post("/api/detective", json=ctx(persona_id="nobody")).status_code == 404


def test_too_early_date_is_422(kasia):
    early = (TODAY - dt.timedelta(days=80)).isoformat()
    assert client.post("/api/detective", json=ctx(today=early)).status_code == 422


def test_experiment_requires_an_experiment(kasia):
    assert client.post("/api/experiment", json=ctx()).status_code == 422


def test_coach_for_kasia(kasia):
    body = client.post("/api/coach", json=ctx(planned_session={"sport": "running", "duration_min": 120})).json()
    assert body["recommendation"] == "rest"
    assert body["detective_triggered"] is True
    assert body["checkin"]["energy"] == 2
    assert "longest session in the last 30 days (90 min)" in body["injury_warning"]


def test_root_says_where_things_are():
    assert client.get("/").json()["health"] == "/api/health"


def test_summary_endpoint(kasia):
    experiment = {"cause_id": "load_spike", "start": (TODAY + dt.timedelta(days=1)).isoformat(), "days": 7}
    today = (TODAY + dt.timedelta(days=7)).isoformat()
    body = client.post("/api/summary", json=ctx(today=today, experiment=experiment, lang="pl")).json()
    assert body["title"].startswith("WhyTired: podsumowanie")
    assert body["questions"][-1].startswith("Na jakie objawy")


def test_cors_lets_the_static_site_call_the_api():
    response = client.options(
        "/api/detective",
        headers={"Origin": "https://whytired.onrender.com", "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "content-type"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] in ("*", "https://whytired.onrender.com")
