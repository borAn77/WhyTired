"""LLM layer: validator, templates and fallbacks. No test calls a real API (see conftest.py):
the LLM path is tested with a fake provider."""

import datetime as dt
import json
import time
from types import SimpleNamespace
from typing import get_args

import pytest
from fastapi.testclient import TestClient

from app.engine.detective import run_detective
from app.llm import explain_detective, explain_summary, providers, templates, validate
from app.llm.explain import facts_json, summary_facts
from app.main import app
from app.models import (
    Cause,
    CauseId,
    Chart,
    ChartPoint,
    DetectiveResult,
    DoctorSummary,
    Evidence,
    ExperimentPlan,
    HistoryCheck,
    Lang,
    TimelineEntry,
    Trend,
)
from app.store import restrict_to_level
from tests.factories import kasia_like, make_days, tomek_like

LANGS = get_args(Lang)


@pytest.fixture(autouse=True)
def empty_cache():
    providers.clear_cache()


def kasia(level: str = "full") -> DetectiveResult:
    return run_detective(restrict_to_level(make_days(90, change=kasia_like), level))


def tomek() -> DetectiveResult:
    return run_detective(make_days(90, change=tomek_like))


def fake_llm(monkeypatch, answer):
    """Route the anthropic provider to a fake that returns `answer` (or calls it)."""
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    reply = answer if callable(answer) else lambda *args: answer
    monkeypatch.setitem(providers.PROVIDERS, "anthropic", reply)


# ---------- validator ----------


def test_validator_accepts_numbers_from_the_input_with_polish_commas_and_rounding():
    source = '{"value": 12.5, "baseline": 7.1, "rhr_delta": -6.0, "load": 2700.0}'
    text = "About 12,5 h short (roughly 13 h), against 7.1 h; HR 6 bpm lower; 2,700 or 2 700 points."
    assert validate.check(text, source) == []


def test_validator_rejects_an_invented_number():
    source = '{"value": 7.1}'
    assert validate.invented_numbers("You slept 8 h, not 7.1 h.", source) == ["8"]


@pytest.mark.parametrize(
    "text",
    [
        "You have overtraining.",
        "This looks like an infection.",
        "Take 400 mg of ibuprofen.",
        "A magnesium supplement could help.",
        "Ask for a blood test.",
        "To może być diagnoza.",
        "Weź leki przeciwbólowe.",
        "Zrób badanie krwi.",
        "Sprawdź ferrytynę i morfologię.",
    ],
)
def test_validator_rejects_blocked_terms(text):
    assert validate.blocked_terms(text)


def test_blocked_terms_match_whole_words_only():
    assert validate.blocked_terms("Porozmawiaj z lekarzem rodzinnym o lekkim treningu.") == []
    assert validate.blocked_terms("Check the label on your plan.") == []
    assert validate.blocked_terms("Weź leki.") == ["leki"]
    assert validate.blocked_terms("Go to the lab.") == ["lab"]


def test_heart_data_is_only_allowed_when_the_input_has_it():
    assert validate.check("Your resting heart rate is 61 bpm.", '{"value": 61, "unit": "bpm"}') == []
    assert validate.check("Your pulse is probably up.", '{"value": 5.4, "unit": "h"}') != []


# ---------- templates ----------


def one_cause_result(cause_id: str) -> DetectiveResult:
    """A hand-built result whose top cause is `cause_id`, with the evidence the engine gives it."""
    evidence = {
        "load_spike": [Evidence(metric="weekly_load", text="", value=2700, baseline=1412)],
        "sleep_debt": [
            Evidence(metric="sleep_debt", text="", value=12.5),
            Evidence(metric="sleep_hours", text="", value=5.4, baseline=7.1),
        ],
        "stress_spike": [Evidence(metric="stress", text="", value=4.1, baseline=2.7, unit="/5")],
        "rhr_elevated": [Evidence(metric="resting_hr", text="", value=61, baseline=54, unit="bpm")],
    }[cause_id]
    cause = Cause(
        id=cause_id, title="", confidence="medium", score=2, strength=1.0, checks=[],
        evidence=evidence, data_level_used="full",
        history_check=HistoryCheck(supports=True, text="", energy_delta=1.1, rhr_delta=-6),
    )
    plan = ExperimentPlan(cause_id=cause_id, title="Try something for 7 days", steps=[], track=[])
    return DetectiveResult(
        triggered=True, low_energy_days=5, data_level="full", causes=[cause], excluded=[],
        suggested_experiment=plan,
    )


@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("cause_id", get_args(CauseId))
def test_templates_exist_for_every_cause_in_both_languages(cause_id, lang):
    assert templates.CAUSE_SENTENCES[cause_id][lang]
    assert templates.CAUSE_NAMES[cause_id][lang]
    result = one_cause_result(cause_id)
    text = templates.detective_text(result, lang)
    assert len(text) > 50
    assert validate.check(text, facts_json(result)) == []


@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("result", [kasia(), kasia("basic"), tomek()], ids=["kasia", "kasia-basic", "tomek"])
def test_templates_pass_the_same_checks_as_llm_answers(result, lang):
    text = templates.detective_text(result, lang)
    assert validate.check(text, facts_json(result)) == []


@pytest.mark.parametrize("lang", LANGS)
def test_no_heart_data_without_a_watch(lang):
    for result in (tomek(), kasia("basic")):
        assert result.data_level == "basic"
        assert not validate.mentions_heart_data(facts_json(result))
        assert not validate.mentions_heart_data(templates.detective_text(result, lang))


def test_polish_template_is_polish():
    result = tomek()
    hours = next(e.value for e in result.causes[0].evidence if e.metric == "sleep_hours")
    text = templates.detective_text(result, "pl")
    assert "zbyt krótki sen" in text and f"{templates.number(hours, 'pl')} h" in text
    assert "," in templates.number(5.4, "pl")  # decimal comma
    assert "sleep" not in text.lower()


def test_template_names_the_excluded_artifact_night():
    assert "1 night of watch data" in templates.detective_text(kasia(), "en")
    assert "1 noc" in templates.detective_text(kasia(), "pl")


# ---------- fallbacks: the LLM is off, missing or wrong ----------


@pytest.mark.parametrize("setting", ["none", "off"])
def test_llm_turned_off_returns_the_template(monkeypatch, setting):
    monkeypatch.setenv("LLM_PROVIDER", setting)
    result = kasia()
    explanation = explain_detective(result, "en")
    assert explanation.source == "template"
    assert explanation.text == templates.detective_text(result, "en")


def test_missing_api_key_returns_the_template(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert explain_detective(kasia(), "pl").source == "template"
    assert "no API key" in providers.active_provider()


def test_good_llm_answer_is_used(monkeypatch):
    result = kasia()
    load = result.causes[0].evidence[0]
    answer = (f"Your training load rose to {load.value:.0f} points against your usual "
              f"{load.baseline:.0f}, so it is the most likely reason.")
    fake_llm(monkeypatch, answer)
    explanation = explain_detective(result, "en")
    assert (explanation.source, explanation.text) == ("llm", answer)


@pytest.mark.parametrize(
    "answer",
    [
        "Your training load is 3000 points.",  # invented number
        "You have overtraining, so rest for 7 days.",  # diagnosis
        "Your training load jumped. Ask your doctor for a blood test.",  # lab test
        "",  # empty
        "Training load. " * 80,  # too long
    ],
)
def test_bad_llm_answer_falls_back_to_the_template(monkeypatch, answer):
    fake_llm(monkeypatch, answer)
    result = kasia()
    explanation = explain_detective(result, "en")
    assert explanation.source == "template"
    assert explanation.text == templates.detective_text(result, "en")


def test_heart_rate_answer_for_a_user_without_a_watch_falls_back(monkeypatch):
    fake_llm(monkeypatch, "Too little sleep is the most likely reason, and your heart rate is up.")
    assert explain_detective(tomek(), "en").source == "template"


def test_polish_request_answered_in_english_falls_back(monkeypatch):
    fake_llm(monkeypatch, "Too little sleep is the most likely reason.")
    assert explain_detective(tomek(), "pl").source == "template"


def test_refusal_falls_back(monkeypatch):
    """Uses the real anthropic code path with a fake SDK client, so no network is needed."""
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    refusal = SimpleNamespace(stop_reason="refusal", content=[])
    fake_client = SimpleNamespace(messages=SimpleNamespace(create=lambda **kwargs: refusal))
    monkeypatch.setattr(providers, "_anthropic_client", lambda api_key: fake_client)
    assert explain_detective(kasia(), "en").source == "template"
    assert "refusal" in providers.recent_calls()[0]["reason"]


def test_haiku_gets_no_effort_setting(monkeypatch):
    """Haiku 4.5 rejects `effort`; sending it would make every call fail."""
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)  # use the default model
    sent = {}

    def create(**kwargs):
        sent.update(kwargs)
        text = SimpleNamespace(type="text", text="Your training load is the most likely reason.")
        return SimpleNamespace(stop_reason="end_turn", content=[text])

    monkeypatch.setattr(providers, "_anthropic_client", lambda api_key: SimpleNamespace(messages=SimpleNamespace(create=create)))
    assert explain_detective(kasia(), "en").source == "llm"
    assert sent["model"] == "claude-haiku-4-5" and "output_config" not in sent


def test_slow_llm_hits_the_time_limit(monkeypatch):
    monkeypatch.setattr(providers, "TIMEOUT_S", 0.2)
    fake_llm(monkeypatch, lambda *args: time.sleep(1) or "Too late.")
    started = time.monotonic()
    assert explain_detective(kasia(), "en").source == "template"
    assert time.monotonic() - started < 1


def test_answers_are_cached(monkeypatch):
    calls = []
    fake_llm(monkeypatch, lambda *args: calls.append(1) or "Your training load is the most likely reason.")
    explain_detective(kasia(), "en")
    explain_detective(kasia(), "en")
    assert len(calls) == 1


def test_not_triggered_skips_the_llm(monkeypatch):
    fake_llm(monkeypatch, lambda *args: pytest.fail("the LLM must not be called"))
    result = run_detective(make_days(90))
    assert explain_detective(result, "en").source == "template"


# ---------- API wiring, on the committed demo personas ----------

client = TestClient(app)
DEMO_DAY = dt.date(2026, 10, 4)


@pytest.mark.parametrize("persona_id, lang", [("kasia", "en"), ("kasia", "pl"), ("tomek", "pl")])
def test_detective_endpoint_returns_an_explanation(persona_id, lang):
    body = client.post(
        "/api/detective",
        json={"persona_id": persona_id, "today": DEMO_DAY.isoformat(), "data_level": "full", "lang": lang},
    ).json()
    assert body["triggered"] is True
    assert body["explanation"]["source"] == "template"
    assert body["explanation"]["text"]


def test_health_reports_the_llm_setup():
    assert client.get("/api/health").json()["llm_provider"] == "none"


# ---------- doctor summary: explain_summary ----------

END = dt.date(2026, 10, 11)  # demo day + 7: the experiment has just ended

SUMMARIES = {
    "kasia-pl": dict(
        lang="pl", patient="Kasia, 23", data_level="full",
        complaint="Od 5 dni niski poziom energii (2 na 5) i gorsze treningi biegowe.",
        timeline=[
            (66, "Tydzień urlopu (5–11 sie): energia wyższa o 1,1 pkt, tętno spoczynkowe niższe o 6 uderzeń/min."),
            (27, "14 wrz: jedna noc pominięta jako błąd pomiaru zegarka."),
            (20, "Obciążenie treningowe wzrosło do 2700 pkt tygodniowo (zwykle 1412)."),
            (7, "Początek 7-dniowej próby: obciążenie zmniejszone o 40%."),
        ],
        trends=[("Obciążenie treningowe", "2700 pkt w tygodniu przed próbą, zwykle 1412."),
                ("Tętno spoczynkowe", "61 uderzeń/min, zwykle 54.")],
        tried="Zmniejszenie obciążenia treningowego o 40% przez 7 dni",
        result="Energia pozostała niska (2,0 → 2,1 na 5), a tętno spoczynkowe nadal jest o 6 uderzeń/min wyższe niż zwykle",
    ),
    "tomek-pl": dict(
        lang="pl", patient="Tomek, 21", data_level="basic",
        complaint="Od 4 dni niski poziom energii (2 na 5) w czasie sesji egzaminacyjnej.",
        timeline=[
            (57, "Tydzień urlopu (15–21 sie): energia wyższa o 0,7 pkt."),
            (18, "Początek sesji: sen średnio 5,4 h zamiast 7,1 h."),
            (7, "Początek 7-dniowej próby: stałe pory snu."),
        ],
        trends=[("Sen", "Średnio 5,4 h na noc, zwykle 7,1 h."), ("Stres", "Średnio 4,1 na 5, zwykle 2,7.")],
        tried="Stałe pory snu przez 7 dni",
        result="Energia pozostała niska (2,0 → 2,2 na 5)",
    ),
    "kasia-en": dict(
        lang="en", patient="Kasia, 23", data_level="full",
        complaint="Low energy (2 out of 5) for 5 days and worse runs.",
        timeline=[
            (66, "Holiday week (5–11 Aug): energy 1.1 points higher, resting heart rate 6 bpm lower."),
            (20, "Training load rose to 2700 points a week (usually 1412)."),
        ],
        trends=[("Training load", "2700 points in the week before the experiment, usually 1412.")],
        tried="Training load cut by 40% for 7 days",
        result="Energy stayed low (2.0 → 2.1 out of 5)",
    ),
}


def make_summary(key: str, **changes) -> DoctorSummary:
    """A hand-built DoctorSummary, as engine/summary.py will produce it (not written yet)."""
    data = SUMMARIES[key] | changes
    chart = Chart(metric="weekly_load", unit="load points",
                  points=[ChartPoint(date=END - dt.timedelta(days=7), value=2345, baseline=1412)])
    return DoctorSummary(
        lang=data["lang"], patient=data["patient"], data_level=data["data_level"],
        period_start=END - dt.timedelta(days=89), period_end=END,
        complaint=data["complaint"],
        timeline=[TimelineEntry(date=END - dt.timedelta(days=d), text=t) for d, t in data["timeline"]],
        trends=[Trend(title=title, note=note, chart=chart) for title, note in data["trends"]],
        tried=data["tried"], result=data["result"],
        questions=["Na jakie objawy warto zwrócić uwagę?"],
        disclaimer="To nie jest diagnoza medyczna.",
    )


def summary_facts_text(summary: DoctorSummary) -> str:
    return json.dumps(summary_facts(summary), ensure_ascii=False, indent=1)


def test_summary_facts_hold_no_name_dates_chart_points_or_fixed_copy():
    facts = summary_facts_text(make_summary("kasia-pl"))
    for private in ("Kasia", "2026", "5–11 sie", "14 wrz", "2345", "Na jakie objawy", "diagnoza"):
        assert private not in facts
    assert [e["days_before_end"] for e in summary_facts(make_summary("kasia-pl"))["timeline"]] == [66, 27, 20, 7]


def test_name_in_an_engine_text_is_removed():
    summary = make_summary("kasia-pl", complaint="Kasia od 5 dni ma mało energii.")
    assert summary_facts(summary)["complaint"] == "od 5 dni ma mało energii."


@pytest.mark.parametrize(
    "text, gone, kept",
    [
        ("In your holiday week (5–11 Aug), energy was higher.", "Aug", "holiday week, energy"),
        ("Night of 2026-09-14 excluded.", "2026", "Night of excluded."),
        ("Urlop 15–21 sierpnia i 3 wrz.", "sierpnia", "Urlop"),
        ("Tracked from Oct 5, 2026 on.", "Oct", "Tracked from"),
    ],
)
def test_dates_are_removed(text, gone, kept):
    cleaned = summary_facts(make_summary("kasia-en", complaint=text))["complaint"]
    assert gone not in cleaned and kept in cleaned


def test_numbers_that_are_not_dates_stay():
    text = "Ran 5 marathons in 7 days, sleep 5.4 h."
    assert summary_facts(make_summary("kasia-en", complaint=text))["complaint"] == text


@pytest.mark.parametrize("key", SUMMARIES)
def test_summary_template_passes_the_same_checks_as_llm_answers(key):
    summary = make_summary(key)
    text = templates.summary_text(summary_facts(summary), summary.lang)
    assert validate.check(text, summary_facts_text(summary)) == []


def test_basic_summary_template_has_no_heart_data():
    summary = make_summary("tomek-pl")
    assert not validate.mentions_heart_data(templates.summary_text(summary_facts(summary), "pl"))


@pytest.mark.parametrize("setting", ["none", "off"])
def test_summary_with_llm_turned_off_returns_the_polish_template(monkeypatch, setting):
    monkeypatch.setenv("LLM_PROVIDER", setting)
    summary = make_summary("kasia-pl")
    explanation = explain_summary(summary)
    assert explanation.source == "template"
    assert explanation.text.startswith("Podsumowanie ostatnich 90 dni")
    assert "Wypróbowany plan:" in explanation.text and "Wynik:" in explanation.text


def test_good_polish_summary_answer_is_used(monkeypatch):
    answer = (
        "Od 5 dni utrzymuje się niski poziom energii (2 na 5). Obciążenie treningowe wzrosło do "
        "2700 pkt tygodniowo, zwykle 1412. Wypróbowano zmniejszenie obciążenia o 40% przez 7 dni, "
        "ale energia pozostała niska."
    )
    fake_llm(monkeypatch, answer)
    explanation = explain_summary(make_summary("kasia-pl"))
    assert (explanation.source, explanation.text) == ("llm", answer)


@pytest.mark.parametrize(
    "answer",
    [
        "Energy has stayed low for 5 days.",  # English for a Polish summary
        "Objawy wskazują na przetrenowanie.",  # diagnosis
        "Warto rozważyć suplementy żelaza.",  # supplement
        "Lekarz może zlecić badanie krwi.",  # lab test
        "Od 47 dni utrzymuje się niski poziom energii.",  # invented number
    ],
)
def test_bad_summary_answer_falls_back_to_the_template(monkeypatch, answer):
    fake_llm(monkeypatch, answer)
    summary = make_summary("kasia-pl")
    explanation = explain_summary(summary)
    assert explanation.source == "template"
    assert explanation.text == templates.summary_text(summary_facts(summary), "pl")


def test_basic_summary_rejects_heart_data_even_if_an_engine_text_has_it(monkeypatch):
    """Persona rule: no heart data at the Basic level, even when an engine text slipped one in."""
    summary = make_summary("tomek-pl", trends=[("Sen", "Średnio 5,4 h na noc; tętno 60.")])
    fake_llm(monkeypatch, "Od 4 dni utrzymuje się niski poziom energii, a tętno wynosi 60.")
    assert explain_summary(summary).source == "template"
