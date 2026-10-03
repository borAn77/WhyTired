"""Hand-written explanation texts in English and Polish: the fallback for every LLM call.

detective_text() writes the detective card, summary_text() the "In short" paragraph of the
doctor summary.

The detective templates are built only from engine numbers (Evidence.value / .baseline, the
history deltas, the count of excluded nights), never from the engine's English sentences.
That keeps the Polish text fully Polish. The summary template reuses the summary's own texts,
which the page already shows in its language. Every template passes the same validator as
LLM answers (tests/test_llm.py), so it never contains a blocked term or a number that is
not in the input.

Polish copy uses gender-neutral forms (no "byłeś/byłaś") and "pkt" instead of declined
"punktów". It should be read once by a native speaker before the demo.
"""

from __future__ import annotations

from ..models import Cause, CauseId, Confidence, DataLevel, DetectiveResult, Evidence, Lang

# Sentence 1: the top cause with its key numbers. {days} = low-energy days in a row.
# The other fields come from the cause's Evidence (see CAUSE_FIELDS).
CAUSE_SENTENCES: dict[CauseId, dict[Lang, str]] = {
    "load_spike": {
        "en": "After {days} low-energy days in a row, the most likely reason is your training "
        "load: {value} load points this week, against your usual {baseline} a week",
        "pl": "Po {days} dniach z rzędu z niską energią najbardziej prawdopodobną przyczyną jest "
        "obciążenie treningowe: {value} pkt w tym tygodniu, wobec zwykłych {baseline} pkt tygodniowo",
    },
    "sleep_debt": {
        "en": "After {days} low-energy days in a row, the most likely reason is too little sleep: "
        "{value} h a night this week against your usual {baseline} h, about {debt} h short in total",
        "pl": "Po {days} dniach z rzędu z niską energią najbardziej prawdopodobną przyczyną jest "
        "zbyt krótki sen: średnio {value} h na noc w tym tygodniu, wobec zwykłych {baseline} h, "
        "czyli łącznie około {debt} h mniej",
    },
    "stress_spike": {
        "en": "After {days} low-energy days in a row, the most likely reason is higher stress: "
        "{value} out of 5 this week, against your usual {baseline}",
        "pl": "Po {days} dniach z rzędu z niską energią najbardziej prawdopodobną przyczyną jest "
        "stres wyższy niż zwykle: średnio {value} na 5 w tym tygodniu, wobec zwykłych {baseline}",
    },
    "rhr_elevated": {
        "en": "After {days} low-energy days in a row, the most likely reason is your raised resting "
        "heart rate: {value} bpm this week, against your usual {baseline} bpm",
        "pl": "Po {days} dniach z rzędu z niską energią najbardziej prawdopodobną przyczyną jest "
        "podwyższone tętno spoczynkowe: {value} uderzeń/min w tym tygodniu, wobec zwykłych {baseline}",
    },
}

# Which Evidence.metric fills {value} and {baseline} (and {debt} for sleep).
CAUSE_FIELDS: dict[CauseId, str] = {
    "load_spike": "weekly_load",
    "sleep_debt": "sleep_hours",
    "stress_spike": "stress",
    "rhr_elevated": "resting_hr",
}

# Used when a cause's evidence is missing, so the sentence still works.
CAUSE_NAMES: dict[CauseId, dict[Lang, str]] = {
    "load_spike": {"en": "your training load", "pl": "obciążenie treningowe"},
    "sleep_debt": {"en": "too little sleep", "pl": "zbyt krótki sen"},
    "stress_spike": {"en": "higher stress than usual", "pl": "stres wyższy niż zwykle"},
    "rhr_elevated": {"en": "your raised resting heart rate", "pl": "podwyższone tętno spoczynkowe"},
}
GENERIC_CAUSE = {
    "en": "After {days} low-energy days in a row, the most likely reason is {name}",
    "pl": "Po {days} dniach z rzędu z niską energią najbardziej prawdopodobną przyczyną jest {name}",
}
# Safety net for a cause id added to the engine before its templates exist: the demo
# keeps working (no KeyError) and the Polish text stays Polish. test_llm.py fails until
# the new id gets real templates above.
UNKNOWN_CAUSE = {
    "en": "After {days} low-energy days in a row, the most likely reason is the first one shown below",
    "pl": "Po {days} dniach z rzędu z niską energią najbardziej prawdopodobna przyczyna jest "
    "pokazana poniżej jako pierwsza",
}

CONFIDENCE: dict[Confidence, dict[Lang, str]] = {
    "high": {"en": "high confidence", "pl": "pewność wysoka"},
    "medium": {"en": "medium confidence", "pl": "pewność średnia"},
    "low": {"en": "low confidence", "pl": "pewność niska"},
}
# Basic level (no watch): say what the finding rests on, so less data reads as less certainty.
CHECKINS_ONLY = {"en": ", based on check-ins only", "pl": ", tylko na podstawie ankiet"}

# Sentence 2: the user's own history backs up the cause. Named like the engine's weeks.
HISTORY_WEEKS: dict[CauseId, dict[Lang, str]] = {
    "load_spike": {"en": "lightest training week", "pl": "najlżejszym tygodniu treningowym"},
    "sleep_debt": {"en": "best-sleep week", "pl": "tygodniu z najdłuższym snem"},
    "stress_spike": {"en": "calmest week", "pl": "najspokojniejszym tygodniu"},
    "rhr_elevated": {"en": "calmest week", "pl": "najspokojniejszym tygodniu"},
}
DEFAULT_WEEK = {"en": "best comparable week", "pl": "najlepszym porównywalnym tygodniu"}
HISTORY = {
    "en": "Your own history backs this up: in your {week}, {changes} than normal.",
    "pl": "Potwierdza to Twoja historia: w {week} {changes} niż zwykle.",
}
HISTORY_ENERGY = {"en": "your energy was {delta} points higher", "pl": "energia była wyższa o {delta} pkt"}
HISTORY_RHR = {
    "en": "your resting heart rate was {delta} bpm lower",
    "pl": "tętno spoczynkowe było niższe o {delta} uderzeń/min",
}
AND = {"en": " and ", "pl": ", a "}

# Sentence 3: unreliable watch nights that were left out.
EXCLUDED = {
    "en": "We left out {n} {nights} of watch data that looked like a sensor error.",
    "pl": "Pominęliśmy {n} {nights} z danymi z zegarka, które wyglądały na błąd czujnika.",
}

# Sentence 4: the next step. The English title comes from the engine; the Polish text
# points at the plan card instead, so it never goes out of date when the engine changes.
NEXT_STEP = {
    "en": "Next step: {title}.",
    "pl": "Następny krok: wypróbuj przez {days} dni plan opisany poniżej.",
}

NO_CAUSE = {
    "en": "Your energy has been low for {days} days in a row, but none of the usual reasons "
    "(training load, sleep, stress) stands out in your data. If this continues, it is worth "
    "talking to your family doctor.",
    "pl": "Już {days} dni z rzędu Twoja energia jest niska, ale w Twoich danych nie widać żadnej "
    "z typowych przyczyn (obciążenie treningowe, sen, stres). Jeśli to się utrzyma, warto "
    "porozmawiać z lekarzem rodzinnym.",
}
NOT_TRIGGERED = {
    "en": "Your energy looks normal, so there is nothing to explain right now.",
    "pl": "Twoja energia wygląda normalnie, więc na razie nie ma czego wyjaśniać.",
}


# Doctor summary, "In short" paragraph. Impersonal and gender-neutral, for a doctor.
SUMMARY_INTRO = {
    "en": "Summary of the last {days} days, based on {source}.",
    "pl": "Podsumowanie ostatnich {days} dni; źródło danych: {source}.",
}
DATA_SOURCES: dict[DataLevel, dict[Lang, str]] = {
    "full": {
        "en": "a sports watch, daily check-ins and logged training",
        "pl": "zegarek sportowy, codzienne ankiety i zapis treningów",
    },
    "medium": {
        "en": "daily check-ins, logged training and phone measurements",
        "pl": "codzienne ankiety, zapis treningów i pomiary z telefonu",
    },
    "basic": {
        "en": "daily check-ins and logged training (no watch)",
        "pl": "codzienne ankiety i zapis treningów (bez zegarka)",
    },
}
SUMMARY_TRIED = {"en": "What was tried: {text}", "pl": "Wypróbowany plan: {text}"}
SUMMARY_RESULT = {"en": "Result: {text}", "pl": "Wynik: {text}"}


def summary_text(facts: dict, lang: Lang) -> str:
    """The "In short" template, from the same facts dict the LLM receives (explain.summary_facts):
    period and data source, the complaint, what was tried and the result."""
    sentences = [
        SUMMARY_INTRO[lang].format(days=facts["period_days"], source=DATA_SOURCES[facts["data_level"]][lang])
    ]
    if facts["complaint"]:
        sentences.append(_sentence(facts["complaint"]))
    if facts["tried"]:
        sentences.append(SUMMARY_TRIED[lang].format(text=_sentence(facts["tried"])))
    if facts["result"]:
        sentences.append(SUMMARY_RESULT[lang].format(text=_sentence(facts["result"])))
    return " ".join(sentences)


def detective_text(result: DetectiveResult, lang: Lang) -> str:
    """2-4 sentences: top cause with numbers, history check, excluded nights, next step."""
    if not result.triggered:
        return NOT_TRIGGERED[lang]
    if not result.causes:
        return NO_CAUSE[lang].format(days=result.low_energy_days)

    top = result.causes[0]
    sentences = [_cause_sentence(top, result.low_energy_days, lang)]
    history = _history_sentence(top, lang)
    if history:
        sentences.append(history)
    nights = excluded_nights(result)
    if nights:
        sentences.append(EXCLUDED[lang].format(n=nights, nights=_nights(nights, lang)))
    if result.suggested_experiment:
        plan = result.suggested_experiment
        sentences.append(NEXT_STEP[lang].format(title=_lower_first(plan.title), days=plan.days))
    return " ".join(sentences)


def excluded_nights(result: DetectiveResult) -> int:
    """Excluded points are per metric; one bad night can exclude sleep and resting HR."""
    return len({point.date for point in result.excluded})


def _cause_sentence(cause: Cause, days: int, lang: Lang) -> str:
    main = _evidence(cause, CAUSE_FIELDS.get(cause.id, ""))
    debt = _evidence(cause, "sleep_debt")
    if cause.id not in CAUSE_SENTENCES:
        text = UNKNOWN_CAUSE[lang].format(days=days)
    elif main is None or main.baseline is None or (cause.id == "sleep_debt" and debt is None):
        text = GENERIC_CAUSE[lang].format(days=days, name=CAUSE_NAMES[cause.id][lang])
    else:
        text = CAUSE_SENTENCES[cause.id][lang].format(
            days=days,
            value=number(main.value, lang),
            baseline=number(main.baseline, lang),
            debt=number(debt.value, lang) if debt else "",
        )
    basis = CHECKINS_ONLY[lang] if cause.data_level_used == "basic" else ""
    return f"{text} ({CONFIDENCE[cause.confidence][lang]}{basis})."


def _history_sentence(cause: Cause, lang: Lang) -> str | None:
    history = cause.history_check
    if history is None or not history.supports:
        return None
    changes = []
    if history.energy_delta is not None and history.energy_delta > 0:
        changes.append(HISTORY_ENERGY[lang].format(delta=number(history.energy_delta, lang)))
    if history.rhr_delta is not None and history.rhr_delta < 0:
        changes.append(HISTORY_RHR[lang].format(delta=number(abs(history.rhr_delta), lang)))
    if not changes:
        return None
    week = HISTORY_WEEKS.get(cause.id, DEFAULT_WEEK)[lang]
    return HISTORY[lang].format(week=week, changes=AND[lang].join(changes))


def _evidence(cause: Cause, metric: str) -> Evidence | None:
    return next((e for e in cause.evidence if e.metric == metric), None)


def number(value: float, lang: Lang) -> str:
    """At most 1 decimal; Polish uses a decimal comma (5,4)."""
    text = f"{value:.0f}" if float(value).is_integer() else f"{value:.1f}"
    return text.replace(".", ",") if lang == "pl" else text


def _nights(n: int, lang: Lang) -> str:
    if lang == "en":
        return "night" if n == 1 else "nights"
    if n == 1:
        return "noc"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return "noce"
    return "nocy"


def _sentence(text: str) -> str:
    text = text.strip()
    return text if text.endswith((".", "!", "?")) else text + "."


def _lower_first(text: str) -> str:
    """'Cut your training load...' -> 'cut your training load...' (keeps acronyms like 'HR')."""
    if len(text) > 1 and text[0].isupper() and text[1].islower():
        return text[0].lower() + text[1:]
    return text
