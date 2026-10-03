"""Sensor artifact rules: find unreliable watch readings and leave them out of the evidence.

`clean()` runs before every other rule. It returns the days with unreliable values removed
(set to None) plus a list of what was excluded and why, which the UI shows to the user.
"""

from __future__ import annotations

from statistics import mean, median

from ..models import DayRecord, ExcludedPoint, WatchDay
from .load import day_load

RHR_JUMP_BPM = 25  # overnight change that is too big to be real without a matching reason
RECENT_READINGS = 7  # valid readings that define your recent normal
RHR_MIN, RHR_MAX = 30, 120  # physiologically plausible resting HR range
MIN_SLEEP_COVERAGE = 0.5  # the watch must have recorded at least half of the night
FELT_DIFFERENT_POINTS = 2  # check-in change (energy or stress) that would explain a real HR change
HARD_DAY_FACTOR = 2.0  # a day with more than 2× the usual daily load could explain a real HR rise


def implausible_rhr(value: float) -> bool:
    """Resting HR below 30 or above 120 bpm is not plausible for this user group."""
    return value < RHR_MIN or value > RHR_MAX


def felt_different(day: DayRecord, previous: DayRecord) -> bool:
    """Did the check-in change enough (energy or stress ±2 points) to explain a real HR change?"""
    if not day.checkin or not previous.checkin:
        return False
    return (
        abs(day.checkin.energy - previous.checkin.energy) >= FELT_DIFFERENT_POINTS
        or abs(day.checkin.stress - previous.checkin.stress) >= FELT_DIFFERENT_POINTS
    )


def unexplained_rhr_jump(
    value: float,
    recent_valid: list[float],
    day: DayRecord,
    previous: DayRecord | None,
    usual_day_load: float,
) -> bool:
    """Resting HR moved more than 25 bpm away from the last valid reading AND from your recent
    normal (median of the last 7 valid readings), while neither the check-in nor the previous
    day's training changed much. Then the watch, not the body, is the likely cause (e.g. a
    loose strap). Checking the recent normal too means a return to normal after a real,
    explained rise is never flagged."""
    if not recent_valid or previous is None:
        return False
    if abs(value - recent_valid[-1]) <= RHR_JUMP_BPM or abs(value - median(recent_valid)) <= RHR_JUMP_BPM:
        return False
    trained_hard = usual_day_load > 0 and day_load(previous) > HARD_DAY_FACTOR * usual_day_load
    return not (felt_different(day, previous) or trained_hard)


def unreliable_sleep_reason(watch: WatchDay) -> str | None:
    """Sleep data is unreliable if most of the night is missing, or if the heart rate during
    sleep is above the daytime average (it should always be lower)."""
    if watch.sleep_coverage is not None and watch.sleep_coverage < MIN_SLEEP_COVERAGE:
        return f"Your watch recorded only {round(watch.sleep_coverage * 100)}% of the night."
    if (
        watch.sleep_hr_avg is not None
        and watch.day_hr_avg is not None
        and watch.sleep_hr_avg > watch.day_hr_avg
    ):
        return (
            f"Heart rate during sleep ({round(watch.sleep_hr_avg)} bpm) was higher than your "
            f"daytime average ({round(watch.day_hr_avg)} bpm), which is not physically plausible."
        )
    return None


def clean(days: list[DayRecord]) -> tuple[list[DayRecord], list[ExcludedPoint]]:
    """Apply the artifact rules in date order. Returns (cleaned days, excluded points)."""
    loads = [day_load(day) for day in days]
    usual_day_load = mean(loads) if loads else 0.0

    cleaned: list[DayRecord] = []
    excluded: list[ExcludedPoint] = []
    recent_valid: list[float] = []
    previous: DayRecord | None = None

    for day in days:
        watch = day.watch
        if watch is None:
            cleaned.append(day)
            previous = day
            continue

        drop: dict[str, None] = {}
        sleep_reason = unreliable_sleep_reason(watch)
        if sleep_reason:
            drop |= {"sleep_min": None, "sleep_hr_avg": None, "hrv_ms": None}
            excluded.append(
                ExcludedPoint(
                    date=day.date,
                    metric="sleep",
                    value=round(watch.sleep_min / 60, 1) if watch.sleep_min is not None else None,
                    reason=sleep_reason,
                )
            )

        rhr = watch.resting_hr
        if rhr is not None:
            reason = None
            if implausible_rhr(rhr):
                reason = f"{round(rhr)} bpm is outside the plausible range for resting heart rate."
            elif unexplained_rhr_jump(rhr, recent_valid, day, previous, usual_day_load):
                change = round(abs(rhr - recent_valid[-1]))
                reason = (
                    f"Resting heart rate jumped {change} bpm overnight, but your check-in and "
                    f"training did not change. This is most likely a measurement error "
                    f"(e.g. a loose strap)."
                )
            if reason:
                drop["resting_hr"] = None
                excluded.append(
                    ExcludedPoint(date=day.date, metric="resting_hr", value=rhr, reason=reason)
                )
            else:
                recent_valid = [*recent_valid, rhr][-RECENT_READINGS:]

        cleaned.append(
            day.model_copy(update={"watch": watch.model_copy(update=drop)}) if drop else day
        )
        previous = day

    return cleaned, excluded
