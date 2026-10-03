"""Plain-language explanations of rule-engine findings (docs/PLAN.md "LLM layer interface").

    explain_detective(result, lang) -> Explanation(text, source="llm" | "template")

How it works:
1. Build the findings JSON from the DetectiveResult: only aggregated values, no name, no
   dates, no raw time series (privacy: a whitelist, so new engine fields never leak).
2. Build the template text (templates.py). It is the fallback and good on its own.
3. Ask the LLM to explain the same findings. Its answer is shown only if it passes
   validate.check() and the checks below; otherwise the template is shown.
"""

from __future__ import annotations

import json
import logging
import re

from ..models import DataLevel, DetectiveResult, Explanation, HistoryCheck, Lang
from . import providers, templates, validate

log = logging.getLogger("whytired.llm")

MAX_CHARS = 700  # 2-4 sentences fit easily; anything longer would not fit the card
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


def explain_detective(result: DetectiveResult, lang: Lang) -> Explanation:
    """2-4 plain sentences in `lang` about the detective findings. Never raises."""
    template = templates.detective_text(result, lang)
    if not result.triggered:  # main.py only calls us when triggered; nothing to explain
        return Explanation(text=template, source="template")

    facts_text = facts_json(result)
    answer = providers.complete(
        system_prompt(result.data_level),
        detective_prompt(facts_text, lang),
        fallback=template,
        validate=lambda text: _acceptable(text, facts_text, lang),
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
                "history": _history(cause.history_check),
            }
            for cause in result.causes
        ],
        "excluded_nights": templates.excluded_nights(result),
        "experiment": experiment.title if experiment else None,
    }


def _history(check: HistoryCheck | None) -> dict | None:
    """Empty values are left out: a missing rhr_delta (no watch) must not even appear as a key."""
    if check is None:
        return None
    values = {"supports": check.supports, "energy_delta": check.energy_delta, "rhr_delta": check.rhr_delta}
    return {key: value for key, value in values.items() if value is not None}


def facts_json(result: DetectiveResult) -> str:
    """The exact text the LLM receives. The validator uses the same text as the truth."""
    return json.dumps(detective_facts(result), ensure_ascii=False, indent=1)


def system_prompt(level: DataLevel) -> str:
    return SYSTEM_PROMPT + (NO_HEART_DATA if level == "basic" else "")


def detective_prompt(facts_text: str, lang: Lang) -> str:
    style = POLISH_STYLE if lang == "pl" else ""
    return (
        f"Findings (JSON):\n{facts_text}\n\n"
        f"Write 2-4 plain sentences in {LANGUAGES[lang]}, speaking to the user as \"you\".{style} "
        "Cover: the most likely cause with its key numbers and confidence; whether the user's "
        "own history supports it; how many unreliable nights were left out (only if more than 0); "
        "and the suggested experiment as the next step. Return only the sentences."
    )


def _acceptable(text: str, facts_text: str, lang: Lang) -> bool:
    """All checks on one LLM answer. Problems are logged so the demo log shows why."""
    problems = validate.check(text, facts_text)
    if len(text) > MAX_CHARS:
        problems.append(f"too long ({len(text)} characters)")
    if lang == "pl" and not POLISH_LETTERS.search(text):
        problems.append("asked for Polish, got no Polish letters")
    if problems:
        log.warning("LLM answer rejected: %s", "; ".join(problems))
    return not problems
