"""Daily coach: hard / easy / rest for today only, with short reasons.

Counts "red flags" in this morning's data: 0 → hard training is fine, 1–2 → easy, 3+ → rest.
Two safety rules come from Berken's first coach (engine/coach.py on feature/engine-core):
feeling ill always means rest, and never two hard days in a row.
"""

from __future__ import annotations

import datetime as dt

from ..models import CoachResult, DayRecord, Experiment, PlannedSession, Recommendation
from .baselines import avg, resting_hr, sleep_hours, usual_period, watch_sleep_hours, window
from .causes import LOW_ENERGY_STREAK, low_energy_streak
from .load import injury_warning, load_ratio

RHR_FLAG_BPM = 5.0  # resting HR this much above your usual
SLEEP_FLAG_H = 1.5  # slept this much less than usual
LOW_ENERGY = 2  # energy 1–2 of 5
HIGH_SORENESS = 4  # soreness 4–5 of 5
HIGH_STRESS = 4  # stress 4–5 of 5
LOAD_FLAG = 1.3  # last 7 days' load × your usual week
HARD_RPE = 7  # effort 7+ of 10 counts as a hard session (session RPE, Foster et al., 2001)
MAX_REASONS = 3
LOAD_CUT_EXPERIMENTS = {"load_spike", "rhr_elevated"}  # experiments that keep training easy


def usual(days: list[DayRecord], today: dt.date, metric) -> float | None:
    """Your usual = the same 28 days the detective uses (before this week), so a bad week
    can't pull down its own yardstick."""
    return avg(usual_period(days, today), metric)


def day_of(days: list[DayRecord], date: dt.date) -> DayRecord | None:
    found = window(days, date, date)
    return found[0] if found else None


def red_flags(days: list[DayRecord], today: dt.date, count_load: bool = True) -> list[str]:
    """Each flag is one reason not to train hard today, most personal first.
    Check-in answers come first: how you feel is the most sensitive signal (Saw et al., 2016)."""
    day = day_of(days, today)
    flags: list[str] = []
    checkin = day.checkin if day else None
    if checkin and checkin.energy <= LOW_ENERGY:
        flags.append(f"Low energy this morning ({checkin.energy} out of 5)")

    rhr, usual_rhr = (resting_hr(day) if day else None), usual(days, today, resting_hr)
    if rhr is not None and usual_rhr is not None and rhr - usual_rhr >= RHR_FLAG_BPM:
        flags.append(f"Resting heart rate {round(rhr)} bpm, {round(rhr - usual_rhr)} above your usual")

    slept, usual_sleep = (sleep_hours(day) if day else None), usual(days, today, sleep_hours)
    if slept is not None and usual_sleep is not None and usual_sleep - slept >= SLEEP_FLAG_H:
        flags.append(f"You slept {slept:.1f} h, {usual_sleep - slept:.1f} h less than usual")

    if checkin and checkin.soreness >= HIGH_SORENESS:
        flags.append(f"Very sore muscles ({checkin.soreness} out of 5)")
    if checkin and checkin.stress >= HIGH_STRESS:
        flags.append(f"High stress ({checkin.stress} out of 5)")

    ratio = load_ratio(days, today - dt.timedelta(days=1)) if count_load else None  # up to yesterday
    if ratio is not None and ratio >= LOAD_FLAG:
        flags.append(f"Your last 7 days of training were {ratio:.1f}× your usual week")
    return flags


def was_hard(day: DayRecord | None) -> bool:
    """A day with a session at effort 7/10 or higher."""
    return bool(day) and any(session.rpe >= HARD_RPE for session in day.sessions)  # type: ignore[union-attr]


def experiment_day(experiment: Experiment | None, today: dt.date) -> int | None:
    """Day number (1..n) if an experiment is running today, else None."""
    if experiment is None:
        return None
    number = (today - experiment.start).days + 1
    return number if 1 <= number <= experiment.days else None


def all_clear_reason(days: list[DayRecord], today: dt.date) -> str:
    day = day_of(days, today)
    parts = []
    if day and day.checkin:
        parts.append(f"energy {day.checkin.energy} out of 5")
    if day and sleep_hours(day) is not None:
        parts.append(f"{sleep_hours(day):.1f} h of sleep")
    if day and resting_hr(day) is not None:
        parts.append("resting heart rate at your usual")
    return f"All clear: {', '.join(parts)}." if parts else "Nothing in your data says to hold back."


def coach_today(
    days: list[DayRecord],
    today: dt.date,
    experiment: Experiment | None = None,
    planned: PlannedSession | None = None,
) -> CoachResult:
    """Today's recommendation. `days` are cleaned (artifacts removed) and cut at today."""
    day = day_of(days, today)
    checkin = day.checkin if day else None
    number = experiment_day(experiment, today)
    cutting_load = bool(number and experiment and experiment.cause_id in LOAD_CUT_EXPERIMENTS)
    flags = red_flags(days, today, count_load=not cutting_load)  # already acting on the load

    recommendation: Recommendation
    if checkin and checkin.ill:
        recommendation = "rest"
        reasons = ["You feel ill. We never coach through illness: rest today, and see a doctor if it gets worse."]
    else:
        recommendation = "hard" if not flags else "easy" if len(flags) <= 2 else "rest"
        reasons = flags[:MAX_REASONS]
        if recommendation == "hard" and was_hard(day_of(days, today - dt.timedelta(days=1))):
            recommendation = "easy"
            reasons = ["Yesterday was a hard session, and two hard days in a row raise the strain."]
        if recommendation == "hard" and cutting_load:
            recommendation = "easy"
            reasons = [f"Day {number} of your experiment: keep every session easy (effort 5 or lower)."]
        if recommendation == "hard":
            reasons = [all_clear_reason(days, today)]

    measured = watch_sleep_hours(day) if day else None
    return CoachResult(
        recommendation=recommendation,
        reasons=reasons,
        injury_warning=injury_warning(planned, days, today) if planned else None,
        detective_triggered=low_energy_streak(days) >= LOW_ENERGY_STREAK,
        has_checkin=checkin is not None,
        checkin=checkin,
        measured_sleep_hours=round(measured, 1) if measured is not None else None,
    )

