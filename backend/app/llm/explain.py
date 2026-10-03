"""Plain-language explanations of rule-engine findings (docs/PLAN.md "LLM layer interface").

    explain_detective(result, lang) -> Explanation(text, source="llm" | "template")
    explain_summary(summary)        -> Explanation: the "In short" paragraph of the doctor
                                       summary, in summary.lang (Polish for the demo)

How both work:
1. Build the facts JSON: only aggregated values, no name, no dates, no raw time series
   (privacy: a whitelist, so new engine fields never leak to the LLM).
2. Build the template text (templates.py). It is the fallback and good on its own.
3. Ask the LLM to explain the same facts. Its answer is shown only if it passes
   validate.check() and the checks in _acceptable(); otherwise the template is shown.
"""

from __future__ import annotations

import json
import logging
import re

from ..engine.causes import HISTORY_FACTORS
from ..models import DataLevel, DetectiveResult, DoctorSummary, Explanation, HistoryCheck, Lang
from . import providers, templates, validate

log = logging.getLogger("whytired.llm")

MAX_CHARS = 700  # detective card: 2-4 sentences fit easily
SUMMARY_MAX_CHARS = 900  # "In short" paragraph; Polish needs a little more room
LANGUAGES: dict[Lang, str] = {"en": "English", "pl": "Polish"}
POLISH_LETTERS = re.compile(r"[ąćęłńóśźż]", re.IGNORECASE)

SYSTEM_PROMPT = """You write short explanations for WhyTired, an app that helps young adults who train regularly understand why they feel tired.
The app's rule engine has already found and ranked the likely causes and computed every number. Your only job is to explain its findings in plain, friendly words.

Rules:
- Keep the engine's ranking and confidence levels. Do not add causes or advice that are not in the findings.
- Use only numbers that appear in the findings, written without thousands separators. Do not calculate new numbers.
- Never diagnose: do not name diseases or conditions, and never write "you have", "diagnosis", "syndrome" or "overtraining".
- Never mention medication, supplements, vitamins or doses.
- Never suggest lab tests or blood tests.
- Mention heart rate or HRV only if the findings contain them.
- Calm, kind, plain language. No medical jargon, no emojis, no lists, no headings."""

NO_HEART_DATA = (
    "\n- This person has no smartwatch data (Basic data level). Never mention heart rate, "
    "HRV, pulse or bpm."
)

POLISH_STYLE = (
    " Use gender-neutral Polish (avoid forms like 'byłeś/byłaś' or 'zmęczony/zmęczona') "
    "and do not use the word 'masz'."
)

HISTORY_INSTRUCTION = "Say which week was compared and how it differed; never describe it as an earlier spike."

# ---------- detective ----------


def explain_detective(result: DetectiveResult, lang: Lang) -> Explanation:
    """2-4 plain sentences in `lang` about the detective findings. Never raises.

    Polish always uses the template, without calling the LLM: Haiku's Polish detective text
    was ungrammatical and flipped the logic of the history check, while the Polish templates
    read well. (The Polish doctor summary paragraph still uses the LLM.)
    """
    template = templates.detective_text(result, lang)
    if not result.triggered or lang == "pl":  # main.py only calls us when triggered
        return Explanation(text=template, source="template")

    facts_text = facts_json(result)
    answer = providers.complete(
        system_prompt(result.data_level),
        detective_prompt(facts_text, lang),
        fallback=template,
        validate=lambda text: _acceptable(text, facts_text, lang, result.data_level, MAX_CHARS),
    )
    return Explanation(text=answer["text"], source=answer["source"])


def detective_facts(result: DetectiveResult) -> dict:
    """The only data the LLM sees (docs/PLAN.md): computed findings, no identifiers."""
    experiment = result.suggested_experiment
    return {
        "low_energy_days": result.low_energy_days,
        "data_level": result.data_level,
        "causes": [  # ranked by the engine: the first one is the most likely
            {
                "id": cause.id,
                "title": cause.title,
                "confidence": cause.confidence,
                "evidence": [
                    {"text": e.text, "value": e.value, "baseline": e.baseline, "unit": e.unit}
                    for e in cause.evidence
                ],
                "history": _history(cause.id, cause.history_check),
            }
            for cause in result.causes
        ],
        "excluded_nights": templates.excluded_nights(result),
        "experiment": experiment.title if experiment else None,
    }


def _history(cause_id: str, check: HistoryCheck | None) -> dict | None:
    """The history check, worded so the LLM cannot get its direction wrong.

    The engine compares the past week with the LEAST of a factor (e.g. the lightest training
    week) with all other past days. With only {supports, energy_delta, rhr_delta} the model
    guessed which week was compared and wrote "when your load spiked before, your energy
    dipped". So the payload names the week and puts the direction in the key names:
    energy_delta > 0 becomes "energy_higher_that_week", rhr_delta < 0 becomes
    "resting_hr_lower_that_week", both with the absolute value. A difference that is None
    (no watch: no resting HR) or 0 is left out, so it does not even appear as a key.
    """
    if check is None:
        return None
    factor = HISTORY_FACTORS.get(cause_id)
    week = f"your {factor[1]}" if factor else "your easiest past week for this factor"
    if check.period_tag:
        week += f" (your {check.period_tag} week)"
    payload: dict = {
        "compared_week": week,
        "compared_with": "your normal days",
        "supports_this_cause": check.supports,
    }
    if check.energy_delta:
        direction = "higher" if check.energy_delta > 0 else "lower"
        payload[f"energy_{direction}_that_week"] = abs(check.energy_delta)
    if check.rhr_delta:
        direction = "lower" if check.rhr_delta < 0 else "higher"
        payload[f"resting_hr_{direction}_that_week"] = abs(check.rhr_delta)
    return payload


def facts_json(result: DetectiveResult) -> str:
    """The exact text the LLM receives. The validator uses the same text as the truth."""
    return json.dumps(detective_facts(result), ensure_ascii=False, indent=1)


def detective_prompt(facts_text: str, lang: Lang) -> str:
    style = POLISH_STYLE if lang == "pl" else ""
    return (
        f"Findings (JSON):\n{facts_text}\n\n"
        f"Write 2-4 plain sentences in {LANGUAGES[lang]}, speaking to the user as \"you\".{style} "
        "Cover: the most likely cause with its key numbers and confidence (if data_level is "
        "basic, say it is based on check-ins only); whether the user's own history supports it "
        f"({HISTORY_INSTRUCTION}); how many unreliable nights were left out (only if more than 0); "
        "and the suggested experiment as the next step. Return only the sentences."
    )


# ---------- doctor summary ----------


def explain_summary(summary: DoctorSummary) -> Explanation:
    """The "In short" paragraph at the top of the doctor summary, in summary.lang. Never raises.

    Expects the summary's texts (complaint, timeline, trends, tried, result) to be written in
    summary.lang already, as the summary page shows them. The questions and the disclaimer
    are not touched: they are fixed copy on the page, never generated.
    """
    facts = summary_facts(summary)
    facts_text = json.dumps(facts, ensure_ascii=False, indent=1)
    answer = providers.complete(
        system_prompt(summary.data_level),
        summary_prompt(facts_text, summary.lang),
        fallback=templates.summary_text(facts, summary.lang),
        validate=lambda text: _acceptable(
            text, facts_text, summary.lang, summary.data_level, SUMMARY_MAX_CHARS
        ),
    )
    return Explanation(text=answer["text"], source=answer["source"])


def summary_facts(summary: DoctorSummary) -> dict:
    """The only data the LLM sees for the summary. Left out on purpose: the patient's name,
    every date (the timeline counts days back from the end of the period instead), the chart
    points (raw time series), the questions and the disclaimer. The template is built from
    the same dict, so the LLM and the template always see the same data."""
    name = summary.patient.split(",")[0].strip()

    def private(text: str) -> str:
        return _without_name(_without_dates(text), name)

    return {
        "data_level": summary.data_level,
        "period_days": (summary.period_end - summary.period_start).days + 1,
        "complaint": private(summary.complaint),
        "timeline": [
            {"days_before_end": (summary.period_end - entry.date).days, "text": private(entry.text)}
            for entry in summary.timeline
        ],
        "trends": [{"title": private(t.title), "note": private(t.note)} for t in summary.trends],
        "tried": private(summary.tried),
        "result": private(summary.result),
    }


def summary_prompt(facts_text: str, lang: Lang) -> str:
    style = (
        " Use impersonal, gender-neutral Polish (e.g. 'utrzymuje się', 'wypróbowano'; no "
        "'byłem/byłam') and do not use the word 'masz'."
        if lang == "pl"
        else ""
    )
    return (
        f"Summary facts (JSON):\n{facts_text}\n\n"
        "Write the 'In short' paragraph at the top of a one-page summary that the person will "
        f"bring to their family doctor (POZ). Write 2-4 plain sentences in {LANGUAGES[lang]}, in a "
        f"factual, neutral tone for a doctor, without 'I', 'you' or a name.{style} "
        "Cover: the main complaint and for how long, what the data shows, what was tried and the "
        "result. Do not add questions or a disclaimer; the page already has them. "
        "Return only the paragraph."
    )


# Dates are never sent to the LLM (docs/PLAN.md). Engine texts can contain them,
# e.g. "In your holiday week (5–11 Aug)", so they are removed: ISO dates, "5 Aug",
# "5–11 sie", "Oct 5" and "05.10.2026". Months are whole words, so "5 marathons" stays.
_MONTH = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
    r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
    r"|stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października"
    r"|listopada|grudnia|sty|lut|kwi|maj|cze|lip|sie|wrz|paź|lis|gru)\b\.?"
)
_DAY_RANGE = r"\d{1,2}\.?(?:\s*[–-]\s*\d{1,2}\.?)?"
_DATES = re.compile(
    rf"\b\d{{4}}-\d{{2}}-\d{{2}}\b"
    rf"|\b\d{{1,2}}\.\d{{1,2}}\.\d{{4}}\b"
    rf"|\b{_DAY_RANGE}\s+{_MONTH}(?:\s+\d{{4}})?"
    rf"|\b{_MONTH}\s+{_DAY_RANGE}(?:,?\s+\d{{4}})?",
    re.IGNORECASE,
)
_EMPTY_BRACKETS = re.compile(r"\(\s*[–,-]?\s*\)")


def _without_dates(text: str) -> str:
    text = _EMPTY_BRACKETS.sub("", _DATES.sub("", text))
    return re.sub(r"\s+([,.;:])", r"\1", re.sub(r"\s{2,}", " ", text)).strip()


def _without_name(text: str, name: str) -> str:
    """Defensive: the engine should not put the name in texts, but if it does, drop it."""
    if not name:
        return text
    return re.sub(rf"\s*\b{re.escape(name)}\b", "", text).strip()


# ---------- shared ----------


def system_prompt(level: DataLevel) -> str:
    return SYSTEM_PROMPT + (NO_HEART_DATA if level == "basic" else "")


def _acceptable(text: str, facts_text: str, lang: Lang, level: DataLevel, max_chars: int) -> bool:
    """All checks on one LLM answer. Problems are logged so the demo log shows why."""
    problems = validate.check(text, facts_text)
    if level == "basic" and validate.mentions_heart_data(text):
        problems.append("heart data for a user without a watch")  # even if an engine text has it
    if len(text) > max_chars:
        problems.append(f"too long ({len(text)} characters)")
    if lang == "pl" and not POLISH_LETTERS.search(text):
        problems.append("asked for Polish, got no Polish letters")
    if problems:
        log.warning("LLM answer rejected: %s", "; ".join(dict.fromkeys(problems)))
    return not problems
