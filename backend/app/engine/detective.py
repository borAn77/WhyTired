"""Detective mode, end to end: clean the data, run the rules, score, rank, suggest an experiment."""

from __future__ import annotations

from ..models import Cause, DataLevel, DayRecord, DetectiveResult
from . import artifacts
from .baselines import last_days
from .causes import (
    LOW_ENERGY_STREAK,
    TITLES,
    Signal,
    candidate_signals,
    history_check,
    low_energy_streak,
    objective_support,
    score_confidence,
)
from .experiment import suggest_experiment

CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1}


def available_level(days: list[DayRecord]) -> DataLevel:
    """The richest data level actually present in the last 28 days."""
    recent = last_days(days, 28, days[-1].date)
    if any(day.watch for day in recent):
        return "full"
    if any(day.manual_pulse is not None or day.steps is not None for day in recent):
        return "medium"
    return "basic"


def build_cause(signal: Signal, days: list[DayRecord], level: DataLevel) -> Cause:
    today = days[-1].date
    history = history_check(days, today, signal.cause_id)
    objective = objective_support(days, today, signal.cause_id)
    confidence, score, checks = score_confidence(signal, history, objective, level)
    return Cause(
        id=signal.cause_id,
        title=TITLES[signal.cause_id],
        confidence=confidence,
        score=score,
        strength=round(signal.strength, 2),
        checks=checks,
        evidence=signal.evidence,
        history_check=history,
        data_level_used=level,
        chart=signal.chart,
    )


def run_detective(days: list[DayRecord]) -> DetectiveResult:
    """`days` are already cut at "today" and restricted to the chosen data level (see store.py).
    Causes are ranked by confidence first, then by how big the change is."""
    clean_days, excluded = artifacts.clean(days)
    today = clean_days[-1].date
    level = available_level(clean_days)
    streak = low_energy_streak(clean_days)

    causes = [build_cause(signal, clean_days, level) for signal in candidate_signals(clean_days, today)]
    causes.sort(key=lambda cause: (CONFIDENCE_RANK[cause.confidence], cause.strength), reverse=True)

    triggered = streak >= LOW_ENERGY_STREAK
    experiment = suggest_experiment(causes[0], clean_days, today, level) if triggered and causes else None
    return DetectiveResult(
        triggered=triggered,
        low_energy_days=streak,
        data_level=level,
        causes=causes,
        excluded=excluded,
        suggested_experiment=experiment,
        explanation=None,  # filled in by app/llm (teammate) in M2
    )
