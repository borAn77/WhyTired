"""One-page summary for the family doctor (POZ), in Polish by default, English optional.

Built only from engine results and fixed templates: no diagnoses, no medication advice and
no lab-test suggestions. Section headings, the training/sleep questions and the "what to
bring" note come from Berken's doctor-brief texts (engine/llm/texts.py on feature/engine-llm).
"""

from __future__ import annotations

import datetime as dt

from ..models import (
    Cause,
    CauseId,
    Chart,
    ChartPoint,
    DayRecord,
    DetectiveResult,
    DoctorSummary,
    Experiment,
    ExperimentResult,
    Lang,
    Profile,
    TimelineEntry,
    Trend,
)
from . import artifacts
from .baselines import avg, energy, last_days, resting_hr, sleep_hours, stress, usual_period, values, window
from .detective import run_detective
from .experiment import evaluate_experiment
from .load import weekly_load

PERIOD_DAYS = 28

CAUSE_NAMES: dict[Lang, dict[CauseId, str]] = {
    "pl": {
        "load_spike": "wzrost obciążenia treningowego",
        "sleep_debt": "niedobór snu",
        "stress_spike": "podwyższony stres",
        "rhr_elevated": "podwyższone tętno spoczynkowe",
    },
    "en": {
        "load_spike": "a jump in training load",
        "sleep_debt": "too little sleep",
        "stress_spike": "higher stress than usual",
        "rhr_elevated": "a raised resting heart rate",
    },
}
CONFIDENCE_NAMES = {
    "pl": {"high": "wysoka pewność", "medium": "średnia pewność", "low": "niska pewność"},
    "en": {"high": "high confidence", "medium": "medium confidence", "low": "low confidence"},
}
EXPERIMENT_NAMES: dict[Lang, dict[CauseId, str]] = {
    "pl": {
        "load_spike": "zmniejszenie obciążenia treningowego o 40% przez 7 dni",
        "rhr_elevated": "zmniejszenie obciążenia treningowego o 40% przez 7 dni",
        "sleep_debt": "stałe pory snu przez 7 dni",
        "stress_spike": "dwa dodatkowe lżejsze dni i 10 minut wyciszenia wieczorem",
    },
    "en": {
        "load_spike": "cutting training load by 40% for 7 days",
        "rhr_elevated": "cutting training load by 40% for 7 days",
        "sleep_debt": "a fixed sleep window for 7 days",
        "stress_spike": "two extra easy days and a 10-minute wind-down each evening",
    },
}

T = {
    "pl": {
        "title": "WhyTired: podsumowanie dla lekarza rodzinnego (POZ)",
        "sources_watch": "Dane: poranne ankiety samopoczucia, zapisane treningi i zegarek sportowy.",
        "sources_basic": "Dane: poranne ankiety samopoczucia i zapisane treningi (bez zegarka).",
        "complaint": "Zmęczenie utrzymuje się od {days}. W porannej ankiecie energia wynosiła w tym czasie {range} na 5 (zwykle około {usual}).",
        "episode": "Początek okresu niskiej energii: {n} z energią 1–2 na 5.",
        "analysis": "Analiza w aplikacji: najbardziej prawdopodobny czynnik to {cause} ({confidence}). {evidence}",
        "excluded": "Pominięto niewiarygodne dane z zegarka z tej nocy ({metrics}), prawdopodobnie błąd pomiaru.",
        "start": "Początek 7-dniowej próby: {name}.",
        "end": "Koniec próby. {result}",
        "ev_load_spike": "Obciążenie z ostatnich 7 dni: {value} pkt wobec zwykłych {baseline} pkt tygodniowo.",
        "ev_sleep_debt": "Brak około {value} h snu w ciągu 7 dni w porównaniu ze zwykłym poziomem.",
        "ev_stress_spike": "Średni stres {value} na 5 wobec zwykłych {baseline}.",
        "ev_rhr_elevated": "Tętno spoczynkowe średnio {value} uderzeń/min wobec zwykłych {baseline}.",
        "tried_none": "Nie przeprowadzono jeszcze żadnej próby zmiany nawyków.",
        "tried_load": "{name}. Obciążenie w czasie próby: {during} pkt na tydzień (wcześniej {before}).",
        "tried_sleep": "{name}. Sen w czasie próby: średnio {during} h na noc (wcześniej {before} h).",
        "tried_stress": "{name}. Stres w czasie próby: średnio {during} na 5 (wcześniej {before}).",
        "result_none": "Brak wyniku: próba nie została przeprowadzona.",
        "result_running": "Próba w toku (dzień {day} z {total}).",
        "result_not_enough": "Za mało porannych ankiet, by ocenić wynik próby.",
        "result_improved": "Poprawa: energia {before} → {during} na 5.",
        "result_not_improved": "Brak wyraźnej poprawy: energia {before} → {during} na 5.",
        "result_rhr_back": " Tętno spoczynkowe wróciło do {rhr} uderzeń/min.",
        "result_rhr_high": " Tętno spoczynkowe nadal o {diff} uderzeń/min wyższe niż zwykle.",
        "q_load": "Czy zmęczenie może wynikać ze zbyt dużego obciążenia treningowego i jak bezpiecznie wrócić do pełnych treningów?",
        "q_sleep": "Czy zmęczenie może mieć związek ze zbyt krótkim snem i co warto zmienić?",
        "q_stress": "Czy stres (np. sesja egzaminacyjna) może tak wpływać na energię i sen?",
        "q_rhr": "Tętno spoczynkowe jest od ponad tygodnia wyższe o około {diff} uderzeń/min. Czy warto to dalej obserwować?",
        "q_not_improved": "Próba „{name}” nie pomogła. Co jeszcze może powodować takie zmęczenie?",
        "q_closing": "Na jakie objawy warto zwrócić uwagę i kiedy wrócić na kolejną wizytę?",
        "bring": [
            "To podsumowanie (wydruk lub telefon).",
            "Krótką notatkę o ostatnich zmianach: stres, studia lub praca, dieta, podróże, niedawne choroby.",
            "Listę przyjmowanych leków i suplementów, jeśli jakieś są.",
        ],
        "disclaimer": "Podsumowanie przygotowała automatycznie aplikacja WhyTired na podstawie danych wpisanych przez użytkownika{watch}. To nie jest diagnoza ani porada medyczna. Wszystkie liczby pochodzą z prostych, jawnych reguł opisanych w dokumentacji projektu.",
        "disclaimer_watch": " i danych z zegarka",
        "chart_energy": "Energia w porannej ankiecie (1–5)",
        "chart_resting_hr": "Tętno spoczynkowe (uderzenia/min)",
        "chart_weekly_load": "Obciążenie treningowe na tydzień (minuty × wysiłek)",
        "chart_sleep_hours": "Sen (godziny na noc)",
        "chart_stress": "Stres w porannej ankiecie (1–5)",
        "chart_note": "Linia przerywana: zwykły poziom tej osoby.",
        "metric_resting_hr": "tętno spoczynkowe",
        "metric_sleep": "sen",
    },
    "en": {
        "title": "WhyTired: summary for the family doctor",
        "sources_watch": "Data: morning well-being check-ins, logged training sessions and a sports watch.",
        "sources_basic": "Data: morning well-being check-ins and logged training sessions (no watch).",
        "complaint": "Persistent tiredness for {days}. In the morning check-in, energy was {range} out of 5 during this time (usually about {usual}).",
        "episode": "Start of low energy: {n} with energy 1–2 out of 5.",
        "analysis": "Analysis in the app: the most likely factor is {cause} ({confidence}). {evidence}",
        "excluded": "Unreliable watch data from this night left out ({metrics}), most likely a measurement error.",
        "start": "Started a 7-day experiment: {name}.",
        "end": "End of the experiment. {result}",
        "ev_load_spike": "Training load in the last 7 days: {value} points against a usual {baseline} points a week.",
        "ev_sleep_debt": "About {value} h of sleep short over 7 days compared with the usual level.",
        "ev_stress_spike": "Average stress {value} out of 5 against a usual {baseline}.",
        "ev_rhr_elevated": "Resting heart rate {value} bpm on average against a usual {baseline}.",
        "tried_none": "No change has been tried yet.",
        "tried_load": "{name}. Training load during the experiment: {during} points a week (before: {before}).",
        "tried_sleep": "{name}. Sleep during the experiment: {during} h a night on average (before: {before} h).",
        "tried_stress": "{name}. Stress during the experiment: {during} out of 5 on average (before: {before}).",
        "result_none": "No result: no experiment was run.",
        "result_running": "Experiment in progress (day {day} of {total}).",
        "result_not_enough": "Too few morning check-ins to judge the result.",
        "result_improved": "Improved: energy {before} → {during} out of 5.",
        "result_not_improved": "No clear improvement: energy {before} → {during} out of 5.",
        "result_rhr_back": " Resting heart rate is back to {rhr} bpm.",
        "result_rhr_high": " Resting heart rate is still {diff} bpm above usual.",
        "q_load": "Could the tiredness come from too much training load, and how can I return to full training safely?",
        "q_sleep": "Could the tiredness be linked to too little sleep, and what would be worth changing?",
        "q_stress": "Can stress (for example an exam period) affect energy and sleep this much?",
        "q_rhr": "My resting heart rate has been about {diff} bpm higher for over a week. Is it worth keeping an eye on?",
        "q_not_improved": "The experiment ({name}) did not help. What else could be causing this tiredness?",
        "q_closing": "Which warning signs should I look out for, and when should I come back?",
        "bring": [
            "This summary (printed or on your phone).",
            "A short note on recent changes: stress, studies or work, diet, travel, recent illness.",
            "A list of any medicines or supplements you take.",
        ],
        "disclaimer": "This summary was prepared automatically by the WhyTired app from data entered by the user{watch}. It is not a diagnosis or medical advice. All numbers come from simple, documented rules.",
        "disclaimer_watch": " and watch data",
        "chart_energy": "Energy in the morning check-in (1–5)",
        "chart_resting_hr": "Resting heart rate (bpm)",
        "chart_weekly_load": "Training load per week (minutes × effort)",
        "chart_sleep_hours": "Sleep (hours a night)",
        "chart_stress": "Stress in the morning check-in (1–5)",
        "chart_note": "Dashed line: this person's usual level.",
        "metric_resting_hr": "resting heart rate",
        "metric_sleep": "sleep",
    },
}


def fmt(value: float | None, lang: Lang, decimals: int = 1) -> str:
    """Numbers as people write them: Polish uses a decimal comma."""
    if value is None:
        return "–"
    text = f"{value:.{decimals}f}"
    return text.replace(".", ",") if lang == "pl" else text


def age_text(age: int, lang: Lang) -> str:
    """Polish: 1 rok, 2–4 lata (not 12–14), otherwise lat."""
    if lang == "en":
        return f"{age} years"
    if age == 1:
        return "1 rok"
    if age % 10 in (2, 3, 4) and age % 100 not in (12, 13, 14):
        return f"{age} lata"
    return f"{age} lat"


def days_text(n: int, lang: Lang) -> str:
    """'od 12 dni' / 'for 12 days'."""
    if lang == "en":
        return "1 day" if n == 1 else f"{n} days"
    return "1 dnia" if n == 1 else f"{n} dni"


def days_in_row_text(n: int, lang: Lang) -> str:
    """Polish numeral agreement: 1 dzień, 2–4 kolejne dni (not 12–14), otherwise kolejnych dni."""
    if lang == "en":
        return "1 day" if n == 1 else f"{n} days in a row"
    if n == 1:
        return "1 dzień"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return f"{n} kolejne dni"
    return f"{n} kolejnych dni"


def daily_chart(days: list[DayRecord], metric, name: str, unit: str, baseline: float | None) -> Chart:
    return Chart(
        metric=name,
        unit=unit,
        points=[
            ChartPoint(
                date=day.date,
                value=round(value, 1) if (value := metric(day)) is not None else None,
                baseline=round(baseline, 1) if baseline is not None else None,
            )
            for day in days
        ],
    )


def cause_evidence(cause: Cause, lang: Lang) -> str:
    first = cause.evidence[0]
    decimals = 0 if cause.id in ("load_spike", "rhr_elevated") else 1
    return T[lang][f"ev_{cause.id}"].format(
        value=fmt(first.value, lang, decimals), baseline=fmt(first.baseline, lang, decimals)
    )


def result_text(result: ExperimentResult | None, lang: Lang) -> str:
    t = T[lang]
    if result is None:
        return t["result_none"]
    if result.status == "running":
        return t["result_running"].format(day=result.day, total=result.days_total)
    if result.status == "not_enough_data":
        return t["result_not_enough"]
    text = t[f"result_{result.status}"].format(
        before=fmt(result.energy_before, lang), during=fmt(result.energy_during, lang)
    )
    if result.rhr_during is not None and result.rhr_baseline is not None:
        diff = result.rhr_during - result.rhr_baseline
        text += t["result_rhr_high"].format(diff=round(diff)) if diff > 3 else t["result_rhr_back"].format(rhr=round(result.rhr_during))
    return text


def tried_text(days: list[DayRecord], experiment: Experiment | None, lang: Lang) -> str:
    t = T[lang]
    if experiment is None:
        return t["tried_none"]
    name = EXPERIMENT_NAMES[lang][experiment.cause_id]
    name = name[0].upper() + name[1:]
    start, end = experiment.start, experiment.start + dt.timedelta(days=experiment.days - 1)
    before = last_days(days, 7, start - dt.timedelta(days=1))
    during = window(days, start, end)
    if experiment.cause_id in ("load_spike", "rhr_elevated"):
        return t["tried_load"].format(
            name=name,
            during=round(weekly_load(days, min(end, days[-1].date)) if during else 0),
            before=round(weekly_load(days, start - dt.timedelta(days=1))),
        )
    metric, key = (sleep_hours, "tried_sleep") if experiment.cause_id == "sleep_debt" else (stress, "tried_stress")
    return t[key].format(name=name, during=fmt(avg(during, metric), lang), before=fmt(avg(before, metric), lang))


def build_summary(
    profile: Profile, days: list[DayRecord], experiment: Experiment | None, lang: Lang
) -> DoctorSummary:
    """`days` are cut at today and restricted to the data level (see store.py)."""
    t = T[lang]
    today = days[-1].date
    clean_days, excluded = artifacts.clean(days)

    # The analysis as it was when the experiment started (or today, if none was started).
    analysis_day = experiment.start - dt.timedelta(days=1) if experiment else today
    detective: DetectiveResult = run_detective([day for day in days if day.date <= analysis_day])
    top = detective.causes[0] if detective.causes else None
    result = evaluate_experiment(clean_days, experiment, today) if experiment else None

    streak = max(detective.low_energy_days, 1)
    episode_start = analysis_day - dt.timedelta(days=streak - 1)
    episode = window(clean_days, episode_start, today)
    low = values(episode, energy)
    usual_energy = avg(usual_period(clean_days, episode_start), energy)
    energy_range = (
        "–" if not low else str(int(min(low))) if min(low) == max(low) else f"{int(min(low))}–{int(max(low))}"
    )

    timeline = [TimelineEntry(date=episode_start, text=t["episode"].format(n=days_in_row_text(streak, lang)))]
    if top:
        timeline.append(
            TimelineEntry(
                date=analysis_day,
                text=t["analysis"].format(
                    cause=CAUSE_NAMES[lang][top.id],
                    confidence=CONFIDENCE_NAMES[lang][top.confidence],
                    evidence=cause_evidence(top, lang),
                ),
            )
        )
    period_start = today - dt.timedelta(days=PERIOD_DAYS - 1)
    nights: dict[dt.date, list[str]] = {}
    for point in excluded:
        if point.date >= period_start:
            nights.setdefault(point.date, []).append(t[f"metric_{point.metric}"])
    for date, metrics in nights.items():
        timeline.append(TimelineEntry(date=date, text=t["excluded"].format(metrics=", ".join(metrics))))
    if experiment:
        timeline.append(
            TimelineEntry(date=experiment.start, text=t["start"].format(name=EXPERIMENT_NAMES[lang][experiment.cause_id]))
        )
        if result and result.status in ("improved", "not_improved", "not_enough_data"):
            end = experiment.start + dt.timedelta(days=experiment.days - 1)
            timeline.append(TimelineEntry(date=end, text=t["end"].format(result=result_text(result, lang))))
    timeline.sort(key=lambda entry: entry.date)

    period = window(clean_days, period_start, today)
    trends = [
        Trend(title=t["chart_energy"], note=t["chart_note"], chart=daily_chart(period, energy, "energy", "/5", usual_energy))
    ]
    usual_rhr = avg(usual_period(clean_days, episode_start), resting_hr)
    if values(period, resting_hr):
        trends.append(
            Trend(
                title=t["chart_resting_hr"],
                note=t["chart_note"],
                chart=daily_chart(period, resting_hr, "resting_hr", "bpm", usual_rhr),
            )
        )
    if top and top.chart and top.chart.metric in ("weekly_load", "sleep_hours", "stress"):
        trends.append(Trend(title=t[f"chart_{top.chart.metric}"], note=t["chart_note"], chart=top.chart))

    cause_ids = {cause.id for cause in detective.causes}
    questions = []
    if top and top.id in ("load_spike", "rhr_elevated"):
        questions.append(t["q_load"])
    if "sleep_debt" in cause_ids:
        questions.append(t["q_sleep"])
    if "stress_spike" in cause_ids:
        questions.append(t["q_stress"])
    rhr_now = avg(last_days(clean_days, 7, today), resting_hr)
    if rhr_now is not None and usual_rhr is not None and rhr_now - usual_rhr >= 5:
        questions.append(t["q_rhr"].format(diff=round(rhr_now - usual_rhr)))
    if experiment and result and result.status == "not_improved":
        questions.append(t["q_not_improved"].format(name=EXPERIMENT_NAMES[lang][experiment.cause_id]))
    questions.append(t["q_closing"])

    has_watch = detective.data_level == "full"
    return DoctorSummary(
        lang=lang,
        title=t["title"],
        patient=f"{profile.name}, {age_text(profile.age, lang)}",
        period_start=period_start,
        period_end=today,
        data_level=detective.data_level,
        sources=t["sources_watch"] if has_watch else t["sources_basic"],
        complaint=t["complaint"].format(
            days=days_text((today - episode_start).days + 1, lang), range=energy_range, usual=fmt(usual_energy, lang)
        ),
        timeline=timeline,
        trends=trends,
        tried=tried_text(clean_days, experiment, lang),
        result=result_text(result, lang),
        questions=questions,
        bring=list(t["bring"]),
        disclaimer=t["disclaimer"].format(watch=t["disclaimer_watch"] if has_watch else ""),
    )
