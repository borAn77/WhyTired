"""Synthetic 90-day dataset for the demo runner "Ania".

The story the data tells (day index 0..89):
  - days 0-89   normal runner: resting HR ~52, HRV ~60, sleep ~7.3h
  - days 30-36  holiday week: almost no training, resting HR -5, HRV up
  - day 50      artifact night: sleep HR 140 with zero motion (watch glitch)
  - day 60      firmware update: HRV reads ~10 higher from this day on
  - days 69-89  overreaching: load +10% per week, resting HR creeps up +7,
                HRV drops; from day 80 HRV is clearly low (HRV often reacts
                before resting HR); days 85-89 resting HR is clearly up too,
                so they are clearly "low days" on every rule

Run:  python engine/data/generate.py   -> writes engine/data/demo_ania.csv
"""
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
START = "2026-07-01"
N_DAYS = 90

HOLIDAY = range(30, 37)
ARTIFACT_DAY = 50
FIRMWARE_DAY = 60
RAMP_START = 69          # last 3 weeks
HRV_LOW_START = 80       # last 10 days: HRV clearly low
LOW_DAYS_START = 85      # last 5 days: resting HR clearly up too

# Weekly training pattern (Mon..Sun): (training_load, run_km)
WEEK = [(0, 0), (90, 10), (50, 7), (90, 11), (45, 6), (120, 18), (50, 7)]


def generate(seed=SEED):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(START, periods=N_DAYS, freq="D")
    rows = []

    for i, date in enumerate(dates):
        load, km = WEEK[date.dayofweek]
        rhr = rng.normal(52, 1.5)
        hrv = rng.normal(60, 8)
        sleep = rng.normal(7.3, 0.4)
        soreness = 3 if load >= 90 else 2
        mood = 4

        # Holiday week: very light training, body recovers.
        if i in HOLIDAY:
            load, km = round(load * 0.15), round(km * 0.3)
            rhr -= 5
            hrv += 10
            soreness, mood = 1, 5

        # Overreaching block: +10% load per week, gradual strain.
        if i >= RAMP_START:
            week_no = (i - RAMP_START) // 7 + 1           # 1, 2, 3
            factor = 1.10 ** week_no
            load, km = round(load * factor), round(km * factor, 1)
            progress = (i - RAMP_START) / (N_DAYS - 1 - RAMP_START)  # 0 -> 1
            rhr += 7 * progress
            hrv -= 18 * progress
        # Last 10 days: HRV clearly low. It starts 5 days before the low-day
        # block because the HRV rule uses a 7-day average, which needs about
        # a week of low readings before it drops clearly.
        if i >= HRV_LOW_START:
            hrv = rng.normal(60 - 30, 3)
        # Last 5 days: clearly low, small noise so the 5-day trigger is reliable.
        if i >= LOW_DAYS_START:
            rhr = rng.normal(52 + 9.5, 0.5)
            soreness, mood = 4, 2

        # Firmware update: new HRV algorithm reads ~10 ms higher from now on.
        firmware = "2.1.0" if i < FIRMWARE_DAY else "2.2.0"
        if i >= FIRMWARE_DAY:
            hrv += 10

        sleep_hr_max = rhr + rng.normal(12, 3)
        sleep_motion = max(5, rng.normal(40, 10))
        coverage = rng.uniform(0.92, 1.0)

        # Artifact night: optical sensor lost contact -> HR 140, no motion.
        if i == ARTIFACT_DAY:
            sleep_hr_max, sleep_motion = 140, 0
            rhr = 88

        rows.append({
            "date": date.date().isoformat(),
            "resting_hr": round(rhr, 1),
            "hrv_rmssd": round(hrv, 1),
            "sleep_hours": round(sleep, 2),
            "sleep_hr_max": round(sleep_hr_max, 1),
            "sleep_motion": round(sleep_motion, 1),
            "night_data_coverage": round(coverage, 3),
            "steps": int(rng.normal(9000, 1500) + km * 1300),
            "training_load": load,
            "longest_run_km": km,
            "soreness": soreness,
            "mood": mood,
            "feeling_sick": False,
            "device_firmware": firmware,
        })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    out = Path(__file__).with_name("demo_ania.csv")
    df = generate()
    df.to_csv(out, index=False)
    print(f"Wrote {len(df)} rows to {out}")
