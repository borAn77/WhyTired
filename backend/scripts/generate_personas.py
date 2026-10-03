"""Synthetic persona generator for the WhyTired demo (stdlib only, deterministic).

Writes backend/data/kasia.json and backend/data/tomek.json, validated against PersonaFile
(app/models.py). The story beats (holiday week, artifact night, training ramp) come from
Berken's first dataset; docs/PERSONAS_BRIEF.md describes the scenario.

How the data is made, in four parts:
1. CONFIG (below): every scenario number in one place: dates, training weeks, normal values,
   the story periods (holiday, load spike, exams), the artifact night and both experiment branches.
2. Noise: Python's random.Random with a fixed seed per persona and per branch, so values vary
   from day to day like a real person's, but are identical on every run.
3. Story periods: every day falls into one period (normal, holiday, load spike / exams, or an
   experiment branch), and that period sets the training, the body values and the check-in.
4. Checks: tests/test_personas.py runs the real engine on these files and asserts the story.

Run from backend/:  uv run python -m scripts.generate_personas
"""

from __future__ import annotations

import datetime as dt
import random
from pathlib import Path

from app.models import CheckIn, DayRecord, PersonaFile, Profile, Session, WatchDay

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# ------------------------------------------------------------------------- scenario config
# How to read it:
# - Days are offsets from the demo day D0: -13 means D-13, 1 means D+1.
# - A training week maps weekday (Mon=0) -> (minutes, effort 1-10), or (minutes, effort, sport)
#   when it is not the persona's main sport. Load = minutes × effort.
# - (mean, sd) pairs are normal-distributed noise: rng.gauss(mean, sd).
# - {answer: probability} dicts are check-in answers drawn with those weights.
CONFIG = {
    "demo_day": dt.date(2026, 10, 4),  # D0: "today" when the demo starts (a Sunday)
    "history_days": 90,  # D-89 .. D0
    "future_days": 14,  # D+1 .. D+14, one set per experiment branch
    "branch_seed_offsets": {"not_improved": 1000, "improved": 2000},  # branch seed = persona seed + this
    "session_jitter_min": (-5, 0, 0, 5),  # history sessions vary a little in length
    "kasia": {
        "seed": 42,
        "profile": {
            "id": "kasia",
            "name": "Kasia",
            "age": 23,
            "goal": "Run my first half marathon in spring",
            "sports": ["running"],
            "has_watch": True,
        },
        "sport": "running",
        "missed_checkins": [dt.date(2026, 7, 18), dt.date(2026, 8, 29)],  # forgotten mornings (brief)
        "reported_sleep_noise_h": 0.2,  # check-in hours = watch sleep ± a little, in half hours
        "steps": (8000, 1200),
        "steps_per_run_min": 150,
        "watch": {
            "coverage": (0.95, 1.0),  # share of the night recorded, uniform
            "sleep_hr_below_rhr": 3,  # sleep HR sits ~3 bpm under resting HR
            "sleep_hr_noise": 1,
            "day_hr": (76, 3),
        },
        "normal": {  # every day not in a period below
            "week": {1: (45, 5), 3: (50, 6), 5: (65, 5), 6: (40, 4)},  # 4 runs, ~1000 load points
            "rhr": (54, 1.2),
            "hrv": (62, 4),
            "sleep_min": (450, 22),
            "energy": {3: 0.3, 4: 0.6, 5: 0.1},
            "stress": {2: 0.6, 3: 0.4},
            "sleep_quality": {3: 0.4, 4: 0.6},
            "long_run_min": 60,  # a run this long leaves her sore the same day
            "soreness_after_long_run": 3,
            "soreness": {1: 0.3, 2: 0.7},
        },
        "holiday": {  # little training, the body recovers: resting HR ~6 bpm lower
            "days": (-60, -54),
            "week": {1: (30, 3), 5: (30, 3)},  # 2 easy runs
            "rhr": (48, 0.8),
            "hrv": (72, 4),
            "sleep_min": (480, 20),
            "energy": {4: 0.4, 5: 0.6},
            "stress": {1: 0.6, 2: 0.4},
            "soreness": 1,
            "sleep_quality": {4: 0.5, 5: 0.5},
        },
        "spike": {  # last 2 weeks: 6 runs a week, resting HR creeps up, HRV drops
            "from": -13,  # D-13 .. D0
            "week": {1: (65, 7), 2: (55, 6), 3: (70, 7), 4: (50, 6), 5: (90, 7), 6: (60, 6)},  # ~2500
            "long_run_day": -1,  # the one very long run
            "long_run_min": 110,
            "long_run_rpe": 7,
            "week2_from": 7,  # spike day where the second week starts
            "rhr_start": 55,  # week 1: +0.5 bpm a day from 55
            "rhr_per_day": 0.5,
            "rhr_week2_start": 60,  # week 2: +0.4 bpm a day from 60
            "rhr_week2_per_day": 0.4,
            "rhr_noise": 0.6,
            "hrv_start": 58,  # week 1: -0.6 ms a day from 58, then flat at 48
            "hrv_drop_per_day": 0.6,
            "hrv_week2": 48,
            "hrv_noise": 2.5,
            "sleep_min": (425, 15),
            "energy": 3,
            "low_energy": {-4: 2, -3: 2, -2: 1, -1: 2, 0: 2},  # the 5 low days that start detective mode
            "late_caffeine_days": [-4, -3, -2, -1, 0],  # mornings after a late coffee: all 5 tired days
            "late_caffeine_sleep_min": 40,  # ...cost 40 min of sleep (brief: 20-40 min)
            "stress": {2: 0.6, 3: 0.4},
            "soreness": {3: 0.5, 4: 0.5},
            "sleep_quality": 3,
        },
        "artifact_night": {  # the strap came loose; her check-in that morning is normal
            "day": -10,  # 2026-09-24, inside the load spike
            "watch": {
                "resting_hr": 88.0,  # ~31 bpm above the night before: over the 25 bpm jump rule
                "hrv_ms": 18.0,
                "sleep_coverage": 0.35,
                "sleep_min": 158,
                "sleep_hr_avg": 96.0,
                "day_hr_avg": 77.0,
            },
            "energy": 4,  # her check-in that morning is normal
        },
        "branches": {  # both branches follow the experiment: training load cut by more than 40%
            "week": {1: (40, 4), 3: (35, 4), 5: (45, 5), 6: (30, 4)},
            "sleep_min": (450, 20),
            "sleep_quality": {3: 0.5, 4: 0.5},
            "improved": {
                "rhr_start": 59.5,  # -1.5 bpm a day from 59.5, down to 55
                "rhr_drop_per_day": 1.5,
                "rhr_floor": 55.0,
                "rhr_noise": 0.5,
                "hrv_start": 50,  # +3 ms a day from 50, up to 60
                "hrv_gain_per_day": 3,
                "hrv_cap": 60.0,
                "hrv_noise": 2,
                "energy_first_days": {1: 2, 2: 3, 3: 3},
                "energy": {4: 0.7, 5: 0.3},
                "stress": {2: 0.6, 3: 0.4},
                "soreness": 2,
            },
            "not_improved": {
                "rhr": (60.5, 0.6),
                "hrv": (50, 2.5),
                "energy": {2: 0.8, 3: 0.2},
                "stress": {2: 0.5, 3: 0.5},
                "soreness": {2: 0.5, 3: 0.5},
            },
        },
    },
    "tomek": {
        "seed": 43,
        "profile": {
            "id": "tomek",
            "name": "Tomek",
            "age": 21,
            "goal": "Get stronger and train consistently",
            "sports": ["gym", "football"],
            "has_watch": False,
        },
        "sport": "gym",
        "missed_checkins": [dt.date(2026, 7, 12), dt.date(2026, 7, 26), dt.date(2026, 8, 15)],  # brief
        "normal": {
            "week": {0: (70, 7), 2: (65, 6), 4: (75, 7), 6: (90, 7, "football")},  # gym Mon/Wed/Fri + football Sun, ~2035
            "sleep_h": (7.5, 0.4),
            "energy": {3: 0.35, 4: 0.55, 5: 0.1},
            "stress": {2: 0.6, 3: 0.4},
            "sleep_quality": {3: 0.4, 4: 0.6},
            "soreness": {2: 0.6, 3: 0.4},
        },
        "holiday": {  # summer break: trains as usual, lots of sleep, little stress
            "days": (-50, -44),
            "sleep_h": (8.5, 0.25),
            "energy": {4: 0.4, 5: 0.6},
            "stress": {1: 0.6, 2: 0.4},
            "sleep_quality": {4: 0.5, 5: 0.5},
            "soreness": {2: 0.6, 3: 0.4},
        },
        "exams": {  # short nights, high stress, one session fewer (so no load spike)
            "from": -11,  # D-11 .. D0
            "week": {0: (70, 7), 4: (75, 7), 6: (90, 7, "football")},  # drops Wednesday's gym, ~1645
            "sleep_h_choices": (5.5, 6.0),  # exam stress alone: 5.5-6 h
            "late_screens_sleep_h": 0.5,  # phone in bed late: another 30 min less (brief: 30-60 min)
            "screen_free_weekday": 5,  # ...every night except Friday's (Saturday morning): 6 of 7
            "demo_day_sleep_h": 5.0,  # the night before D0 (brief: 5.0-5.5 h)
            "energy": 3,
            "low_energy": {-3: 2, -2: 2, -1: 1, 0: 2},
            "stress": {3: 0.1, 4: 0.7, 5: 0.2},
            "sleep_quality": {2: 0.5, 3: 0.5},
            "soreness": 2,
        },
        "branches": {  # both follow the experiment: a fixed sleep window; training as in exams
            "sleep_quality": {3: 0.5, 4: 0.5},
            "soreness": 2,
            "improved": {
                "sleep_h": (7.75, 0.25),
                "energy_first_days": {1: 2, 2: 2, 3: 3, 4: 3},
                "energy": {4: 0.7, 5: 0.3},
                "stress": {2: 0.4, 3: 0.6},
            },
            "not_improved": {
                "sleep_h_choices": (6.5, 7.0, 7.0, 7.5),  # sticks to the plan, but sleeps ~7 h
                "energy": {2: 0.7, 3: 0.3},
                "stress": {3: 0.3, 4: 0.7},
            },
        },
    },
}

DEMO_DAY = CONFIG["demo_day"]  # used by the tests


# ------------------------------------------------------------------------- helpers


def date_of(offset: int) -> dt.date:
    return DEMO_DAY + dt.timedelta(days=offset)


def pick(rng: random.Random, weights: dict[int, float]) -> int:
    """Draw one check-in answer with the given probabilities."""
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def half_hours(hours: float) -> float:
    """People report sleep in half hours."""
    return round(hours * 2) / 2


def sessions_for(pattern: dict, weekday: int, sport: str, rng: random.Random | None = None) -> list[Session]:
    if weekday not in pattern:
        return []
    minutes, rpe = pattern[weekday][:2]
    if len(pattern[weekday]) == 3:  # e.g. Tomek's Sunday football
        sport = pattern[weekday][2]
    if rng:  # small day-to-day variation in history; none in the future branches
        minutes += rng.choice(CONFIG["session_jitter_min"])
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
    watch = CONFIG["kasia"]["watch"]
    return WatchDay(
        resting_hr=round(rhr, 1),
        hrv_ms=round(hrv, 1),
        sleep_min=round(sleep_min),
        sleep_coverage=round(rng.uniform(*watch["coverage"]), 2),
        sleep_hr_avg=round(rhr - watch["sleep_hr_below_rhr"] + rng.gauss(0, watch["sleep_hr_noise"]), 1),
        day_hr_avg=round(rng.gauss(*watch["day_hr"]), 1),
    )


def kasia_day(rng: random.Random, offset: int, branch: str | None = None) -> DayRecord:
    """One day of Kasia (23, runner, smartwatch). `branch` is set for future days."""
    cfg = CONFIG["kasia"]
    sport, weekday = cfg["sport"], date_of(offset).weekday()
    holiday, spike, normal = cfg["holiday"], cfg["spike"], cfg["normal"]
    tags: list[str] = []

    if branch is not None:  # 7-day experiment: training cut by more than 40%
        branches = cfg["branches"]
        sessions = sessions_for(branches["week"], weekday, sport)
        sleep_min = rng.gauss(*branches["sleep_min"])
        if branch == "improved":
            p = branches["improved"]
            rhr = max(p["rhr_floor"], p["rhr_start"] - p["rhr_drop_per_day"] * (offset - 1)) + rng.gauss(0, p["rhr_noise"])
            hrv = min(p["hrv_cap"], p["hrv_start"] + p["hrv_gain_per_day"] * offset) + rng.gauss(0, p["hrv_noise"])
            energy = p["energy_first_days"].get(offset) or pick(rng, p["energy"])
            stress, soreness = pick(rng, p["stress"]), p["soreness"]
        else:
            p = branches["not_improved"]
            rhr, hrv = rng.gauss(*p["rhr"]), rng.gauss(*p["hrv"])
            energy = pick(rng, p["energy"])
            stress, soreness = pick(rng, p["stress"]), pick(rng, p["soreness"])
        quality = pick(rng, branches["sleep_quality"])
    elif holiday["days"][0] <= offset <= holiday["days"][1]:  # little training, the body recovers
        tags = ["holiday"]
        sessions = sessions_for(holiday["week"], weekday, sport, rng)
        rhr, hrv, sleep_min = rng.gauss(*holiday["rhr"]), rng.gauss(*holiday["hrv"]), rng.gauss(*holiday["sleep_min"])
        energy, stress, soreness = pick(rng, holiday["energy"]), pick(rng, holiday["stress"]), holiday["soreness"]
        quality = pick(rng, holiday["sleep_quality"])
    elif offset >= spike["from"]:  # load spike: resting HR creeps up, HRV drops
        sessions = sessions_for(spike["week"], weekday, sport, rng)
        if offset == spike["long_run_day"]:
            sessions = [Session(sport=sport, duration_min=spike["long_run_min"], rpe=spike["long_run_rpe"])]
        k, week2 = offset - spike["from"], spike["week2_from"]  # k = day of the spike, 0..13
        rhr = (
            spike["rhr_start"] + spike["rhr_per_day"] * k
            if k < week2
            else spike["rhr_week2_start"] + spike["rhr_week2_per_day"] * (k - week2)
        ) + rng.gauss(0, spike["rhr_noise"])
        hrv = (spike["hrv_start"] - spike["hrv_drop_per_day"] * k if k < week2 else spike["hrv_week2"]) + rng.gauss(
            0, spike["hrv_noise"]
        )
        sleep_min = rng.gauss(*spike["sleep_min"])
        if offset in spike["late_caffeine_days"]:  # coffee late the evening before: shorter night
            sleep_min -= spike["late_caffeine_sleep_min"]
        energy = spike["low_energy"].get(offset, spike["energy"])
        stress, soreness = pick(rng, spike["stress"]), pick(rng, spike["soreness"])
        quality = spike["sleep_quality"]
    else:  # normal training
        sessions = sessions_for(normal["week"], weekday, sport, rng)
        rhr, hrv, sleep_min = rng.gauss(*normal["rhr"]), rng.gauss(*normal["hrv"]), rng.gauss(*normal["sleep_min"])
        energy, stress = pick(rng, normal["energy"]), pick(rng, normal["stress"])
        long_run = bool(sessions) and sessions[0].duration_min >= normal["long_run_min"]
        soreness = normal["soreness_after_long_run"] if long_run else pick(rng, normal["soreness"])
        quality = pick(rng, normal["sleep_quality"])

    run_minutes = sum(session.duration_min for session in sessions)
    reported_sleep = half_hours(sleep_min / 60 + rng.gauss(0, cfg["reported_sleep_noise_h"]))
    return DayRecord(
        date=date_of(offset),
        checkin=checkin(energy, reported_sleep, quality, stress, soreness),
        sessions=sessions,
        steps=int(rng.gauss(*cfg["steps"]) + cfg["steps_per_run_min"] * run_minutes),
        watch=kasia_watch(rng, rhr, hrv, sleep_min),
        tags=tags,
    )


def add_artifact_night(days: list[DayRecord]) -> None:
    """The strap came loose for one night: implausible resting HR, most of the night missing and
    sleep HR above the daytime average, while Kasia's check-in that morning was normal."""
    night = CONFIG["kasia"]["artifact_night"]
    i = next(i for i, day in enumerate(days) if day.date == date_of(night["day"]))
    day, previous = days[i], days[i - 1]
    days[i] = day.model_copy(
        update={
            "checkin": day.checkin.model_copy(
                update={"energy": night["energy"], "stress": previous.checkin.stress}
            ),
            "watch": day.watch.model_copy(update=night["watch"]),
        }
    )


def build_kasia() -> PersonaFile:
    cfg = CONFIG["kasia"]
    rng = random.Random(cfg["seed"])
    history = [kasia_day(rng, offset) for offset in range(-(CONFIG["history_days"] - 1), 1)]
    add_artifact_night(history)
    future = {
        branch: branch_days(kasia_day, random.Random(cfg["seed"] + seed_offset), branch)
        for branch, seed_offset in CONFIG["branch_seed_offsets"].items()
    }
    return PersonaFile(
        profile=Profile(**cfg["profile"]),
        history=drop_checkins(history, cfg["missed_checkins"]),
        future=future,
    )


# ---------------------------------------------------------------- Tomek


def tomek_day(rng: random.Random, offset: int, branch: str | None = None) -> DayRecord:
    """One day of Tomek (21, gym, no smartwatch): check-ins and logged sessions only."""
    cfg = CONFIG["tomek"]
    sport, weekday = cfg["sport"], date_of(offset).weekday()
    holiday, exams, normal = cfg["holiday"], cfg["exams"], cfg["normal"]
    tags: list[str] = []

    if branch is not None:  # 7-day experiment: fixed sleep window, training as in the exams
        branches = cfg["branches"]
        sessions = sessions_for(exams["week"], weekday, sport)
        if branch == "improved":
            p = branches["improved"]
            sleep = half_hours(rng.gauss(*p["sleep_h"]))
            energy = p["energy_first_days"].get(offset) or pick(rng, p["energy"])
            stress = pick(rng, p["stress"])
        else:
            p = branches["not_improved"]
            sleep = rng.choice(p["sleep_h_choices"])
            energy = pick(rng, p["energy"])
            stress = pick(rng, p["stress"])
        quality, soreness = pick(rng, branches["sleep_quality"]), branches["soreness"]
    elif holiday["days"][0] <= offset <= holiday["days"][1]:  # summer break: lots of sleep, little stress
        tags = ["holiday"]
        sessions = sessions_for(normal["week"], weekday, sport, rng)
        sleep = half_hours(rng.gauss(*holiday["sleep_h"]))
        energy, stress = pick(rng, holiday["energy"]), pick(rng, holiday["stress"])
        quality, soreness = pick(rng, holiday["sleep_quality"]), pick(rng, holiday["soreness"])
    elif offset >= exams["from"]:  # exam period: short nights, high stress, fewer sessions
        tags = ["exams"]
        sessions = sessions_for(exams["week"], weekday, sport, rng)
        sleep = rng.choice(exams["sleep_h_choices"])
        if weekday != exams["screen_free_weekday"]:  # on the phone late the evening before
            sleep -= exams["late_screens_sleep_h"]
        if offset == 0:
            sleep = exams["demo_day_sleep_h"]
        energy = exams["low_energy"].get(offset, exams["energy"])
        stress = pick(rng, exams["stress"])
        quality, soreness = pick(rng, exams["sleep_quality"]), exams["soreness"]
    else:  # normal term time
        sessions = sessions_for(normal["week"], weekday, sport, rng)
        sleep = half_hours(rng.gauss(*normal["sleep_h"]))
        energy, stress = pick(rng, normal["energy"]), pick(rng, normal["stress"])
        quality, soreness = pick(rng, normal["sleep_quality"]), pick(rng, normal["soreness"])

    return DayRecord(
        date=date_of(offset),
        checkin=checkin(energy, sleep, quality, stress, soreness),
        sessions=sessions,
        tags=tags,
    )


def build_tomek() -> PersonaFile:
    cfg = CONFIG["tomek"]
    rng = random.Random(cfg["seed"])
    history = [tomek_day(rng, offset) for offset in range(-(CONFIG["history_days"] - 1), 1)]
    future = {
        branch: branch_days(tomek_day, random.Random(cfg["seed"] + seed_offset), branch)
        for branch, seed_offset in CONFIG["branch_seed_offsets"].items()
    }
    return PersonaFile(
        profile=Profile(**cfg["profile"]),
        history=drop_checkins(history, cfg["missed_checkins"]),
        future=future,
    )


# ---------------------------------------------------------------- output


def drop_checkins(days: list[DayRecord], missed: list[dt.date]) -> list[DayRecord]:
    return [day.model_copy(update={"checkin": None}) if day.date in missed else day for day in days]


def branch_days(make_day, rng: random.Random, branch: str) -> list[DayRecord]:
    """D+1 .. D+14 of one experiment branch. One random generator for the whole branch, so
    each day gets fresh noise; the history keeps its own generator, so it is unaffected."""
    return [make_day(rng, offset, branch) for offset in range(1, CONFIG["future_days"] + 1)]


def build_all() -> list[PersonaFile]:
    return [build_kasia(), build_tomek()]


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    for persona in build_all():
        path = DATA_DIR / f"{persona.profile.id}.json"
        path.write_text(persona.model_dump_json(indent=1) + "\n", encoding="utf-8")
        print(f"Wrote {path.relative_to(DATA_DIR.parent)} ({len(persona.history)} days + 2×{CONFIG['future_days']} future)")


if __name__ == "__main__":
    main()
