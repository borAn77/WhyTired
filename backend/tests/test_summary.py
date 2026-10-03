import datetime as dt

import pytest

from app import store
from app.engine.summary import age_text, build_summary, days_in_row_text, fmt
from app.models import Experiment
from scripts.generate_personas import DEMO_DAY

D7 = DEMO_DAY + dt.timedelta(days=7)
NOT_ALLOWED = ["diagnoz", "badanie krwi", "badania krwi", "żelaz", "ferryty", "morfolog", "anemi", "diagnos", "blood test", "iron", "ferritin", "anaemi", "anemi"]


def summary(persona_id: str, cause_id: str, lang: str = "pl", level: str = "full", experiment: bool = True):
    persona = store.get_persona(persona_id)
    days = store.restrict_to_level(store.days_until(persona, D7, "not_improved"), level)
    exp = Experiment(cause_id=cause_id, start=DEMO_DAY + dt.timedelta(days=1)) if experiment else None
    return build_summary(persona.profile, days, exp, lang)


def all_text(result) -> str:
    parts = [result.complaint, result.tried, result.result, *result.questions, *(e.text for e in result.timeline)]
    return " ".join(parts).lower()


def test_kasia_polish_summary_after_a_failed_experiment():
    result = summary("kasia", "load_spike")
    assert result.patient == "Kasia, 23 lata"
    assert result.complaint.startswith("Zmęczenie utrzymuje się od 12 dni.")
    texts = [entry.text for entry in result.timeline]
    assert texts[0].startswith("Pominięto niewiarygodne dane z zegarka")  # the artifact night, 14 Sep
    assert any("wysoka pewność" in text for text in texts)
    assert texts[-1].startswith("Koniec próby. Brak wyraźnej poprawy")
    assert any(q.startswith("Próba „zmniejszenie obciążenia") for q in result.questions)
    assert len(result.trends) == 3  # energy, resting HR, weekly load


def test_tomek_summary_has_no_heart_rate_and_uses_numeral_agreement():
    result = summary("tomek", "sleep_debt", level="basic")
    assert result.patient == "Tomek, 21 lat"
    assert "bez zegarka" in result.sources
    assert result.timeline[0].text == "Początek okresu niskiej energii: 4 kolejne dni z energią 1–2 na 5."
    assert [trend.chart.metric for trend in result.trends] == ["energy", "sleep_hours"]


@pytest.mark.parametrize("persona_id, cause_id, level", [("kasia", "load_spike", "full"), ("tomek", "sleep_debt", "basic")])
@pytest.mark.parametrize("lang", ["pl", "en"])
def test_no_diagnoses_or_lab_tests(persona_id, cause_id, level, lang):
    text = all_text(summary(persona_id, cause_id, lang, level))
    assert not [word for word in NOT_ALLOWED if word in text]


def test_summary_without_an_experiment():
    result = summary("kasia", "load_spike", lang="en", experiment=False)
    assert result.tried == "No change has been tried yet."
    assert result.result == "No result: no experiment was run."


def test_polish_helpers():
    assert [age_text(n, "pl") for n in (1, 22, 12, 21, 25)] == ["1 rok", "22 lata", "12 lat", "21 lat", "25 lat"]
    assert [days_in_row_text(n, "pl") for n in (1, 3, 5, 13, 24)] == [
        "1 dzień", "3 kolejne dni", "5 kolejnych dni", "13 kolejnych dni", "24 kolejne dni",
    ]
    assert fmt(1.75, "pl") == "1,8" and fmt(1.75, "en") == "1.8"
