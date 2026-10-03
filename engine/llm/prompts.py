"""What we send to the LLM, and how we check what comes back.

Three layers of safety, so the LLM is never trusted on its own:
  1. System prompt: the rules (no diagnosis, no medication, no test orders,
     no new numbers, no heart data that the facts do not contain).
  2. Facts only: the user prompt is a small JSON of aggregated values that
     texts.py builds from a whitelist of fields. No names, no raw time series.
  3. Output check: `check_output()` rejects any answer that breaks a rule.
     The caller then uses its hand-written template instead.

The checks are deliberately strict. A false alarm only means the template is
shown instead of the LLM text, which is always safe.
"""
from __future__ import annotations

import json
import re

# Added by code (never by the LLM) to the end of every doctor brief.
DISCLAIMER = {
    "pl": "To nie jest diagnoza medyczna.",
    "en": "This is not a medical diagnosis.",
}

# --- 1. System prompt --------------------------------------------------------

_RULES = """You write short texts for WhyTired, an app that helps young adults who train regularly understand why they feel tired.
The app's engine has already made every decision and computed every number. Your only job is to put the given facts into plain, friendly words.

Rules:
- Never change, add or remove a decision. Never add advice that is not in the facts.
- Use only numbers and dates that appear in the facts, copied exactly.
- Never diagnose. Do not say the person has a condition. Do not use the words "diagnosis", "syndrome" or "overtraining".
- Never mention medication, supplements, vitamins or doses.
- Never tell anyone to get a medical test. Only phrase things as questions the person could ask their doctor.
- Mention heart rate or HRV only if the facts mention them.
- Calm, kind, plain language. No medical jargon. No emojis."""

_NO_HEART_DATA = ("\n- This person has no smartwatch data. Never mention heart rate, "
                  "HRV, pulse or bpm.")


def system_prompt(heart_data: bool) -> str:
    """Guardrails for every call. Persona 2 (no watch) gets one extra rule."""
    return _RULES if heart_data else _RULES + _NO_HEART_DATA


# --- 2. User prompts (facts + task) ------------------------------------------

def facts_json(facts) -> str:
    """The exact text the LLM sees. Also used by check_output() as the truth."""
    return json.dumps(facts, ensure_ascii=False, indent=1)


def daily_prompt(facts_text: str) -> str:
    return (
        f"Facts (JSON):\n{facts_text}\n\n"
        'Write exactly 2 short, friendly sentences in English, talking to the user as "you". '
        "Sentence 1: today's decision and the main reasons. "
        "Sentence 2: the plan change if there is one, otherwise a short encouraging "
        "remark with no new advice. Return only the 2 sentences."
    )


def evidence_prompt(facts_text: str, count: int) -> str:
    return (
        f"Facts (JSON):\n{facts_text}\n\n"
        f"For each of the {count} evidence items, write 1-2 plain sentences in English "
        "for a young adult who trains regularly: what was observed (keep numbers and "
        "dates exactly) and what it means for the listed explanations. "
        f'Return only JSON: {{"items": [...]}} with exactly {count} strings, in the same order.'
    )


def brief_prompt(facts_text: str, lang: str) -> str:
    if lang == "pl":
        language = ("Polish. Use gender-neutral Polish: avoid forms like "
                    "'byłem/byłam' or 'zmęczony/zmęczona'")
    else:
        language = "English"
    return (
        f"Facts (JSON):\n{facts_text}\n\n"
        "Write two parts of a one-page brief that the person will hand to their "
        f"family doctor. Write in {language}.\n"
        "Return only JSON with exactly these keys:\n"
        '  "summary": 2-3 sentences: why the app started looking into this, the most '
        "likely explanations with the app's percent estimates, and the planned "
        "7-day experiment.\n"
        '  "timeline": a list of short points, one per observation, with the '
        "current situation as the last point.\n"
        "Translate the facts faithfully. Keep every number and date exactly as in the "
        "facts. Do not add a disclaimer; the app adds it."
    )


# --- 3. Output checks ---------------------------------------------------------

def _compile(patterns):
    return [re.compile(p, re.IGNORECASE) for p in patterns]


# Telling someone what they "have" is a diagnosis. We also avoid
# "overtraining": overtraining syndrome is a clinical diagnosis (DECISIONS.md).
_DIAGNOSIS = _compile([
    r"\byou have\b", r"\byou've got\b", r"\bsuffer(s|ing)? from\b",
    r"diagnos\w*", r"\bsyndrome\b", r"\bovertrain\w*", r"\bana?emi\w*", r"\bdeficien\w*",
    r"\bmasz\b", r"\bcierpisz\b", r"diagnoz\w*", r"przetrenowan\w*",
    r"niedokrwisto\w*", r"niedob[oó]r żelaza",
])

_MEDICATION = _compile([
    r"\b(ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|diclofenac|ketoprofen"
    r"|metamizol\w*|melatonin\w*|antibiotic\w*|antybiotyk\w*|aspiryn\w*|pyralgin\w*|steroid\w*)\b",
    r"\b(medication|medicine|drug|pill|tablet|capsule|dose|dosage|supplement|vitamin)s?\b",
    r"\bprescri\w*",
    r"\b(lek|leki|leków|lekami|lekach|leku|lekiem)\b",   # does not match "lekarz" (doctor)
    r"\b(tabletk\w*|kapsułk\w*|dawk\w*|recept\w*|suplement\w*|witamin\w*)",
    r"\b\d+(?:[.,]\d+)?\s?(mg|mcg|µg)\b",
])

_TEST_ORDERS = _compile([
    r"\b(get|take|do|order|book|schedule|need)\b(\s+\w+){0,3}\s+tests?\b",
    r"\bblood (test|work|panel)s?\b", r"\bferritin\b",
    r"\b(zrób|zrobić|wykonaj|wykonać|zleć|zlecić)\b(\s+\w+){0,3}\s+badani\w*",
    r"\bbadani\w* krwi\b", r"\bmorfologi\w*", r"\bferrytyn\w*",
])

_HEART_TERMS = re.compile(
    r"\bheart[- ]?rate\b|\bheart ?beat|\bhrv\b|\bhr\b|\bbpm\b|\brmssd\b"
    r"|\bpuls\w*|\btętn\w*|rytm\w* serca",
    re.IGNORECASE,
)

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")

_DECISION_WORDS = {
    "rest": re.compile(r"\brest\b", re.IGNORECASE),            # not "resting HR"
    "easy": re.compile(r"\beas(y|ier|ily)\b", re.IGNORECASE),
    "hard": re.compile(r"\bhard\b", re.IGNORECASE),
}


def find_forbidden(text: str) -> list[str]:
    """Every diagnosis, medication or test-order phrase found in `text`.

    The fixed disclaimer is removed first: "To nie jest diagnoza medyczna."
    contains "diagnoza" but is exactly the sentence we want.
    """
    for sentence in DISCLAIMER.values():
        text = text.replace(sentence, " ")
    found = []
    for pattern in _DIAGNOSIS + _MEDICATION + _TEST_ORDERS:
        match = pattern.search(text)
        if match:
            found.append(match.group(0))
    return found


def mentions_heart_data(text: str) -> bool:
    return bool(_HEART_TERMS.search(text))


def numbers_in(text: str) -> set[str]:
    """Numbers in a canonical form: '5,5' and '5.5' match, '09' and '9' match."""
    return {f"{float(raw.replace(',', '.')):g}" for raw in _NUMBER.findall(text)}


def mentions_decision(text: str, decision: str) -> bool:
    """The LLM must say the engine's decision (e.g. "rest"), so it cannot quietly drop it."""
    pattern = _DECISION_WORDS.get(decision)
    return pattern is None or bool(pattern.search(text))


def check_output(text: str, facts_text: str) -> list[str]:
    """All rule violations in an LLM answer; an empty list means it is safe to show."""
    problems = [f"forbidden phrase '{p}'" for p in find_forbidden(text)]
    if mentions_heart_data(text) and not mentions_heart_data(facts_text):
        problems.append("mentions heart data that is not in the facts")
    invented = numbers_in(text) - numbers_in(facts_text)
    if invented:
        problems.append(f"numbers not in the facts: {sorted(invented)}")
    return problems


def parse_json_object(text: str) -> dict | None:
    """Read a JSON object from an LLM answer, tolerating ```json fences around it."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
