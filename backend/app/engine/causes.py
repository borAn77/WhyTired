"""Detective mode rules: candidate causes, the personal history check and confidence.

Every candidate rule compares "this week" (last 7 days) with "your usual" (the 28 days
before it), so findings are always relative to the user's own normal, never to a
population norm. Thresholds are starting values, tuned on the synthetic personas.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from statistics import mean

from ..models import (
    CauseId,
    Chart,
    ChartPoint,
    Confidence,
    ConfidenceCheck,
    DataLevel,
    DayRecord,
    Evidence,
    HistoryCheck,
)
from .baselines import (
    avg,
    coverage,
    energy,
    hrv,
    last_days,
    resting_hr,
    sleep_hours,
    stress,
    this_week,
    usual_period,
    values,
    watch_sleep_hours,
)
from .load import load_ratio, total_load, usual_weekly_load, weekly_load

LOW_ENERGY = 2  # energy 1–2 (of 5) is a low day
LOW_ENERGY_STREAK = 3  # 3+ low days in a row start detective mode

LOAD_SPIKE, LOAD_SPIKE_STRONG = 1.3, 1.5  # × the usual weekly load
SLEEP_DEBT_H, SLEEP_DEBT_STRONG_H = 4.0, 7.0  # hours short over 7 days
STRESS_RISE, STRESS_RISE_STRONG = 1.0, 1.5  # points on the 1–5 scale
RHR_RISE, RHR_RISE_STRONG = 5.0, 8.0  # bpm above usual

CORROBORATING_RHR_RISE = 3.0  # bpm: resting HR up this much backs up a strain cause
CORROBORATING_HRV_RATIO = 0.9  # HRV at or below 90% of usual backs up a strain cause
MIN_COVERAGE = 0.7  # at least 70% of this week's days need the data
HISTORY_ENERGY_GAIN = 0.5  # energy points higher in the comparison week
HISTORY_RHR_DROP = -3.0  # bpm lower in the comparison week
EPISODE_DAYS = 14  # the history check leaves out the current episode

TITLES: dict[CauseId, str] = {
    "load_spike": "Your training load jumped",
    "sleep_debt": "You've been sleeping less than usual",
    "stress_spike": "Your stress has been higher than usual",
    "rhr_elevated": "Your resting heart rate is up",
}


@dataclass
class Signal:
    """The outcome of one candidate rule, before confidence is scored."""

    cause_id: CauseId
    fires: bool
    strong: bool
    strength: float  # effect size relative to the "strong" threshold (1.0 = exactly strong)
    coverage: float
    evidence: list[Evidence]
    chart: Chart | None = None


def _no_signal(cause_id: CauseId) -> Signal:
    return Signal(cause_id, fires=False, strong=False, strength=0.0, coverage=0.0, evidence=[])


def _daily_chart(
    days: list[DayRecord], today: dt.date, metric: Callable, name: str, unit: str, baseline: float
) -> Chart:
    points = [
        ChartPoint(
            date=day.date,
            value=round(value, 1) if (value := metric(day)) is not None else None,
            baseline=round(baseline, 1),
        )
        for day in last_days(days, 28, today)
    ]
    return Chart(metric=name, unit=unit, points=points)


# ---------- trigger ----------


def low_energy_streak(days: list[DayRecord]) -> int:
    """How many check-ins in a row (newest first) had energy 1–2. Days without a check-in
    are skipped. Subjective check-ins are sensitive indicators of training strain
    (Saw et al., BJSM 2016)."""
    streak = 0
    for day in reversed(days):
        value = energy(day)
        if value is None:
            continue
        if value > LOW_ENERGY:
            break
        streak += 1
    return streak


# ---------- candidate rules ----------


def load_spike(days: list[DayRecord], today: dt.date) -> Signal:
    """Training load spike: this week's load is at least 1.3× your usual week (strong: 1.5×).
    Load = minutes × effort, i.e. session RPE (Foster et al., 2001)."""
    ratio = load_ratio(days, today)
    if ratio is None:
        return _no_signal("load_spike")
    week, usual = weekly_load(days, today), usual_weekly_load(days, today)
    training_days = sum(1 for day in this_week(days, today) if day.sessions)
    usual_training_days = sum(1 for day in usual_period(days, today) if day.sessions) / 4
    evidence = [
        Evidence(
            metric="weekly_load",
            text=f"Last 7 days: {round(week)} load points, against your usual {round(usual)} a week.",
            value=round(week),
            baseline=round(usual),
            unit="load points",
        )
    ]
    if training_days > round(usual_training_days):  # only worth saying when it changed
        evidence.append(
            Evidence(
                metric="training_days",
                text=f"You trained on {training_days} of the last 7 days (usually {round(usual_training_days)}).",
                value=training_days,
                baseline=round(usual_training_days),
                unit="days",
            )
        )
    weeks = [today - dt.timedelta(days=7 * k) for k in range(5, -1, -1)]
    chart = Chart(
        metric="weekly_load",
        unit="load points",
        points=[
            ChartPoint(date=end, value=round(total_load(last_days(days, 7, end))), baseline=round(usual))
            for end in weeks
        ],
    )
    return Signal(
        "load_spike",
        fires=ratio >= LOAD_SPIKE,
        strong=ratio >= LOAD_SPIKE_STRONG,
        strength=ratio / LOAD_SPIKE_STRONG,
        coverage=coverage(this_week(days, today), energy),  # are you logging regularly?
        evidence=evidence,
        chart=chart,
    )


def sleep_debt(days: list[DayRecord], today: dt.date) -> Signal:
    """Accumulated sleep debt: over the last 7 days you slept at least 4 h less in total than
    your own usual average (strong: 7 h). Uses watch sleep when available, otherwise the
    hours from the check-in."""
    usual = avg(usual_period(days, today), sleep_hours)
    week = this_week(days, today)
    slept = values(week, sleep_hours)
    if usual is None or not slept:
        return _no_signal("sleep_debt")
    debt = sum(usual - hours for hours in slept)
    week_avg = mean(slept)
    evidence = [
        Evidence(
            metric="sleep_debt",
            text=f"Over the last 7 days you are about {debt:.1f} h of sleep short of your usual.",
            value=round(debt, 1),
            unit="h",
        ),
        Evidence(
            metric="sleep_hours",
            text=f"You slept {week_avg:.1f} h a night on average, against your usual {usual:.1f} h.",
            value=round(week_avg, 1),
            baseline=round(usual, 1),
            unit="h",
        ),
    ]
    return Signal(
        "sleep_debt",
        fires=debt >= SLEEP_DEBT_H,
        strong=debt >= SLEEP_DEBT_STRONG_H,
        strength=debt / SLEEP_DEBT_STRONG_H,
        coverage=coverage(week, sleep_hours),
        evidence=evidence,
        chart=_daily_chart(days, today, sleep_hours, "sleep_hours", "h", usual),
    )


def stress_spike(days: list[DayRecord], today: dt.date) -> Signal:
    """Stress spike: this week's average stress (1–5) is at least 1 point above your usual
    (strong: 1.5). Self-reported stress reacts to training and life load (Saw et al., BJSM 2016)."""
    usual = avg(usual_period(days, today), stress)
    week = this_week(days, today)
    week_avg = avg(week, stress)
    if usual is None or week_avg is None:
        return _no_signal("stress_spike")
    rise = week_avg - usual
    evidence = [
        Evidence(
            metric="stress",
            text=f"Your stress averaged {week_avg:.1f} out of 5 this week, against your usual {usual:.1f}.",
            value=round(week_avg, 1),
            baseline=round(usual, 1),
            unit="/5",
        )
    ]
    return Signal(
        "stress_spike",
        fires=rise >= STRESS_RISE,
        strong=rise >= STRESS_RISE_STRONG,
        strength=rise / STRESS_RISE_STRONG,
        coverage=coverage(week, stress),
        evidence=evidence,
        chart=_daily_chart(days, today, stress, "stress", "/5", usual),
    )


def rhr_elevated(days: list[DayRecord], today: dt.date) -> Signal | None:
    """Resting HR elevated: this week's average is at least 5 bpm above your usual (strong:
    8 bpm). Needs watch data or the guided morning pulse, so None at the Basic level."""
    usual = avg(usual_period(days, today), resting_hr)
    week = this_week(days, today)
    week_avg = avg(week, resting_hr)
    if usual is None or week_avg is None:
        return None
    rise = week_avg - usual
    evidence = [
        Evidence(
            metric="resting_hr",
            text=(
                f"Your resting heart rate averaged {round(week_avg)} bpm this week, "
                f"{round(rise)} bpm above your usual {round(usual)} bpm."
            ),
            value=round(week_avg),
            baseline=round(usual),
            unit="bpm",
        )
    ]
    return Signal(
        "rhr_elevated",
        fires=rise >= RHR_RISE,
        strong=rise >= RHR_RISE_STRONG,
        strength=rise / RHR_RISE_STRONG,
        coverage=coverage(week, resting_hr),
        evidence=evidence,
        chart=_daily_chart(days, today, resting_hr, "resting_hr", "bpm", usual),
    )


# ---------- history check ----------

# For each cause: how to score a past week (lower = "less of this factor") and how to name it.
HISTORY_FACTORS: dict[CauseId, tuple[Callable[[list[DayRecord]], float | None], str, str]] = {
    "load_spike": (total_load, "lightest training week", "Training load"),
    "sleep_debt": (lambda week: -m if (m := avg(week, sleep_hours)) is not None else None, "best-sleep week", "Sleep"),
    "stress_spike": (lambda week: avg(week, stress), "calmest week", "Stress"),
}


def _period(week: list[DayRecord]) -> str:
    start, end = week[0].date, week[-1].date
    if start.month == end.month:
        return f"{start.day}–{end.day} {end:%b}"
    return f"{start.day} {start:%b} – {end.day} {end:%b}"


def history_check(days: list[DayRecord], today: dt.date, cause_id: CauseId) -> HistoryCheck | None:
    """Did this factor matter for you before? Find the past week where the factor was lowest
    (lightest training, most sleep, least stress) and compare your energy and resting HR in
    that week with your normal. The current episode (last 14 days) is left out, so the check
    uses independent evidence. Returns None for causes without a history check."""
    if cause_id not in HISTORY_FACTORS:
        return None
    score_week, week_name, factor_name = HISTORY_FACTORS[cause_id]
    past = [day for day in days if day.date <= today - dt.timedelta(days=EPISODE_DAYS)]
    if len(past) < 28:
        return None

    best: tuple[float, list[DayRecord]] | None = None
    for end_day in past[6:]:
        week = last_days(past, 7, end_day.date)
        if coverage(week, energy) < MIN_COVERAGE:
            continue
        score = score_week(week)
        if score is not None and (best is None or score < best[0]):
            best = (score, week)
    if best is None:
        return None

    week = best[1]
    week_dates = {day.date for day in week}
    normal = [day for day in past if day.date not in week_dates]  # every other past day
    energy_delta = round(avg(week, energy) - avg(normal, energy), 1)  # type: ignore[operator]
    week_rhr, normal_rhr = avg(week, resting_hr), avg(normal, resting_hr)
    rhr_delta = round(week_rhr - normal_rhr) if week_rhr is not None and normal_rhr is not None else None
    supports = energy_delta >= HISTORY_ENERGY_GAIN or (rhr_delta is not None and rhr_delta <= HISTORY_RHR_DROP)

    tags = Counter(tag for day in week for tag in day.tags).most_common(1)
    tag = tags[0][0] if tags else None
    where = f"your {tag} week ({_period(week)})" if tag else f"your {week_name} ({_period(week)})"
    if supports:
        changes = [f"your energy was {abs(energy_delta):.1f} points higher"] if energy_delta > 0 else []
        if rhr_delta is not None and rhr_delta < 0:
            changes.append(f"your resting heart rate was {abs(rhr_delta)} bpm lower")
        text = f"In {where}, {' and '.join(changes)} than normal. {factor_name} seems to matter for you."
    else:
        text = f"In {where}, your energy was not clearly better, so your history does not confirm this."

    return HistoryCheck(
        supports=supports,
        text=text,
        period_start=week[0].date,
        period_end=week[-1].date,
        period_tag=tag,
        energy_delta=energy_delta,
        rhr_delta=rhr_delta,
    )


# ---------- objective corroboration ----------


def objective_support(days: list[DayRecord], today: dt.date, cause_id: CauseId) -> bool | None:
    """Do body measurements back up this cause? None when no such data exists at this level.

    - sleep debt: sleep was measured by the watch, not only self-reported
    - resting HR up: HRV is down as well (two independent strain markers)
    - load / stress: resting HR is up ≥ 3 bpm or HRV is ≤ 90% of usual
    """
    week, usual = this_week(days, today), usual_period(days, today)
    if cause_id == "sleep_debt":
        if not values(week, watch_sleep_hours):
            return None
        return coverage(week, watch_sleep_hours) >= MIN_COVERAGE

    week_hrv, usual_hrv = avg(week, hrv), avg(usual, hrv)
    hrv_down = week_hrv / usual_hrv <= CORROBORATING_HRV_RATIO if week_hrv and usual_hrv else None
    if cause_id == "rhr_elevated":
        return hrv_down

    week_rhr, usual_rhr = avg(week, resting_hr), avg(usual, resting_hr)
    rhr_up = week_rhr - usual_rhr >= CORROBORATING_RHR_RISE if week_rhr and usual_rhr else None
    if rhr_up is None and hrv_down is None:
        return None
    return bool(rhr_up) or bool(hrv_down)


# ---------- confidence ----------


def score_confidence(
    signal: Signal,
    history: HistoryCheck | None,
    objective: bool | None,
    level: DataLevel,
) -> tuple[Confidence, int, list[ConfidenceCheck]]:
    """Confidence is a points score, shown to the user as a checklist:
    +1 the rule fires, +1 the change is big, +1 your own history supports it,
    +1 body measurements back it up, −1 if less than 70% of this week's data is there.
    4+ = high, 2–3 = medium, 0–1 = low. Basic level (no body measurements) is capped at medium.
    """
    enough_data = signal.coverage >= MIN_COVERAGE
    checks = [
        ConfidenceCheck(label="Clear change compared with your usual", passed=signal.fires),
        ConfidenceCheck(label="A big change, not a small one", passed=signal.strong),
        ConfidenceCheck(
            label="Matches what happened before in your own data"
            if history
            else "No earlier period to compare with",
            passed=bool(history and history.supports),
        ),
        ConfidenceCheck(
            label="Backed up by your watch data"
            if objective is not None
            else "Needs a watch or pulse check to confirm",
            passed=bool(objective),
        ),
        ConfidenceCheck(label="Enough check-ins this week", passed=enough_data),
    ]
    score = sum(check.passed for check in checks[:4]) - (0 if enough_data else 1)
    confidence: Confidence = "high" if score >= 4 else "medium" if score >= 2 else "low"
    if level == "basic" and confidence == "high":
        confidence = "medium"
    return confidence, score, checks


def candidate_signals(days: list[DayRecord], today: dt.date) -> list[Signal]:
    """Run every candidate rule; keep the ones that fire."""
    signals = [
        load_spike(days, today),
        sleep_debt(days, today),
        stress_spike(days, today),
        rhr_elevated(days, today),
    ]
    return [signal for signal in signals if signal is not None and signal.fires]

