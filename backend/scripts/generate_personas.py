"""Synthetic persona generator for the WhyTired demo (stdlib only, deterministic).

Writes backend/data/kasia.json and backend/data/tomek.json, validated against PersonaFile
(app/models.py). The day-by-day story follows the persona spec in docs/PLAN.md. The story
beats (holiday week, artifact night, training ramp) come from Berken's first dataset.

Run from backend/:  uv run python -m scripts.generate_personas
"""

from __future__ import annotations

import datetime as dt
import random
from pathlib import Path

from app.models import CheckIn, DayRecord, PersonaFile, Profile, Session, WatchDay

DEMO_DAY = dt.date(2026, 10, 4)  # D0: "today" when the demo starts (a Sunday)
HISTORY_DAYS = 90  # D-89 .. D0
FUTURE_DAYS = 14  # D+1 .. D+14, one set per outcome branch
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Weekly training patterns: weekday (Mon=0) -> (minutes, effort 1-10)
KASIA_WEEK = {1: (45, 5), 3: (50, 6), 5: (65, 5), 6: (40, 4)}  # 4 runs, ~1000 load points
KASIA_HOLIDAY = {1: (30, 3), 5: (30, 3)}  # 2 easy runs
KASIA_SPIKE = {1: (65, 7), 2: (55, 6), 3: (70, 7), 4: (50, 6), 5: (90, 7), 6: (60, 6)}  # 6 runs, ~2500
KASIA_EXPERIMENT = {1: (40, 4), 3: (35, 4), 5: (45, 5), 6: (30, 4)}  # load cut by more than 40%
KASIA_LOW_ENERGY = {-4: 2, -3: 2, -2: 1, -1: 2, 0: 2}  # the 5 low days that start detective mode

TOMEK_WEEK = {0: (70, 7), 2: (65, 6), 4: (75, 7), 5: (60, 6)}  # 4 gym sessions, ~1750
TOMEK_EXAMS = {0: (55, 6), 2: (50, 6), 5: (55, 6)}  # 3 shorter sessions: no load spike
TOMEK_LOW_ENERGY = {-3: 2, -2: 2, -1: 1, 0: 2}

MISSED_CHECKINS = {"kasia": {-80, -47, -33}, "tomek": {-75, -58, -30}}  # a few forgotten mornings


def date_of(offset: int) -> dt.date:
    return DEMO_DAY + dt.timedelta(days=offset)


def pick(rng: random.Random, weights: dict[int, float]) -> int:
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def half_hours(hours: float) -> float:
    """People report sleep in half hours."""
    return round(hours * 2) / 2


def sessions_for(pattern: dict, weekday: int, sport: str, rng: random.Random | None = None) -> list[Session]:
    if weekday not in pattern:
        return []
    minutes, rpe = pattern[weekday]
    if rng:  # small day-to-day variation in history; none in the future branches
        minutes += rng.choice((-5, 0, 0, 5))
    return [Session(sport=sport, duration_min=minutes, rpe=rpe)]


def checkin(energy: int, sleep_hours: float, sleep_quality: int, stress: int, soreness: int) -> CheckIn:
    return CheckIn(
        energy=energy,
        sleep_hours=sleep_hours,
        sleep_quality=sleep_quality,
        stress=stress,
        soreness=soreness,
    )


# ---------------------------------------------------------------- Kasia


def kasia_watch(rng: random.Random, rhr: float, hrv: float, sleep_min: float) -> WatchDay:
    return WatchDay(
        resting_hr=round(rhr, 1),
        hrv_ms=round(hrv, 1),
        sleep_min=round(sleep_min),
        sleep_coverage=round(rng.uniform(0.95, 1.0), 2),
        sleep_hr_avg=round(rhr - 3 + rng.gauss(0, 1), 1),
        day_hr_avg=round(rng.gauss(76, 3), 1),
    )


def kasia_day(rng: random.Random, offset: int, branch: str | None = None) -> DayRecord:
    """One day of Kasia (23, runner, smartwatch). `branch` is set for future days."""
    weekday = date_of(offset).weekday()
    tags: list[str] = []

    if branch is not None:  # 7-day experiment: training cut by more than 40%
        sessions = sessions_for(KASIA_EXPERIMENT, weekday, "running")
        sleep_min = rng.gauss(450, 20)
        if branch == "improved":
            rhr = max(55.0, 59.5 - 1.5 * (offset - 1)) + rng.gauss(0, 0.5)
            hrv = min(60.0, 50 + 3 * offset) + rng.gauss(0, 2)
            energy = {1: 2, 2: 3, 3: 3}.get(offset) or pick(rng, {4: 0.7, 5: 0.3})
            stress, soreness = pick(rng, {2: 0.6, 3: 0.4}), 2
        else:
            rhr, hrv = rng.gauss(60.5, 0.6), rng.gauss(50, 2.5)
            energy = pick(rng, {2: 0.8, 3: 0.2})
            stress, soreness = pick(rng, {2: 0.5, 3: 0.5}), pick(rng, {2: 0.5, 3: 0.5})
        quality = pick(rng, {3: 0.5, 4: 0.5})
    elif -60 <= offset <= -54:  # holiday: little training, the body recovers
        tags = ["holiday"]
        sessions = sessions_for(KASIA_HOLIDAY, weekday, "running", rng)
        rhr, hrv, sleep_min = rng.gauss(48, 0.8), rng.gauss(72, 4), rng.gauss(480, 20)
        energy, stress, soreness = pick(rng, {4: 0.4, 5: 0.6}), pick(rng, {1: 0.6, 2: 0.4}), 1
        quality = pick(rng, {4: 0.5, 5: 0.5})
    elif offset >= -13:  # load spike: 6 runs a week, resting HR creeps up, HRV drops
        sessions = sessions_for(KASIA_SPIKE, weekday, "running", rng)
        if offset == -1:
            sessions = [Session(sport="running", duration_min=110, rpe=7)]  # the one very long run
        k = offset + 13  # 0..13
        rhr = (55 + 0.5 * k if k <= 6 else 60 + 0.4 * (k - 7)) + rng.gauss(0, 0.6)
        hrv = (58 - 0.6 * k if k <= 6 else 48) + rng.gauss(0, 2.5)
        sleep_min = rng.gauss(425, 15)
        energy = KASIA_LOW_ENERGY.get(offset, 3)
        stress, soreness = pick(rng, {2: 0.6, 3: 0.4}), pick(rng, {3: 0.5, 4: 0.5})
        quality = 3
    else:  # normal training
        sessions = sessions_for(KASIA_WEEK, weekday, "running", rng)
        rhr, hrv, sleep_min = rng.gauss(54, 1.2), rng.gauss(62, 4), rng.gauss(450, 22)
        energy, stress = pick(rng, {3: 0.3, 4: 0.6, 5: 0.1}), pick(rng, {2: 0.6, 3: 0.4})
        long_run = bool(sessions) and sessions[0].duration_min >= 60
        soreness = 3 if long_run else pick(rng, {1: 0.3, 2: 0.7})
        quality = pick(rng, {3: 0.4, 4: 0.6})

    run_minutes = sum(session.duration_min for session in sessions)
    return DayRecord(
        date=date_of(offset),
        checkin=checkin(energy, half_hours(sleep_min / 60 + rng.gauss(0, 0.2)), quality, stress, soreness),
        sessions=sessions,
        steps=int(rng.gauss(8000, 1200) + 150 * run_minutes),
        watch=kasia_watch(rng, rhr, hrv, sleep_min),
        tags=tags,
    )


def add_artifact_night(days: list[DayRecord]) -> None:
    """D-20: the strap came loose. Resting HR 92, only 35% of the night recorded and sleep HR
    above the daytime average, while Kasia felt and trained exactly as the day before."""
    i = next(i for i, day in enumerate(days) if day.date == date_of(-20))
    day, previous = days[i], days[i - 1]
    days[i] = day.model_copy(
        update={
            "checkin": day.checkin.model_copy(
                update={"energy": previous.checkin.energy, "stress": previous.checkin.stress}
            ),
            "watch": day.watch.model_copy(
                update={"resting_hr": 92.0, "sleep_coverage": 0.35, "sleep_min": 158, "sleep_hr_avg": 96.0, "day_hr_avg": 77.0}
            ),
        }
    )


def build_kasia(seed: int = 42) -> PersonaFile:
    rng = random.Random(seed)
    history = [kasia_day(rng, offset) for offset in range(-(HISTORY_DAYS - 1), 1)]
    add_artifact_night(history)
    future = {
        branch: [kasia_day(random.Random(seed + n), offset, branch) for offset in range(1, FUTURE_DAYS + 1)]
        for n, branch in ((1000, "not_improved"), (2000, "improved"))
    }
    return PersonaFile(
        profile=Profile(
            id="kasia",
            name="Kasia",
            age=23,
            goal="Run my first half marathon in spring",
            sports=["running"],
            has_watch=True,
        ),
        history=drop_checkins(history, MISSED_CHECKINS["kasia"]),
        future=future,
    )


# ---------------------------------------------------------------- Tomek


def tomek_day(rng: random.Random, offset: int, branch: str | None = None) -> DayRecord:
    """One day of Tomek (21, gym, no smartwatch): check-ins and logged sessions only."""
    weekday = date_of(offset).weekday()
    tags: list[str] = []

    if branch is not None:  # 7-day experiment: fixed sleep window
        sessions = sessions_for(TOMEK_EXAMS, weekday, "gym")
        if branch == "improved":
            sleep = half_hours(rng.gauss(7.75, 0.25))
            energy = {1: 2, 2: 2, 3: 3, 4: 3}.get(offset) or pick(rng, {4: 0.7, 5: 0.3})
            stress = pick(rng, {2: 0.4, 3: 0.6})
        else:
            sleep = rng.choice((6.5, 7.0, 7.0, 7.5))
            energy = pick(rng, {2: 0.8, 3: 0.2})
            stress = pick(rng, {3: 0.3, 4: 0.7})
        quality, soreness = pick(rng, {3: 0.5, 4: 0.5}), 2
    elif -50 <= offset <= -44:  # summer break: lots of sleep, little stress
        tags = ["holiday"]
        sessions = sessions_for(TOMEK_WEEK, weekday, "gym", rng)
        sleep = half_hours(rng.gauss(8.5, 0.25))
        energy, stress = pick(rng, {4: 0.4, 5: 0.6}), pick(rng, {1: 0.6, 2: 0.4})
        quality, soreness = pick(rng, {4: 0.5, 5: 0.5}), pick(rng, {2: 0.6, 3: 0.4})
    elif offset >= -11:  # exam period: short nights, high stress, fewer sessions
        tags = ["exams"]
        sessions = sessions_for(TOMEK_EXAMS, weekday, "gym", rng)
        sleep = rng.choice((5.0, 5.5, 5.5, 6.0))
        energy = TOMEK_LOW_ENERGY.get(offset, 3)
        stress = pick(rng, {3: 0.1, 4: 0.7, 5: 0.2})
        quality, soreness = pick(rng, {2: 0.5, 3: 0.5}), 2
    else:  # normal term time
        sessions = sessions_for(TOMEK_WEEK, weekday, "gym", rng)
        sleep = half_hours(rng.gauss(7.5, 0.4))
        energy, stress = pick(rng, {3: 0.35, 4: 0.55, 5: 0.1}), pick(rng, {2: 0.6, 3: 0.4})
        quality, soreness = pick(rng, {3: 0.4, 4: 0.6}), pick(rng, {2: 0.6, 3: 0.4})

    return DayRecord(
        date=date_of(offset),
        checkin=checkin(energy, sleep, quality, stress, soreness),
        sessions=sessions,
        tags=tags,
    )


def build_tomek(seed: int = 43) -> PersonaFile:
    rng = random.Random(seed)
    history = [tomek_day(rng, offset) for offset in range(-(HISTORY_DAYS - 1), 1)]
    future = {
        branch: [tomek_day(random.Random(seed + n), offset, branch) for offset in range(1, FUTURE_DAYS + 1)]
        for n, branch in ((1000, "not_improved"), (2000, "improved"))
    }
    return PersonaFile(
        profile=Profile(
            id="tomek",
            name="Tomek",
            age=21,
            goal="Get stronger and train consistently",
            sports=["gym"],
            has_watch=False,
        ),
        history=drop_checkins(history, MISSED_CHECKINS["tomek"]),
        future=future,
    )


# ---------------------------------------------------------------- output


def drop_checkins(days: list[DayRecord], offsets: set[int]) -> list[DayRecord]:
    missed = {date_of(offset) for offset in offsets}
    return [day.model_copy(update={"checkin": None}) if day.date in missed else day for day in days]


def build_all() -> list[PersonaFile]:
    return [build_kasia(), build_tomek()]


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    for persona in build_all():
        path = DATA_DIR / f"{persona.profile.id}.json"
        path.write_text(persona.model_dump_json(indent=1) + "\n", encoding="utf-8")
        print(f"Wrote {path.relative_to(DATA_DIR.parent)} ({len(persona.history)} days + 2×{FUTURE_DAYS} future)")


if __name__ == "__main__":
    main()
