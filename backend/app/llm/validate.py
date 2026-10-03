"""Checks on every LLM answer. If any check fails, the caller shows its template instead.

1. Numbers: every number in the answer must exist in the input JSON. Polish decimal commas
   are normalised (6,5 = 6.5), thousands separators are ignored (2,700 = 2 700 = 2700) and
   the same rounding is allowed (12.5 may be written 12,5, 13 or 12, but 7.1 never as 8).
   A sign is ignored, so "6 bpm lower" matches rhr_delta -6.
2. Blocked terms, EN + PL, whole words only: diagnoses and diseases, medication and
   supplements, lab and blood tests. "lekarz" (doctor) passes but "leki" (medication) does
   not; "label" passes but "lab" does not. Polish words are listed as stems (diagnoz\\w*),
   which still match whole words only.
3. Heart data: the answer may mention heart rate, HRV or pulse only if the input does, so
   a user without a watch (Basic data level) never reads about it.

The checks are deliberately strict: a false alarm only means the template is shown.
"""

from __future__ import annotations

import math
import re


def _words(*patterns: str) -> re.Pattern:
    """One case-insensitive pattern that matches any of `patterns` as whole words."""
    return re.compile(r"\b(?:" + "|".join(patterns) + r")\b", re.IGNORECASE)


# Telling someone what they "have" is a diagnosis. "Overtraining" is avoided too:
# overtraining syndrome is a clinical diagnosis by exclusion.
DIAGNOSES = _words(
    r"you have", r"you've got", r"suffer(?:s|ing)? from", r"diagnos\w*", r"syndrom\w*",
    r"overtrain\w*", r"diseases?", r"disorders?", r"infections?", r"viral", r"virus\w*",
    r"flu", r"covid\w*", r"an(?:a)?emi\w*", r"deficienc\w*", r"thyroid\w*", r"hypothyroid\w*",
    r"diabet\w*", r"depression", r"burnout", r"chronic fatigue",
    r"masz", r"cierpisz", r"diagnoz\w*", r"zdiagnozow\w*", r"przetrenowan\w*",
    r"chorob\w*", r"choroba", r"infekcj\w*", r"wirus\w*", r"gryp\w*", r"anemi\w*",
    r"niedokrwisto\w*", r"niedob[oó]r\w* żelaza", r"tarczyc\w*", r"cukrzyc\w*", r"depresj\w*",
    r"wypaleni\w*",
)

MEDICATION = _words(
    r"medications?", r"medicines?", r"drugs?", r"pills?", r"tablets?", r"capsules?",
    r"dos(?:e|es|age|ing)", r"prescri\w*", r"supplements?", r"vitamins?", r"ibuprofen",
    r"paracetamol", r"acetaminophen", r"aspirin", r"naproxen", r"melatonin", r"magnesium",
    r"antibiotics?", r"antidepressants?", r"\d+(?:[.,]\d+)? ?(?:mg|mcg|µg)",
    r"lek", r"leki", r"leków", r"lekami", r"lekach", r"leku", r"lekiem", r"lekarstw\w*",
    r"tabletk\w*", r"kapsułk\w*", r"dawk\w*", r"recept\w*", r"suplement\w*", r"witamin\w*",
    r"ibuprofen\w*", r"paracetamol\w*", r"aspiryn\w*", r"melatonin\w*", r"magnez\w*",
    r"antybiotyk\w*",
)

LAB_TESTS = _words(
    r"labs?", r"laborator\w*", r"blood ?(?:tests?|work|panels?)", r"bloodwork", r"ferritin",
    r"ha?emoglobin", r"cbc", r"tsh", r"(?:get|take|do|order|book)(?: \w+){0,3} tests?",
    r"get tested", r"badani\w* krwi", r"badani\w* laboratoryjn\w*", r"morfologi\w*",
    r"ferrytyn\w*", r"hemoglobin\w*",
    r"(?:zrób|zrobić|zróbcie|wykonaj|wykonać|zleć|zlecić)(?: \w+){0,3} badani\w*",
)

HEART_DATA = _words(
    r"heart ?rates?", r"heart ?beats?", r"hrv", r"hr", r"rhr\w*", r"resting_hr\w*", r"bpm", r"pulse", r"rmssd",
    r"tętn\w*", r"puls\w*", r"rytm\w* serca", r"uderze\w*",
)

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
# "2,700" (EN) and "2 700" (PL) are one number: drop a separator followed by exactly 3 digits.
_THOUSANDS = re.compile(r"(?<=\d)[,\u00a0\u202f ](?=\d{3}(?!\d))")


def blocked_terms(text: str) -> list[str]:
    """Every diagnosis, medication or lab-test term found in `text`, in order of the groups."""
    return [match.group(0) for pattern in (DIAGNOSES, MEDICATION, LAB_TESTS) for match in pattern.finditer(text)]


def mentions_heart_data(text: str) -> bool:
    return bool(HEART_DATA.search(text))


def numbers_in(text: str) -> set[float]:
    """All numbers in `text`, with Polish decimal commas read as dots. Signs are ignored."""
    text = _THOUSANDS.sub("", text)
    return {float(raw.replace(",", ".")) for raw in _NUMBER.findall(text)}


def _roundings(value: float) -> set[float]:
    """The ways a number may be written: as is, to 1 decimal, or whole. A .5 may go either way."""
    return {
        value,
        math.floor(value * 10 + 0.5) / 10,
        float(math.floor(value + 0.5)),
        float(math.ceil(value - 0.5)),
    }


def invented_numbers(text: str, source_text: str) -> list[str]:
    """Numbers in `text` that do not exist in `source_text`, even after rounding."""
    allowed = set().union(*(_roundings(value) for value in numbers_in(source_text)))
    return sorted(f"{value:g}" for value in numbers_in(text) if value not in allowed)


def check(text: str, source_text: str) -> list[str]:
    """All problems with an LLM answer. An empty list means it is safe to show.

    `source_text` is the exact JSON the LLM received; it is the only source of truth.
    """
    problems = [f"blocked term '{term}'" for term in blocked_terms(text)]
    invented = invented_numbers(text, source_text)
    if invented:
        problems.append(f"numbers not in the input: {invented}")
    if mentions_heart_data(text) and not mentions_heart_data(source_text):
        problems.append("mentions heart data that is not in the input")
    return problems
