"""Personal baseline: what is "normal" for THIS person?

Every metric is compared to the user's own previous 30 days, not to
population norms. A resting HR of 58 is normal for one person and a warning
sign for another.

Works for both personas: a runner with a watch (resting HR, HRV, sleep) and
a gym user without one (daily check-in: sleep, energy, ...). Rules whose data
is missing are skipped; "signals_used" says which ones were checked.

- Baseline = rolling MEDIAN of the previous 30 days. Today is NOT in its own
  window, so a bad day cannot pull its own baseline towards itself.
  Median instead of mean: one glitchy night (HR 140 from a loose watch)
  barely moves a median but would drag a mean.
- Spread   = rolling standard deviation over the same window (for z-scores).
- Untrusted readings (watch errors, see artifacts.py) are found automatically
  and removed before computing either. They never count towards a low day.

All functions take the raw DataFrame (as loaded from demo_ania.csv) and
return plain dicts / lists, ready for JSON.

Run:  python -m engine.baseline   (from the repo root)
"""
import pandas as pd

from .artifacts import detect_artifacts

METRICS = ["resting_hr", "hrv_rmssd", "sleep_hours"]
WINDOW = "30D"       # previous 30 calendar days
MIN_DAYS = 7         # fewer valid days than this -> no baseline yet (None)
HRV_AVG = "7D"       # HRV is judged on its 7-day average (see is_low_day)
HRV_AVG_MIN_DAYS = 4

# Low-day thresholds
RHR_ABOVE_BPM = 5    # resting HR more than 5 bpm above baseline
HRV_BELOW_SD = 1     # HRV 7-day average more than 1 SD below baseline
MIN_SLEEP_H = 6.0    # absolute floor, independent of the baseline
LOW_ENERGY = 2       # check-in energy <= 2 on a 1-5 scale ("tired" or worse)


def compute_baseline(df, artifacts=None):
    """Return a DataFrame indexed by date with, for every metric:
    <metric> (the day's value), <metric>_median and <metric>_sd (baseline),
    plus hrv_7d (HRV averaged over the last 7 days, today included).

    artifacts=None -> detect_artifacts(df) is used. Pass your own list to
    override, e.g. detect_artifacts(df, minute_hr) or [] for none. Each
    entry's untrusted "metrics" (default: all) become NaN, so they neither
    enter any baseline nor count towards a low day.
    """
    if artifacts is None:
        artifacts = detect_artifacts(df)["artifacts"]
    raw = df.set_index(pd.to_datetime(df["date"]))
    # A metric the user doesn't have (no watch -> no resting HR / HRV) becomes
    # an all-NaN column, so every rule that needs it is simply skipped.
    data = raw.reindex(columns=METRICS).astype(float)
    for a in artifacts:
        day = pd.Timestamp(a["date"])
        if day in data.index:
            data.loc[day, a.get("metrics", METRICS)] = float("nan")

    # closed="left": window is [day - 30d, day), i.e. today is excluded.
    rolling = data.rolling(WINDOW, closed="left", min_periods=MIN_DAYS)
    median, sd = rolling.median(), rolling.std()
    # No HRV verdict on a day whose own HRV reading is missing or untrusted.
    data["hrv_7d"] = (data["hrv_rmssd"].rolling(HRV_AVG, min_periods=HRV_AVG_MIN_DAYS)
                      .mean().where(data["hrv_rmssd"].notna()))
    # Self-reported energy (1-5) from the daily check-in, judged on its own scale.
    data["energy"] = raw["energy"].astype(float) if "energy" in raw else float("nan")
    return pd.concat([data, median.add_suffix("_median"), sd.add_suffix("_sd")], axis=1)


def _num(x):
    """NaN -> None so the output is valid JSON; otherwise round for display."""
    return None if pd.isna(x) else round(float(x), 2)


def _deviation(row, metric):
    value, median, sd = row[metric], row[f"{metric}_median"], row[f"{metric}_sd"]
    diff = value - median
    return {
        "metric": metric,
        "value": _num(value),
        "baseline": _num(median),
        "sd": _num(sd),
        "diff": _num(diff),                              # absolute difference
        "z": _num(diff / sd) if sd else None,            # in standard deviations
    }


def deviation(df, metric, date, artifacts=None):
    """How far is `metric` on `date` from the personal baseline?

    Example: {"metric": "resting_hr", "date": "2026-09-27", "value": 59.7,
              "baseline": 54.2, "sd": 2.9, "diff": 5.5, "z": 1.9}
    """
    row = compute_baseline(df, artifacts).loc[pd.Timestamp(date)]
    return {"date": pd.Timestamp(date).strftime("%Y-%m-%d"), **_deviation(row, metric)}


def is_low_day(df, date, artifacts=None):
    """A day is "low" if ANY of these is true:
      - resting HR         > baseline + 5 bpm
      - HRV 7-day average  < baseline - 1 SD (SD of daily HRV)
      - sleep              < 6 h
      - check-in energy    <= 2 (of 5)
    A rule is only checked when its data exists (and, for resting HR / HRV,
    a baseline exists); "signals_used" lists the rules that were checked.

    Why a 7-day average for HRV: daily HRV is very noisy (one late coffee
    moves it), so HRV-guided training usually looks at the weekly average.
    Why the SD of DAILY HRV as the yardstick: the 7-day average is smooth, so
    its own SD is small and one random cluster of low days drags it under
    that threshold for a whole week (tested on the demo data: 7-day false
    streaks). Against the daily SD, only a sustained drop counts.

    Returns {"date", "low": bool, "reasons": [human-readable strings],
             "signals_used": [...], "hrv_7d": float,
             "deviations": {metric: deviation dict}}.
    """
    row = compute_baseline(df, artifacts).loc[pd.Timestamp(date)]
    dev = {m: _deviation(row, m) for m in METRICS}
    def has(*cols):  # does this day have the data a rule needs?
        return all(pd.notna(row[c]) for c in cols)

    used, reasons = [], []

    if has("resting_hr", "resting_hr_median"):
        used.append("resting_hr")
        if row["resting_hr"] > row["resting_hr_median"] + RHR_ABOVE_BPM:
            reasons.append(f"Resting HR {row['resting_hr']:.0f} bpm "
                           f"(your normal: {row['resting_hr_median']:.0f} bpm)")
    if has("hrv_7d", "hrv_rmssd_median", "hrv_rmssd_sd"):
        used.append("hrv_7d")
        if row["hrv_7d"] < row["hrv_rmssd_median"] - HRV_BELOW_SD * row["hrv_rmssd_sd"]:
            reasons.append(f"HRV 7-day average {row['hrv_7d']:.0f} ms "
                           f"(your normal: {row['hrv_rmssd_median']:.0f} ms)")
    if has("sleep_hours"):
        used.append("sleep_hours")
        if row["sleep_hours"] < MIN_SLEEP_H:
            normal = (f" (your normal: {row['sleep_hours_median']:.1f}h)"
                      if has("sleep_hours_median") else "")
            reasons.append(f"Sleep {row['sleep_hours']:.1f}h{normal}")
    if has("energy"):
        used.append("energy")
        if row["energy"] <= LOW_ENERGY:
            reasons.append(f"Energy {row['energy']:.0f}/5 in your check-in")

    return {"date": pd.Timestamp(date).strftime("%Y-%m-%d"), "low": bool(reasons), "reasons": reasons,
            "signals_used": used, "hrv_7d": _num(row["hrv_7d"]), "deviations": dev}


if __name__ == "__main__":
    from pathlib import Path

    df = pd.read_csv(Path(__file__).parent / "data" / "demo_ania.csv")
    low = {d: is_low_day(df, d) for d in df["date"]}
    for d in df["date"].tail(8):
        print(d, "LOW " if low[d]["low"] else "ok  ", "; ".join(low[d]["reasons"]))

    pre_ramp = [d for d in df["date"] if d < "2026-09-08" and low[d]["low"]]
    print(f"Low days before the training ramp (2026-09-08): {len(pre_ramp)} {pre_ramp}")

    # Self-checks: the demo story's last 5 days must all be low days,
    # and the artifact night must not count as one.
    assert all(low[d]["low"] for d in df["date"].tail(5))
    assert not low["2026-08-20"]["low"]
    assert low["2026-09-28"]["signals_used"] == ["resting_hr", "hrv_7d", "sleep_hours"]
    print("OK: last 5 days are low days, artifact night 2026-08-20 is not")

    # Persona 2 (gym, no watch): same days, only a check-in.
    gym = df[["date", "sleep_hours", "soreness", "mood", "feeling_sick", "training_load"]].assign(energy=2)
    r = is_low_day(gym, "2026-09-28")
    assert r["signals_used"] == ["sleep_hours", "energy"] and r["low"], r
    print("OK: no-watch user ->", r["signals_used"], r["reasons"])
