"""Training load rules."""

from __future__ import annotations

import datetime as dt
from statistics import median

from ..models import DayRecord, PlannedSession, Session
from .baselines import last_days, this_week, usual_period

INJURY_SPIKE = 1.10  # planned session > 110% of the longest session in the last 30 days


def session_load(session: Session) -> float:
    """Session RPE load = duration in minutes × effort 1–10 (Foster et al., 2001).

    The result is in arbitrary units; the app calls them "load points".
    """
    return session.duration_min * session.rpe


def day_load(day: DayRecord) -> float:
    return sum(session_load(session) for session in day.sessions)


def total_load(days: list[DayRecord]) -> float:
    return sum(day_load(day) for day in days)


def weekly_load(days: list[DayRecord], today: dt.date) -> float:
    """Load of the last 7 days."""
    return total_load(this_week(days, today))


def usual_weekly_load(days: list[DayRecord], today: dt.date) -> float:
    """Your usual week = the median of the 4 weekly loads before this week. The median means
    one unusual week (a holiday, or the first week of a spike) can't distort it
    (docs/DECISIONS.md, D11)."""
    period = usual_period(days, today)
    if not period:
        return 0.0
    end = period[-1].date
    weeks = [total_load(last_days(period, 7, end - dt.timedelta(days=7 * k))) for k in range(4)]
    return median(weeks)


def load_ratio(days: list[DayRecord], today: dt.date) -> float | None:
    """This week's load divided by the usual weekly load (1.0 = a normal week)."""
    usual = usual_weekly_load(days, today)
    if usual <= 0:
        return None
    return weekly_load(days, today) / usual


def longest_session_min(days: list[DayRecord], today: dt.date, lookback: int = 30) -> int | None:
    """Longest single session (minutes) in the `lookback` days before today."""
    previous = last_days(days, lookback, today - dt.timedelta(days=1))
    durations = [session.duration_min for day in previous for session in day.sessions]
    return max(durations) if durations else None


def injury_warning(planned: PlannedSession, days: list[DayRecord], today: dt.date) -> str | None:
    """Warn when a planned session is more than 10% longer than the longest one in 30 days.

    Garmin-RUNSAFE cohort (Frandsen et al., BJSM 2025): runs more than 10% longer than the
    longest run of the previous 30 days were linked to a higher injury risk. The study
    measured running distance; we apply the same rule to duration so it works for every
    sport (docs/DECISIONS.md, D8).
    """
    longest = longest_session_min(days, today)
    if longest is None or planned.duration_min <= longest * INJURY_SPIKE:
        return None
    limit = int(longest * INJURY_SPIKE)
    return (
        f"Your planned {planned.duration_min} min is more than 10% longer than your longest "
        f"session in the last 30 days ({longest} min). Sudden jumps like this raise injury "
        f"risk, so keep it to about {limit} min today."
    )
