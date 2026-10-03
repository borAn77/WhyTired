# Core engine notes (to be merged into DECISIONS.md)

## Step 2 – Personal baseline (engine/baseline.py)
- Baseline = rolling **median** of the previous 30 days (today excluded, min 7 valid days); spread = rolling SD. Median because one glitch night (HR 140) barely moves it; today excluded so a bad day can't pull its own baseline up.
- Low day = resting HR > baseline + 5 bpm OR **7-day average HRV** < baseline − 1 SD OR sleep < 6 h. HRV-guided training commonly uses weekly averages to smooth daily noise. On the raw daily rule, 11 pre-ramp days were "low" (incl. a false 6-day streak); with the 7-day average: 1.
- The yardstick is the SD of *daily* HRV, not of the 7-day average: we tested both, and the smaller SD of the smooth 7-day series gave week-long false streaks (07-16..07-22). Trade-off: the HRV rule is conservative; in the demo, resting HR carries the 5-day trigger (margin 0.55–2 bpm).

## Step 3 – Artifact detection (engine/artifacts.py)
- Plausibility rules: HR jump > 40 bpm/min at rest (minute data only), night HR > 100 with zero motion, > 30% of night missing, resting HR outside 30–120. Each flags the whole day (the night's recording is broken).
- Firmware: compare the 7-day mean after vs before an update; "sudden" = shift > 1.5 × normal daily SD (on non-update days HRV/sleep shifts stayed ≤ 1.2×). Demo: HRV +18.9 ms at 2026-08-30 (1.9×), resting HR 0.2×, sleep 0.4×.
- Only the shifted metric (HRV) is excluded ±3 days around the update: resting HR and sleep readings there are fine, and dropping them pushed the RHR baseline up enough to lose 2 real low days. Known limit: after an update the 30-day HRV window mixes old and new scale until ~30 days have passed (conservative: fewer HRV alarms, not more).
