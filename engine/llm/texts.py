"""The three texts WhyTired shows, each with a hand-written template fallback.

    explain_daily(plan)                      -> {"text": 2 English sentences, ...}
    explain_evidence(evidence, signals_used) -> {"items": [{"type", "text", "plain"}], ...}
    doctor_brief(investigation, lang="pl")   -> {"summary", "timeline", "data_to_bring",
                                                 "questions_for_doctor", "disclaimer", "text", ...}

Every result also carries "source" ("llm" or "fallback"), "provider", "model",
"latency_ms" and "reason", so the demo can show which path was used.

How every function works:
  1. Clean the engine JSON: keep only whitelisted fields (privacy) and, for a
     person without watch data, drop anything about heart rate / HRV.
  2. Build the template text from the cleaned data. This is the fallback and
     is good enough on its own.
  3. Ask the LLM to reword the same cleaned facts. If the LLM is off, slow, or
     its answer fails prompts.check_output(), the template is used.

Two personas: (1) a runner with a smartwatch, (2) a gym user with only a daily
check-in. The engine lists the signals it used in "signals_used". Without
resting_hr / hrv_rmssd there, we never talk about heart rate or HRV.
"""
from __future__ import annotations

import json
import logging

from . import prompts
from .client import complete, get_config
from .prompts import DISCLAIMER, mentions_heart_data

log = logging.getLogger("whytired.llm")

SIGNALS_KEY = "signals_used"
HEART_SIGNALS = {"resting_hr", "hrv_rmssd", "sleep_hr_max"}
# Used by the engine for artifact detection only; not worth showing a doctor.
INTERNAL_SIGNALS = {"sleep_hr_max", "sleep_motion", "night_data_coverage", "device_firmware"}

# Hypotheses in plain, non-diagnostic words. We never call it "overtraining":
# overtraining syndrome is a clinical diagnosis (see DECISIONS.md).
HYPOTHESIS_LABELS = {
    "overtraining":      {"en": "too much training load", "pl": "zbyt duże obciążenie treningowe"},
    "sleep_debt":        {"en": "too little sleep", "pl": "niedobór snu"},
    "infection":         {"en": "an infection", "pl": "infekcja"},
    "iron_deficiency":   {"en": "low iron", "pl": "niski poziom żelaza"},
    "measurement_error": {"en": "a measurement problem (not the body)", "pl": "błąd pomiaru (nie organizm)"},
}

SIGNAL_LABELS = {
    "resting_hr":     {"en": "resting heart rate", "pl": "tętno spoczynkowe"},
    "hrv_rmssd":      {"en": "heart rate variability (HRV)", "pl": "zmienność rytmu serca (HRV)"},
    "sleep_hours":    {"en": "sleep duration", "pl": "długość snu"},
    "steps":          {"en": "daily steps", "pl": "liczba kroków"},
    "training_load":  {"en": "training load", "pl": "obciążenie treningowe"},
    "longest_run_km": {"en": "longest run (km)", "pl": "najdłuższy bieg (km)"},
    "soreness":       {"en": "muscle soreness (1-5)", "pl": "bolesność mięśni (1-5)"},
    "mood":           {"en": "mood (1-5)", "pl": "nastrój (1-5)"},
    "energy":         {"en": "energy (1-5)", "pl": "poziom energii (1-5)"},
    "feeling_sick":   {"en": "feeling sick (yes/no)", "pl": "złe samopoczucie (tak/nie)"},
    "workout_log":    {"en": "workout log", "pl": "dziennik treningów"},
}

# Evidence types we know: a short label and one sentence on why it matters.
# Unknown types still work: they get the engine's text and the effect sentence.
EVIDENCE_TYPES = {
    "natural_experiment": {
        "label": {"en": "Natural experiment", "pl": "Naturalny eksperyment"},
        "why": "That works like a natural experiment: your routine changed, "
               "and we can see how your body responded.",
    },
    "load_trend": {
        "label": {"en": "Training load", "pl": "Obciążenie treningowe"},
        "why": "Training load measures how much and how hard you trained; when it "
               "rises fast, the body has less time to adapt.",
    },
    "artifact_excluded": {
        "label": {"en": "Excluded data", "pl": "Pominięte dane"},
        "why": "We left this out on purpose: it looks like a sensor glitch, "
               "not something your body did.",
    },
}

# Daily decision -> (sentence 1 opening, sentence 2 ending).
DAILY = {
    "rest": ("Today is a rest day", "resting today keeps your week on track"),
    "easy": ("Today is an easy day", "an easy day now keeps your week on track"),
    "hard": ("Today is a good day for a hard session",
             "make the most of it and ease off if something feels wrong"),
}

# Questions the person could ask; written by us, never by the LLM.
QUESTIONS = {
    "overtraining": {
        "en": "Could the tiredness come from too much training load, and how can I "
              "return to full training safely?",
        "pl": "Czy zmęczenie może wynikać ze zbyt dużego obciążenia treningowego i jak "
              "bezpiecznie wrócić do pełnych treningów?",
    },
    "sleep_debt": {
        "en": "Could the tiredness be linked to too little sleep, and what would be worth changing?",
        "pl": "Czy zmęczenie może mieć związek ze zbyt krótkim snem i co warto zmienić?",
    },
    "infection": {
        "en": "Is it worth checking whether an infection is behind the tiredness?",
        "pl": "Czy warto sprawdzić, czy przyczyną zmęczenia nie jest infekcja?",
    },
    "iron_deficiency": {
        "en": "Is it worth checking my iron levels?",
        "pl": "Czy warto sprawdzić poziom żelaza?",
    },
}

BRIEF_TEXT = {
    "pl": {
        "title": "WhyTired – podsumowanie dla lekarza rodzinnego (POZ)",
        "h_summary": "Podsumowanie",
        "h_timeline": "Przebieg",
        "h_data": "Co zabrać na wizytę",
        "h_questions": "Pytania do lekarza",
        "source_watch": "Dane pochodzą z zegarka sportowego oraz codziennej ankiety samopoczucia.",
        "source_checkin": "Dane pochodzą z codziennej ankiety samopoczucia i dziennika treningów.",
        "trigger": "Aplikacja rozpoczęła analizę, ponieważ: {}.",
        "likely": "Najbardziej prawdopodobne wyjaśnienia według aplikacji "
                  "(szacunek, nie ocena lekarska): {}.",
        "experiment": "Plan na najbliższe 7 dni: {}.",
        "now": "Obecnie: {}",
        "observation": "Obserwacja",
        "charts": "Wykresy z aplikacji WhyTired: {}",
        "experiment_results": "Wyniki 7-dniowej próby z aplikacji (jeśli została już zakończona)",
        "recent_changes": "Krótka notatka o ostatnich zmianach: stres, studia lub praca, "
                          "dieta, podróże, niedawne choroby",
        "generic_question": "Czy {} może mieć związek ze zmęczeniem?",
        "closing_question": "Na jakie objawy warto zwrócić uwagę i kiedy wrócić na kolejną wizytę?",
    },
    "en": {
        "title": "WhyTired – summary for the family doctor",
        "h_summary": "Summary",
        "h_timeline": "Timeline",
        "h_data": "What to bring",
        "h_questions": "Questions for the doctor",
        "source_watch": "The data comes from a sports watch and a daily well-being check-in.",
        "source_checkin": "The data comes from a daily well-being check-in and a workout log.",
        "trigger": "The app started looking into this because of: {}.",
        "likely": "Most likely explanations according to the app "
                  "(an estimate, not a medical opinion): {}.",
        "experiment": "Plan for the next 7 days: {}.",
        "now": "Now: {}",
        "observation": "Observation",
        "charts": "Charts from the WhyTired app: {}",
        "experiment_results": "Results of the 7-day experiment from the app (if finished)",
        "recent_changes": "A short note on recent changes: stress, studies or work, "
                          "diet, travel, recent illness",
        "generic_question": "Could {} be linked to the tiredness?",
        "closing_question": "Which warning signs should I look out for, and when should I come back?",
    },
}


# --- 1. explain_daily ---------------------------------------------------------

def explain_daily(plan: dict) -> dict:
    """Two friendly English sentences for the daily HARD / EASY / REST card.

    Put the result's "text" into the plan's "explanation_text".
    """
    heart = _heart_allowed(plan.get(SIGNALS_KEY), plan.get("reasons") or [])
    facts = {  # whitelist: the date and any other field are not sent
        "decision": str(plan.get("decision") or "").strip().lower(),
        "reasons": _clean_list(plan.get("reasons"), heart),
        "plan_change": _clean(plan.get("plan_change"), heart),
    }
    facts_text = prompts.facts_json(facts)

    def is_ok(answer: str) -> bool:
        if len(answer) > 400:
            return _reject("answer too long for the daily card")
        if not prompts.mentions_decision(answer, facts["decision"]):
            return _reject(f"answer does not state the decision '{facts['decision']}'")
        return _passes(answer, facts_text)

    result = complete(
        prompts.system_prompt(heart),
        prompts.daily_prompt(facts_text),
        fallback=_daily_template(facts),
        validate=is_ok,
        max_tokens=150,
    )
    return {"text": result["text"], **_meta(result)}


def _daily_template(facts: dict) -> str:
    decision = facts["decision"]
    opening, ending = DAILY.get(decision, (f"Today's plan: {decision or 'ready'}",
                                           "listen to your body today"))
    first = opening
    if facts["reasons"]:
        first += ", based on " + _join_and([_lower_first(r) for r in facts["reasons"]])
    if facts["plan_change"]:
        second = f"Plan update: {_lower_first(facts['plan_change'])}, so {ending}."
    else:
        second = ending[0].upper() + ending[1:] + "."
    return f"{first}. {second}"


# --- 2. explain_evidence ------------------------------------------------------

def explain_evidence(evidence: list[dict], signals_used: list[str] | None = None) -> dict:
    """Plain-language text for each evidence item of an investigation.

    Pass the investigation's "signals_used" too, so persona 2 never sees heart data.
    Returns {"items": [{"type", "text" (engine original), "plain"}], ...}.
    """
    evidence = evidence or []
    heart = _heart_allowed(signals_used, [e.get("text") for e in evidence])
    items = _clean_evidence(evidence, heart, "en")
    if not items:
        return {"items": [], **_no_call("no evidence to explain")}

    facts = [
        {
            "kind": _type_label(e["type"], "en"),
            "observation": e["text"],
            "points_to": [_label(h, "en") for sign, h in _effects(e["effect"]) if sign == "+"],
            "makes_less_likely": [_label(h, "en") for sign, h in _effects(e["effect"]) if sign == "-"],
        }
        for e in items
    ]
    facts_text = prompts.facts_json(facts)

    def is_ok(answer: str) -> bool:
        data = prompts.parse_json_object(answer)
        texts = data.get("items") if data else None
        if not (isinstance(texts, list) and len(texts) == len(items)
                and all(isinstance(t, str) and t.strip() for t in texts)):
            return _reject(f"expected JSON with {len(items)} item texts")
        return _passes(" ".join(texts), facts_text)

    fallback = {"items": [_evidence_template(e) for e in items]}
    result = complete(
        prompts.system_prompt(heart),
        prompts.evidence_prompt(facts_text, len(items)),
        fallback=json.dumps(fallback, ensure_ascii=False),
        validate=is_ok,
        max_tokens=600,
        expect_json=True,
    )
    plain = prompts.parse_json_object(result["text"])["items"]
    return {
        "items": [{"type": e["type"], "text": e["text"], "plain": p.strip()}
                  for e, p in zip(items, plain)],
        **_meta(result),
    }


def _evidence_template(item: dict) -> str:
    parts = [_sentence(item["text"])]
    why = EVIDENCE_TYPES.get(item["type"], {}).get("why")
    if why:
        parts.append(why)
    for sign, hypothesis in _effects(item["effect"]):
        if sign == "+":
            parts.append(f"This points towards {_label(hypothesis, 'en')}.")
        else:
            parts.append(f"This makes {_label(hypothesis, 'en')} less likely.")
    return " ".join(parts)


# --- 3. doctor_brief ----------------------------------------------------------

def doctor_brief(investigation: dict, lang: str = "pl") -> dict:
    """One-page brief for the family doctor (POZ). Polish by default, "en" also works.

    The LLM may only reword "summary" and "timeline". The questions and the
    data list always come from our templates, and the disclaimer is always
    added by code, so the safety-relevant parts are never generated.
    """
    lang = lang if lang in BRIEF_TEXT else "pl"
    inv = _clean_investigation(investigation, lang)
    template = _brief_template(inv, lang)

    facts = {
        "data_source": BRIEF_TEXT[lang]["source_watch" if inv["heart"] else "source_checkin"],
        "trigger": inv["trigger"],
        "explanations": [{"name": _label(h["id"], lang), "app_estimate_percent": h["percent"]}
                         for h in inv["hypotheses"][:3]],
        "observations": [{"kind": _type_label(e["type"], lang), "text": e["text"]}
                         for e in inv["evidence"]],
        "planned_7_day_experiment": inv["experiment"],
    }
    facts_text = prompts.facts_json(facts)

    def is_ok(answer: str) -> bool:
        data = prompts.parse_json_object(answer)
        if not data:
            return _reject("answer is not a JSON object")
        summary, timeline = data.get("summary"), data.get("timeline")
        if not (isinstance(summary, str) and summary.strip() and isinstance(timeline, list)
                and 1 <= len(timeline) <= 10
                and all(isinstance(t, str) and t.strip() for t in timeline)):
            return _reject("expected 'summary' text and a 'timeline' list")
        return _passes(" ".join([summary, *timeline]), facts_text)

    fallback = {"summary": template["summary"], "timeline": template["timeline"]}
    result = complete(
        prompts.system_prompt(inv["heart"]),
        prompts.brief_prompt(facts_text, lang),
        fallback=json.dumps(fallback, ensure_ascii=False),
        validate=is_ok,
        max_tokens=600,
        expect_json=True,
    )
    written = prompts.parse_json_object(result["text"])
    disclaimer = DISCLAIMER[lang]

    brief = {
        # If the LLM added the disclaimer itself, remove it; code adds it once.
        "summary": written["summary"].replace(disclaimer, "").strip(),
        "timeline": [t.replace(disclaimer, "").strip() for t in written["timeline"]],
        "data_to_bring": template["data_to_bring"],
        "questions_for_doctor": template["questions_for_doctor"],
        "disclaimer": disclaimer,
        "lang": lang,
    }
    brief["text"] = _render_brief(brief, lang)
    return {**brief, **_meta(result)}


def _brief_template(inv: dict, lang: str) -> dict:
    t = BRIEF_TEXT[lang]

    summary = [t["source_watch"] if inv["heart"] else t["source_checkin"]]
    if inv["trigger"]:
        summary.append(t["trigger"].format(_strip_end(inv["trigger"])))
    if inv["hypotheses"]:
        top = ", ".join(f"{_label(h['id'], lang)} ({h['percent']}%)" for h in inv["hypotheses"][:3])
        summary.append(t["likely"].format(top))
    if inv["experiment"]["title"]:
        summary.append(t["experiment"].format(_strip_end(inv["experiment"]["title"])))

    timeline = [f"{_type_label(e['type'], lang)}: {_sentence(e['text'])}" for e in inv["evidence"]]
    if inv["trigger"]:
        timeline.append(t["now"].format(_sentence(inv["trigger"])))

    signals = [SIGNAL_LABELS.get(s, {}).get(lang, s.replace("_", " "))
               for s in inv["signals"] if s not in INTERNAL_SIGNALS]
    data_to_bring = [t["charts"].format(", ".join(signals))] if signals else []
    if inv["experiment"]["title"]:
        data_to_bring.append(t["experiment_results"])
    data_to_bring.append(t["recent_changes"])

    # Measurement error is the app's problem, not a question for the doctor.
    medical = [h["id"] for h in inv["hypotheses"] if h["id"] != "measurement_error"][:3]
    questions = [QUESTIONS.get(h, {}).get(lang) or t["generic_question"].format(_label(h, lang))
                 for h in medical]
    questions.append(t["closing_question"])

    return {"summary": " ".join(summary), "timeline": timeline,
            "data_to_bring": data_to_bring, "questions_for_doctor": questions}


def _render_brief(brief: dict, lang: str) -> str:
    """Plain-text page for printing or sharing. Always ends with the disclaimer."""
    t = BRIEF_TEXT[lang]
    lines = [t["title"], "", t["h_summary"], brief["summary"], ""]
    for heading, items in ((t["h_timeline"], brief["timeline"]),
                           (t["h_data"], brief["data_to_bring"]),
                           (t["h_questions"], brief["questions_for_doctor"])):
        if items:
            lines += [heading, *[f"- {item}" for item in items], ""]
    lines.append(brief["disclaimer"])
    return "\n".join(lines)


# --- Cleaning engine JSON (privacy whitelist + persona filter) ----------------

def _heart_allowed(signals_used, texts) -> bool:
    """May we talk about heart rate / HRV? Uses the engine's signal list if given."""
    if signals_used is not None:
        return bool(HEART_SIGNALS & set(signals_used))
    return any(mentions_heart_data(str(t)) for t in texts if t)


def _clean(text, heart: bool) -> str:
    """Engine text without trailing dot, or "" if it is about heart data we may not show."""
    text = _strip_end(str(text or ""))
    if text and not heart and mentions_heart_data(text):
        log.warning("Dropped engine text about heart data (no watch data): %r", text)
        return ""
    return text


def _clean_list(texts, heart: bool) -> list[str]:
    return [t for t in (_clean(x, heart) for x in texts or []) if t]


def _clean_evidence(evidence: list[dict], heart: bool, lang: str) -> list[dict]:
    items = []
    for e in evidence:
        text = _clean(_localized(e, "text", lang), heart)
        if text:
            items.append({"type": str(e.get("type") or ""), "text": text,
                          "effect": str(e.get("effect") or "")})
    return items


def _clean_investigation(inv: dict, lang: str) -> dict:
    experiment = inv.get("suggested_experiment") or {}
    evidence = inv.get("evidence") or []
    texts = [inv.get("trigger"), *(e.get("text") for e in evidence), *experiment.values()]
    heart = _heart_allowed(inv.get(SIGNALS_KEY), texts)

    hypotheses = sorted(
        (h for h in inv.get("hypotheses") or [] if h.get("id")),
        key=lambda h: -float(h.get("prob") or 0),
    )
    signals = inv.get(SIGNALS_KEY)
    if signals is None:  # engine did not say; show the common ones
        signals = ["sleep_hours", "training_load", "soreness", "mood"]
        if heart:
            signals = ["resting_hr", "hrv_rmssd", *signals]
    return {
        "heart": heart,
        "signals": [s for s in signals if heart or s not in HEART_SIGNALS],
        "trigger": _clean(_localized(inv, "trigger", lang), heart),
        "hypotheses": [{"id": str(h["id"]), "percent": round(float(h.get("prob") or 0) * 100)}
                       for h in hypotheses],
        "evidence": _clean_evidence(evidence, heart, lang),
        "experiment": {k: _clean(_localized(experiment, k, lang), heart)
                       for k in ("title", "measure", "success_if")},
    }


def _localized(data: dict, key: str, lang: str):
    """Use a translated twin like "text_pl" if the engine provides one."""
    return data.get(f"{key}_{lang}") or data.get(key)


# --- Small helpers ----------------------------------------------------------

def _label(hypothesis_id: str, lang: str) -> str:
    known = HYPOTHESIS_LABELS.get(hypothesis_id)
    return known[lang] if known else hypothesis_id.replace("_", " ")


def _type_label(evidence_type: str, lang: str) -> str:
    known = EVIDENCE_TYPES.get(evidence_type)
    return known["label"][lang] if known else BRIEF_TEXT[lang]["observation"]


def _effects(effect: str) -> list[tuple[str, str]]:
    """'+overtraining' -> [('+', 'overtraining')]. Also accepts '+a,-b'."""
    pairs = []
    for part in effect.split(","):
        part = part.strip()
        if len(part) > 1 and part[0] in "+-":
            pairs.append((part[0], part[1:].strip()))
    return pairs


def _passes(answer: str, facts_text: str) -> bool:
    problems = prompts.check_output(answer, facts_text)
    return _reject("; ".join(problems)) if problems else True


def _reject(why: str) -> bool:
    log.warning("LLM answer rejected: %s", why)
    return False


def _meta(result: dict) -> dict:
    return {k: result[k] for k in ("source", "provider", "model", "latency_ms", "reason")}


def _no_call(reason: str) -> dict:
    cfg = get_config()
    return {"source": "fallback", "provider": cfg["provider"], "model": cfg["model"],
            "latency_ms": 0, "reason": reason}


def _strip_end(text: str) -> str:
    return text.strip().rstrip(".").strip()


def _sentence(text: str) -> str:
    text = text.strip()
    return text if text.endswith((".", "!", "?")) else text + "."


def _lower_first(text: str) -> str:
    """'Soreness 4/5' -> 'soreness 4/5', but keep acronyms: 'HRV 42' stays."""
    if len(text) > 1 and text[0].isupper() and text[1].islower():
        return text[0].lower() + text[1:]
    return text


def _join_and(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]
