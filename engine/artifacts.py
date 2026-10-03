"""Artifact detection: "is it your body, or is it the watch?"

A smartwatch measures heart rate with an optical sensor on the wrist. A loose
strap or a software update can produce numbers that look like a health
problem but are not. Before we judge a day, we check whether its data can be
trusted. Every rule is a plain plausibility check; a flagged day gets a
human-readable reason and is left out of baselines and low-day counts.

A day is excluded if ANY rule fires:
  1. HR jumps > 40 bpm within 1 minute while at rest  (only with minute data)
  2. Night HR > 100 bpm with zero motion
  3. More than 30% of the night has no data
  4. Resting HR < 30 or > 120 bpm
  5. A sudden metric shift at a firmware change -> the ±3 days around it

Run:  python -m engine.artifacts   (from the repo root)
"""
import pandas as pd

MAX_JUMP_BPM = 40           # rule 1
SLEEP_HR_LIMIT = 100        # rule 2
MIN_NIGHT_COVERAGE = 0.70   # rule 3: more than 30% of the night missing
RHR_MIN, RHR_MAX = 30, 120  # rule 4: outside this is not a plausible resting HR
FIRMWARE_DAYS = 3           # rule 5: exclude ±3 days around the update
SHIFT_WINDOW = 7            # rule 5: compare the week after vs the week before
SHIFT_SD = 1.5              # rule 5: "sudden" = shift > 1.5 x normal daily SD

# Sensor metrics a firmware update can change, with labels for messages.
SENSOR_METRICS = {"resting_hr": ("Resting HR", "bpm"),
                  "hrv_rmssd": ("HRV", "ms"),
                  "sleep_hours": ("Sleep", "h")}

DAY = pd.Timedelta(days=1)


def _dates(df):
    """Dates as 'YYYY-MM-DD' strings, whatever format the caller used."""
    return pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")


def _day_reasons(row):
    """Rules 2-4: plausibility checks on one day's summary values.
    Missing values (NaN) compare as False, so they never trigger a rule."""
    reasons = []
    if row["sleep_hr_max"] > SLEEP_HR_LIMIT and row["sleep_motion"] == 0:
        reasons.append(f"Night HR reached {row['sleep_hr_max']:.0f} bpm with zero movement: "
                       "the watch most likely lost skin contact (not your heart)")
    if row["night_data_coverage"] < MIN_NIGHT_COVERAGE:
        reasons.append(f"Only {row['night_data_coverage']:.0%} of the night was recorded "
                       f"(more than {1 - MIN_NIGHT_COVERAGE:.0%} missing)")
    if row["resting_hr"] < RHR_MIN or row["resting_hr"] > RHR_MAX:
        reasons.append(f"Resting HR {row['resting_hr']:.0f} bpm is outside the plausible "
                       f"range ({RHR_MIN}-{RHR_MAX} bpm)")
    return reasons


def _minute_jumps(minute_hr):
    """Rule 1: {date: reason} for HR jumps > 40 bpm between two consecutive
    resting minutes. A heart cannot change that fast at rest; a sensor can.

    minute_hr: DataFrame with columns time, hr, at_rest (the watch's own
    rest/activity flag).
    """
    m = minute_hr.assign(time=pd.to_datetime(minute_hr["time"])).sort_values("time")
    size = m["hr"].diff().abs()
    jump = ((size > MAX_JUMP_BPM)
            & (m["time"].diff() <= pd.Timedelta(minutes=1))
            & m["at_rest"] & m["at_rest"].shift(fill_value=False))
    worst = size[jump].groupby(m["time"][jump].dt.strftime("%Y-%m-%d")).max()
    return {d: f"Heart rate jumped {s:.0f} bpm within 1 minute while resting (sensor glitch)"
            for d, s in worst.items()}


def _day_artifacts(df, minute_hr=None):
    """Rules 1-4 -> {date: [reasons]}."""
    found = {}
    for date, row in zip(_dates(df), df.to_dict("records")):
        if reasons := _day_reasons(row):
            found[date] = reasons
    if minute_hr is not None:
        for date, reason in _minute_jumps(minute_hr).items():
            found.setdefault(date, []).append(reason)
    return found


def firmware_changes(df, minute_hr=None):
    """Every firmware update, plus the metrics that shifted suddenly at it.

    Shift = mean of the 7 days from the update on, minus mean of the 7 days
    before. It counts as "sudden" if larger than 1.5 x the metric's normal
    daily SD (previous 30 days): daily noise largely averages out over a week,
    so a week-to-week jump that big is unlikely to be noise. Days already
    flagged by rules 1-4 are left out first, so one glitch can't fake a shift.

    Returns [{"date", "from", "to", "shifts": {metric: shift}}]; "shifts" is
    empty when the update changed nothing measurable.
    """
    data = df.set_index(pd.to_datetime(df["date"]))
    values = data[list(SENSOR_METRICS)].astype(float)
    values.loc[values.index.isin(pd.to_datetime(list(_day_artifacts(df, minute_hr))))] = float("nan")

    firmware, previous = data["device_firmware"], data["device_firmware"].shift()
    changes = []
    for day in data.index[(firmware != previous) & previous.notna()]:
        before = values.loc[day - SHIFT_WINDOW * DAY: day - DAY].mean()
        after = values.loc[day: day + (SHIFT_WINDOW - 1) * DAY].mean()
        normal_sd = values.loc[day - 30 * DAY: day - DAY].std()
        shift = after - before
        sudden = shift[shift.abs() > SHIFT_SD * normal_sd]
        changes.append({"date": day.strftime("%Y-%m-%d"),
                        "from": previous[day], "to": firmware[day],
                        "shifts": {m: round(float(v), 1) for m, v in sudden.items()}})
    return changes


def detect_artifacts(df, minute_hr=None):
    """All days whose data can't be trusted, sorted by date:
    [{"date": "2026-08-20", "excluded": True, "reason": "...",
      "metrics": ["hrv_rmssd", "resting_hr", "sleep_hours"]}]

    "metrics" = which readings of that day are untrusted. Rules 1-4 mean the
    night's recording is broken -> all of them. A firmware update only
    affects the metrics it shifted -> just those (resting HR and sleep on
    those days are still fine, so we keep them). Several reasons on one day
    are joined with "; ".
    """
    found = {d: (r, set(SENSOR_METRICS)) for d, r in _day_artifacts(df, minute_hr).items()}
    known_dates = set(_dates(df))

    for fw in firmware_changes(df, minute_hr):
        if not fw["shifts"]:
            continue
        what = ", ".join(f"{SENSOR_METRICS[m][0]} reads {abs(v):.1f} {SENSOR_METRICS[m][1]} "
                         f"{'higher' if v > 0 else 'lower'}" for m, v in fw["shifts"].items())
        reason = (f"Within {FIRMWARE_DAYS} days of watch firmware update {fw['from']} -> {fw['to']} "
                  f"on {fw['date']} ({what} afterwards): readings around the update are not comparable")
        day = pd.Timestamp(fw["date"])
        for d in pd.date_range(day - FIRMWARE_DAYS * DAY, day + FIRMWARE_DAYS * DAY).strftime("%Y-%m-%d"):
            if d in known_dates:
                reasons, metrics = found.setdefault(d, ([], set()))
                reasons.append(reason)
                metrics.update(fw["shifts"])

    return [{"date": d, "excluded": True, "reason": "; ".join(r), "metrics": sorted(m)}
            for d, (r, m) in sorted(found.items())]


if __name__ == "__main__":
    from pathlib import Path

    df = pd.read_csv(Path(__file__).parent / "data" / "demo_ania.csv")
    artifacts = detect_artifacts(df)
    for a in artifacts:
        print(a["date"], "-", a["reason"])
    print("Firmware changes:", firmware_changes(df))

    # Self-checks: the demo story's artifact night and firmware update.
    by_date = {a["date"]: a for a in artifacts}
    assert "zero movement" in by_date["2026-08-20"]["reason"]
    assert by_date["2026-08-30"]["metrics"] == ["hrv_rmssd"]
    assert firmware_changes(df)[0]["date"] == "2026-08-30"
    assert "hrv_rmssd" in firmware_changes(df)[0]["shifts"]
    # Rule 1 on made-up minute data: a 50 bpm jump counts only while at rest.
    minutes = pd.DataFrame({"time": ["2026-07-05 03:00", "2026-07-05 03:01"],
                            "hr": [50, 100], "at_rest": [True, True]})
    assert "2026-07-05" in _minute_jumps(minutes)
    assert not _minute_jumps(minutes.assign(at_rest=[True, False]))
    print("OK: artifact night 2026-08-20 excluded, firmware change 2026-08-30 detected")
