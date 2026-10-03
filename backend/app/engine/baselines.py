"""Building blocks for every rule: date windows, metric getters and personal baselines.

Conventions used by all rules:
- "this week"  = the last 7 days, today included
- "your usual" = the 28 days before this week (a personal baseline, not a population norm)
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Callable
from statistics import mean

from ..models import DayRecord

Metric = Callable[[DayRecord], float | None]

WEEK = 7
BASELINE_DAYS = 28


# ---------- windows ----------


def window(days: list[DayRecord], start: dt.date, end: dt.date) -> list[DayRecord]:
    """Days from `start` to `end`, both included."""
    return [day for day in days if start <= day.date <= end]


def last_days(days: list[DayRecord], n: int, end: dt.date) -> list[DayRecord]:
    """The `n` calendar days ending at `end`."""
    return window(days, end - dt.timedelta(days=n - 1), end)


def this_week(days: list[DayRecord], today: dt.date) -> list[DayRecord]:
    return last_days(days, WEEK, today)


def usual_period(days: list[DayRecord], today: dt.date) -> list[DayRecord]:
    """The 28 days before this week: what is 'normal' for this user."""
    return last_days(days, BASELINE_DAYS, today - dt.timedelta(days=WEEK))


# ---------- metrics (each returns None when the value is not available at this data level) ----------


def energy(day: DayRecord) -> float | None:
    return day.checkin.energy if day.checkin else None


def stress(day: DayRecord) -> float | None:
    return day.checkin.stress if day.checkin else None


def soreness(day: DayRecord) -> float | None:
    return day.checkin.soreness if day.checkin else None


def resting_hr(day: DayRecord) -> float | None:
    """Watch resting HR (Full level), otherwise the guided morning pulse (Medium level)."""
    if day.watch and day.watch.resting_hr is not None:
        return day.watch.resting_hr
    return day.manual_pulse


def hrv(day: DayRecord) -> float | None:
    return day.watch.hrv_ms if day.watch else None


def sleep_hours(day: DayRecord) -> float | None:
    """Measured sleep from the watch (Full level), otherwise the hours from the check-in."""
    if day.watch and day.watch.sleep_min is not None:
        return day.watch.sleep_min / 60
    return day.checkin.sleep_hours if day.checkin else None


def watch_sleep_hours(day: DayRecord) -> float | None:
    """Only watch-measured sleep (used to tell measured from self-reported sleep)."""
    if day.watch and day.watch.sleep_min is not None:
        return day.watch.sleep_min / 60
    return None


# ---------- aggregates ----------


def values(days: list[DayRecord], metric: Metric) -> list[float]:
    return [value for day in days if (value := metric(day)) is not None]


def avg(days: list[DayRecord], metric: Metric) -> float | None:
    found = values(days, metric)
    return mean(found) if found else None


def coverage(days: list[DayRecord], metric: Metric) -> float:
    """Share of days that have a value for this metric (0..1)."""
    if not days:
        return 0.0
    return len(values(days, metric)) / len(days)


def series(days: list[DayRecord], metric: Metric) -> list[tuple[dt.date, float | None]]:
    return [(day.date, metric(day)) for day in days]
