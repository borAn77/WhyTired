"""Small builders for hand-made test data, independent of the generated persona files."""

from __future__ import annotations

import datetime as dt
from collections.abc import Callable

from app.models import CheckIn, DayRecord, Session, WatchDay

TODAY = dt.date(2026, 10, 4)


def make_day(
    date: dt.date,
    *,
    energy: int = 4,
    stress: int = 2,
    soreness: int = 2,
    sleep_hours: float = 7.5,
    sleep_quality: int = 4,
    checkin: bool = True,
    sessions: tuple[tuple[int, int], ...] = ((50, 5),),  # (minutes, rpe)
    watch: bool = True,
    rhr: float | None = 54.0,
    hrv: float | None = 62.0,
    sleep_min: float | None = 450.0,
    coverage: float | None = 1.0,
    sleep_hr: float | None = 50.0,
    day_hr: float | None = 76.0,
    manual_pulse: int | None = None,
    tags: tuple[str, ...] = (),
) -> DayRecord:
    return DayRecord(
        date=date,
        checkin=CheckIn(
            energy=energy,
            sleep_hours=sleep_hours,
            sleep_quality=sleep_quality,
            stress=stress,
            soreness=soreness,
        )
        if checkin
        else None,
        sessions=[Session(sport="running", duration_min=m, rpe=r) for m, r in sessions],
        manual_pulse=manual_pulse,
        watch=WatchDay(
            resting_hr=rhr,
            hrv_ms=hrv,
            sleep_min=sleep_min,
            sleep_coverage=coverage,
            sleep_hr_avg=sleep_hr,
            day_hr_avg=day_hr,
        )
        if watch
        else None,
        tags=list(tags),
    )


def make_days(n: int = 90, today: dt.date = TODAY, change: Callable[[int], dict] | None = None) -> list[DayRecord]:
    """`n` days ending at `today`. `change(offset)` returns overrides for one day,
    where offset 0 is today and -1 is yesterday."""
    days = []
    for i in range(n):
        offset = i - (n - 1)
        overrides = change(offset) if change else {}
        days.append(make_day(today + dt.timedelta(days=offset), **overrides))
    return days


def kasia_like(offset: int) -> dict:
    """Load spike in the last 2 weeks, 5 low-energy days, a holiday week, one artifact night."""
    if -60 <= offset <= -54:  # holiday: little training, lower resting HR, more energy
        return {"sessions": ((30, 3),), "rhr": 48.0, "hrv": 72.0, "energy": 5, "stress": 1, "tags": ("holiday",)}
    if offset == -20:  # artifact night: loose strap
        return {"rhr": 92.0, "coverage": 0.35, "sleep_hr": 96.0, "day_hr": 77.0}
    if -13 <= offset <= 0:  # load spike
        overrides = {"sessions": ((90, 7),), "rhr": 57.0 if offset < -6 else 61.5, "hrv": 50.0, "soreness": 4}
        if offset >= -4:
            overrides["energy"] = 2
        return overrides
    return {}


def tomek_like(offset: int) -> dict:
    """No watch; exam period with short sleep and high stress; a holiday week with good sleep."""
    base = {"watch": False, "sessions": ((70, 6),)}
    if -50 <= offset <= -44:
        return base | {"sleep_hours": 8.5, "energy": 5, "stress": 1, "tags": ("holiday",)}
    if -11 <= offset <= 0:
        return base | {
            "sleep_hours": 5.5,
            "stress": 4,
            "energy": 2 if offset >= -3 else 3,
            "sessions": ((55, 6),) if offset % 2 else (),
            "tags": ("exams",),
        }
    return base
