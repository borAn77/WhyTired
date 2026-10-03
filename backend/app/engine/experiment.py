"""The personal 7-day experiment: what to try, and whether it worked."""

from __future__ import annotations

import datetime as dt

from ..models import Cause, DataLevel, DayRecord, Experiment, ExperimentPlan, ExperimentResult
from .baselines import avg, energy, last_days, resting_hr, usual_period, values, window
from .load import weekly_load

LOAD_CUT = 0.40  # reduce training load by 40%
IMPROVED_ENERGY_GAIN = 1.0  # energy points (1–5 scale)
RHR_BACK_TO_NORMAL = 3.0  # bpm above usual still counts as "back to normal"
MIN_CHECKINS = 5  # of 7 days, to judge the result
RESPONSE_DELAY_DAYS = 3  # judge on days 4–7: the body needs a few days to respond
BEFORE_DAYS = 5


def _track(level: DataLevel, extra: str) -> list[str]:
    track = ["Energy in your 15-second morning check-in", extra]
    if level == "full":
        track.append("Resting heart rate (your watch records it)")
    elif level == "medium":
        track.append("Morning pulse (30-second guided check)")
    return track


def suggest_experiment(cause: Cause, days: list[DayRecord], today: dt.date, level: DataLevel) -> ExperimentPlan:
    """One simple, safe experiment for the top cause. It changes one thing at a time, so the
    result tells us something about that cause."""
    if cause.id in ("load_spike", "rhr_elevated"):
        week = weekly_load(days, today)
        target = int(round(week * (1 - LOAD_CUT), -1))
        return ExperimentPlan(
            cause_id=cause.id,
            title="Cut your training load by 40% for 7 days",
            steps=[
                f"Keep the next 7 days under {target} load points (last 7 days: {round(week)}).",
                "Make every session easy: effort 5 out of 10 or lower.",
                "Take at least 2 full rest days.",
            ],
            track=_track(level, "Every session with its minutes and effort"),
        )
    if cause.id == "sleep_debt":
        return ExperimentPlan(
            cause_id=cause.id,
            title="Protect a fixed sleep window for 7 days",
            steps=[
                "Go to bed and get up at the same time every day, with 8 hours in bed.",
                "No screens for the last 30 minutes before bed.",
                "Keep training as usual, so we test one change at a time.",
            ],
            track=_track(level, "Hours slept"),
        )
    return ExperimentPlan(
        cause_id=cause.id,
        title="Two extra easy days and a 10-minute wind-down",
        steps=[
            "Swap 2 hard sessions this week for easy ones or rest.",
            "Take 10 minutes every evening to wind down: a walk, stretching or slow breathing.",
            "Keep your sleep times as usual, so we test one change at a time.",
        ],
        track=_track(level, "Stress level"),
    )


def evaluate_experiment(days: list[DayRecord], experiment: Experiment, today: dt.date) -> ExperimentResult:
    """Did the experiment help? Compares energy on days 4–7 of the experiment (the body needs
    a few days to respond) with the 5 days before it started.

    Improved = energy at least 1 point higher AND, if resting HR is measured, back within
    3 bpm of your usual. Fewer than 5 check-ins in 7 days = not enough data to judge.
    """
    start = experiment.start
    last = start + dt.timedelta(days=experiment.days - 1)
    day_number = (today - start).days + 1

    before = last_days(days, BEFORE_DAYS, start - dt.timedelta(days=1))
    energy_before = avg(before, energy)
    rhr_baseline = avg(usual_period(days, start - dt.timedelta(days=1)), resting_hr)

    so_far = window(days, start, min(today, last))
    late = window(days, start + dt.timedelta(days=RESPONSE_DELAY_DAYS), min(today, last))
    checkins = len(values(so_far, energy))
    energy_during = avg(late, energy) if late else avg(so_far, energy)
    rhr_during = avg(late, resting_hr) if late else avg(so_far, resting_hr)

    def result(status, summary: str) -> ExperimentResult:
        return ExperimentResult(
            status=status,
            day=max(0, min(day_number, experiment.days)),
            days_total=experiment.days,
            checkins_logged=checkins,
            energy_before=round(energy_before, 1) if energy_before is not None else None,
            energy_during=round(energy_during, 1) if energy_during is not None else None,
            rhr_baseline=round(rhr_baseline) if rhr_baseline is not None else None,
            rhr_during=round(rhr_during) if rhr_during is not None else None,
            summary=summary,
        )

    if today < start:
        return result("running", "Your experiment starts tomorrow. Check in as usual in the morning.")
    if today < last:
        return result("running", f"Day {day_number} of {experiment.days}. Keep going and check in each morning.")
    if checkins < MIN_CHECKINS or energy_before is None or energy_during is None:
        return result(
            "not_enough_data",
            f"Only {checkins} check-ins in {experiment.days} days, so we can't tell whether it "
            f"worked. Try again and check in every morning.",
        )

    energy_up = energy_during - energy_before >= IMPROVED_ENERGY_GAIN
    rhr_ok = rhr_during is None or rhr_baseline is None or rhr_during <= rhr_baseline + RHR_BACK_TO_NORMAL
    if energy_up and rhr_ok:
        rhr_text = f" and your resting heart rate is back to {round(rhr_during)} bpm" if rhr_during else ""
        return result(
            "improved",
            f"It worked: your energy went from {energy_before:.1f} to {energy_during:.1f} out of 5"
            f"{rhr_text}. Keep the change.",
        )
    rhr_text = (
        f" and your resting heart rate is still {round(rhr_during - rhr_baseline)} bpm above your usual"
        if rhr_during is not None and rhr_baseline is not None and not rhr_ok
        else ""
    )
    return result(
        "not_improved",
        f"Your energy stayed low ({energy_before:.1f} → {energy_during:.1f} out of 5){rhr_text}, "
        f"even after 7 days of the change. This is a good moment to talk to your family doctor. "
        f"We've prepared a one-page summary for the visit.",
    )
