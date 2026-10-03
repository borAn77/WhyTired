# Core engine notes (to be merged into DECISIONS.md)

## Demo data update (engine/data/generate.py)
- Last 5 days: resting HR 52 + 9.5 bpm (noise 0.5). +9.5, not +8.5, because by then the 30-day median has drifted up to ~54 with the training ramp; this gives ≥ 1.6 bpm margin over the +5 rule on every one of the last 5 days.
- HRV clearly low (−30 ms) from day 80, 5 days before the low-day block: a 7-day average needs ~a week of low readings before it drops, so changing only the last 5 days could not make the HRV rule fire on the first of them. Story: HRV often reacts before resting HR. Margin ≥ 2.3 ms. Only rows 2026-09-19..09-28 changed.

## Step 2 – Personal baseline (engine/baseline.py)
- Baseline = rolling **median** of the previous 30 days (today excluded, min 7 valid days); spread = rolling SD. Median because one glitch night (HR 140) barely moves it; today excluded so a bad day can't pull its own baseline up.
- Low day = resting HR > baseline + 5 bpm OR **7-day average HRV** < baseline − 1 SD OR sleep < 6 h OR check-in energy ≤ 2/5. HRV-guided training commonly uses weekly averages to smooth daily noise. On the raw daily rule, 11 pre-ramp days were "low" (incl. a false 6-day streak); with the 7-day average: 1.
- The yardstick is the SD of *daily* HRV, not of the 7-day average: we tested both, and the smaller SD of the smooth 7-day series gave week-long false streaks (07-16..07-22).
- Two personas (runner with watch / gym user with check-in only): a rule runs only if its data exists, missing columns or nulls are skipped, and every output lists `signals_used`. Energy ≤ 2 was added so a no-watch user can have low days at all (otherwise only sleep < 6 h).

## Step 3 – Artifact detection (engine/artifacts.py)
- Plausibility rules: HR jump > 40 bpm/min at rest (minute data only), night HR > 100 with zero motion, > 30% of night missing, resting HR outside 30–120. Each flags the whole day (the night's recording is broken).
- Firmware: compare the 7-day mean after vs before an update; "sudden" = shift > 1.5 × normal daily SD (on non-update days HRV/sleep shifts stayed ≤ 1.2×). Demo: HRV +18.9 ms at 2026-08-30 (1.9×), resting HR 0.2×, sleep 0.4×.
- Only the shifted metric (HRV) is excluded ±3 days around the update: resting HR and sleep readings there are fine, and dropping them pushed the RHR baseline up enough to lose 2 real low days. Known limit: after an update the 30-day HRV window mixes old and new scale until ~30 days have passed (conservative: fewer HRV alarms, not more).
- Output is `{"artifacts": [...], "signals_used": [...]}` so "no artifacts" and "nothing could be checked" (no watch) look different.

## Step 4 – Daily coach (engine/coach.py)
- Red signals = the low-day rules + soreness ≥ 4/5: 2+ → rest, 1 → easy, 0 → hard. Feeling sick → always rest (safety rule; we don't coach through illness).
- The plan is the user's own habit: usual session per weekday = median load of that weekday over the last 4 weeks; hard = above the median training-day load of the last 30 days. Works for both personas (watch load, or session-RPE = RPE × minutes from the gym log).
- Never two hard days in a row (hard yesterday → easy at most). A missed hard session moves to the next free day (no usual hard session, not after a hard day) within 7 days; older misses are dropped, not crammed in. 10% rule caps run distance; with habit-based plans it rarely binds (a 4-week habit can't exceed the 30-day longest run) — it is a guarantee, active once plans come from elsewhere.
