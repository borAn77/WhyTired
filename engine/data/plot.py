"""Quick visual check of demo_ania.csv.

Run:  python engine/data/plot.py   -> opens a window and saves demo_ania.png
"""
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from generate import ARTIFACT_DAY, FIRMWARE_DAY, HOLIDAY, LOW_DAYS_START, RAMP_START

here = Path(__file__).parent
df = pd.read_csv(here / "demo_ania.csv", parse_dates=["date"])
d = df["date"]

panels = [("resting_hr", "Resting HR (bpm)"), ("hrv_rmssd", "HRV rMSSD (ms)"),
          ("sleep_hours", "Sleep (h)"), ("training_load", "Training load")]
fig, axes = plt.subplots(len(panels), 1, figsize=(11, 9), sharex=True)

for ax, (col, label) in zip(axes, panels):
    ax.plot(d, df[col], color="#333", lw=1.2)
    ax.set_ylabel(label)
    ax.axvspan(d[HOLIDAY[0]], d[HOLIDAY[-1]], color="tab:green", alpha=0.15)
    ax.axvspan(d[RAMP_START], d.iloc[-1], color="tab:orange", alpha=0.12)
    ax.axvspan(d[LOW_DAYS_START], d.iloc[-1], color="tab:red", alpha=0.15)
    ax.axvline(d[ARTIFACT_DAY], color="tab:purple", ls=":")
    ax.axvline(d[FIRMWARE_DAY], color="tab:blue", ls="--")

axes[0].set_title("Ania — green: holiday, orange: load ramp, red: low days, "
                  "purple: artifact night, blue: firmware update", fontsize=9)
fig.tight_layout()
fig.savefig(here / "demo_ania.png", dpi=100)
plt.show()
