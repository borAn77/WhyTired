# WhyTired — Persona Dataset Task Brief

Oct 3, 2026 · @bori

## Goal

You own the synthetic data for our two demo personas, Kasia and Tomek. Every screen in the demo runs on it, so if the data does not tell their stories clearly, detective mode has nothing to find.

We cannot use real health data, so the dataset has to be realistic enough that judges believe it, and scripted enough that the engine finds exactly the causes we designed. The generator must be deterministic, so the whole team always sees the same numbers.

The full product spec is in `CLAUDE.md` in the repo. Read the sections Scores, Morning check-in, Detective mode, Sensor artifact rules, Data model and Demo data before you start.

## Ownership

You are the single owner of everything under `data/`, the generator script and the data checks. Nobody else edits the JSON files; they ask you, and you change the scenario config and regenerate.

**You own**

- `scripts/generate_personas.py`: the generator, with all scenario parameters in one config dict at the top.
- `data/`: every generated JSON file, including the experiment-week branches.
- `tests/test_personas.py`: automated checks that the data matches the scenario.
- `docs/PERSONAS.md`: a short story sheet per persona with the key numbers for the slides.
- The data part of `docs/DISCLOSURE.md`.

**You do not own** the score engine, the detective engine, the API or the UI. If an engine result looks wrong, first check whether the data or the rule is the problem, then agree the fix with the engine owner.

**Who you work with**

| Role | You give them | You need from them |
| --- | --- | --- |
| Backend / rule engine | JSON files that match the agreed schema, scenario dates | Field names and types (agreed at the start), engine output on demo day for tuning |
| Frontend | Demo day, experiment dates, branch names for the time-travel control | Which fields each screen shows |
| Presenter / slides | `docs/PERSONAS.md` with the story and key numbers | Which numbers they want on slides |

## Deliverables and timeline

The backend is blocked until data v1 lands, so H+1.5 is the checkpoint that matters most. H = hours after we start building; the checkpoints match the time plan in `CLAUDE.md`.

| Due | Deliverable | Where | Used by |
| --- | --- | --- | --- |
| H+0.5 | Schema agreed with the backend owner (field names, types, units) | `CLAUDE.md` data model, types in the backend and frontend | Backend, frontend |
| H+1.5 | Generator v1 and data v1: both personas, 90 days | `scripts/generate_personas.py`, `data/` | Backend |
| H+2.5 | Data checks pass | `tests/test_personas.py` | You |
| H+4 | Experiment-week branches: improved and not improved | `data/personas/*/branches/` | Backend, frontend time travel |
| H+7 | Data v2, tuned until detective mode returns the expected causes | `data/` | Demo |
| H+8 | Story sheet with key numbers | `docs/PERSONAS.md` | Presenter |
| H+17 | Data section of the disclosure | `docs/DISCLOSURE.md` | Submission |

Between H+4.5 and H+7 you work in a loop with the engine owner: run detective mode on demo day, compare with the expected result, adjust the config, regenerate. After H+7, change the data only to fix a demo bug.

## Output format

One folder per persona, one JSON array per table, dates from 2026-07-06 to 2026-10-03 (90 days). Demo day is 2026-10-03. The experiment week is 2026-10-04 to 2026-10-10 and lives only in the branch folders.

```
data/
  manifest.json
  personas/
    kasia/
      user.json
      daily_metrics.json
      hr_zone_minutes.json
      sessions.json
      checkins.json
      branches/
        improved/        (same 4 tables, 2026-10-04 to 2026-10-10 only)
        not_improved/
    tomek/
      (same layout; hr_zone_minutes.json is an empty array)
```

`manifest.json` holds the seed, start date, demo day, experiment dates, persona ids and branch names. No timestamps that change between runs, so regenerating with the same seed produces an identical git diff.

**General rules**

- Dates as `YYYY-MM-DD`. Clock times as ISO 8601 with offset, for example `2026-09-27T23:40:00+02:00`. The whole range is in Polish summer time (+02:00).
- One row per persona per day in `daily_metrics` and `checkins`, except the planned missing check-ins.
- Watch-only fields are `null` for Tomek, never 0.
- Round like a real device: integers for HRV, RHR, minutes and steps; one decimal for respiratory rate.

**Fields**

| File | Field | Type and unit | Rule |
| --- | --- | --- | --- |
| user | id, name | string | `kasia`, `tomek` |
| user | birth\_year | int | Kasia 2003, Tomek 2005 |
| user | sports | string\[\] | Kasia `running`; Tomek `gym`, `football` |
| user | goal | string | Kasia `half marathon`; Tomek `strength` |
| user | has\_watch | bool | Kasia true, Tomek false |
| user | usual\_wake\_time | `HH:MM` | Kasia 07:00, Tomek 07:45 |
| user | locale | string | `pl` |
| daily\_metrics | hrv\_rmssd\_ms | int, ms | 5–250; null without watch |
| daily\_metrics | rhr\_bpm | int, bpm | 30–120; null without watch |
| daily\_metrics | resp\_rate | float, breaths/min | 10–22; null without watch |
| daily\_metrics | sleep\_min | int, minutes | Watch only; Tomek's sleep comes from the check-in |
| daily\_metrics | sleep\_start, sleep\_end | ISO datetime | Watch only |
| daily\_metrics | steps | int | Both personas (phone counts steps) |
| daily\_metrics | source | `watch` or `manual` |  |
| hr\_zone\_minutes | z1–z5 | int, minutes | Session days only; sum within ±5 min of the session duration |
| sessions | sport | string |  |
| sessions | duration\_min | int, minutes |  |
| sessions | rpe | int, 1–10 | Both personas |
| sessions | distance\_km | float or null | Runs only; agree with the backend owner before adding |
| checkins | energy, sleep\_quality, soreness, stress, mood | int, 1–5 |  |
| checkins | hours\_slept | float or null | Tomek only |
| checkins | alcohol, late\_caffeine, late\_screens, late\_meal, illness\_symptoms | bool | About the previous evening |

## Persona A: Kasia (watch user)

Kasia, 23, student, amateur runner training for a half marathon, wears a smartwatch. Her story: she ramped up training too fast in the last two weeks, drank coffee late, slept a bit less, and has felt drained for five days.

**Normal values and demo-day values**

| Metric | Normal | Day-to-day variation | Demo day (2026-10-03) |
| --- | --- | --- | --- |
| Resting HR | 52 bpm | ±2 bpm | 59–60 bpm |
| HRV (RMSSD) | 72 ms | ±10% | 50–54 ms |
| Respiratory rate | 14.5 /min | ±0.4 | 14.5–14.9 (must stay under +1) |
| Sleep | 7 h 25 min | ±30 min | 6 h 15 min – 6 h 30 min |
| Bedtime | 23:15 | ±25 min | about 23:50 |
| Steps | 9,000 | ±2,000 | 7,000 |
| Check-in energy | 3–4 | ±1 | 1–2 for 5 days |

**Normal training week:** Tuesday easy run 45 min (effort 4), Thursday tempo 50 min (effort 7), Saturday easy 40 min (effort 3), Sunday long run 80–100 min (effort 5). Monday, Wednesday and Friday are rest days. Her longest run in the 30 days before 2026-09-27 is 100 min.

**From 2026-09-20 (the spike):** 6 sessions a week, about 1.5 times her usual weekly minutes, with higher effort. On Sunday 2026-09-27 a 125-minute long run, 25% longer than her previous longest.

&#91;embedded content: Kasia's scripted events · 2026-07-06 to 2026-10-10\]

Her tiredness starts nine days into the load spike. The August holiday week is the comparison period the detective uses as evidence.

**Expected engine output on demo day**

1. Readiness between 20 and 35 (red zone), high confidence.
2. Top causes in this order: load spike, short sleep, late caffeine.
3. Historical check finds the holiday week, with resting HR about 6 bpm lower than her normal.
4. The night of 2026-09-24 is excluded as a sensor artifact.
5. Alcohol appears only on good days, so it is not ranked.
6. The illness signal stays off, so an experiment is offered.

## Persona B: Tomek (no watch)

Tomek, 21, student, goes to the gym and plays football, has no smartwatch. His story: during the September retake exam period he sleeps 5–6 hours, is on his phone late every night and is stressed. Training stays normal, so load is not the cause.

All his data comes from the morning check-in, manually logged sessions and phone steps. HRV, resting HR, respiratory rate and watch sleep fields are `null`.

**Normal values and demo-day values**

| Metric | Normal | Day-to-day variation | Demo day (2026-10-03) |
| --- | --- | --- | --- |
| Hours slept (check-in) | 7.5 h | ±0.5 h | 5.0–5.5 h |
| Late screens | 1–2 nights a week |  | 5–6 nights a week |
| Check-in stress | 2 | ±1 | 4–5 |
| Check-in energy | 3–4 | ±1 | 1–2 for 4 days |
| Steps | 7,000 | ±2,500 | 5,000 |
| Weekly sessions | 4 |  | 3 |

**Normal training week:** gym Monday, Wednesday and Friday, 60–75 min (effort 6–8), football on Sunday 90 min (effort 7). During exams he drops one gym session, so his load goes slightly down, not up.

&#91;embedded content: Tomek's scripted events · 2026-07-06 to 2026-10-10\]

Short sleep runs through the whole exam period and his energy drops in its last four days. The August summer break is his comparison period.

**Expected engine output on demo day**

1. Readiness in the red or low amber zone, **low confidence** (check-in and self-reported sleep only).
2. Top causes: short sleep, then late screens; high stress may come third.
3. Historical check finds the summer break, when he slept 8–8.5 hours and reported energy 4.
4. No load spike is found.
5. Experiment offered: go to bed at the recommended time for 7 nights.

## Experiment week branches

Each persona gets two versions of 2026-10-04 to 2026-10-10: one where the experiment works and one where it does not. In both, the user follows the experiment, so the only difference is the outcome. The demo toggle picks the branch; the "not improved" branch leads to the doctor summary.

The success criterion in `CLAUDE.md`: average readiness over the experiment week at least 10 points higher than the week before, or average energy at least 1 point higher; for watch users also resting HR back within 3 bpm of baseline.

| Persona | What they do (both branches) | Improved | Not improved |
| --- | --- | --- | --- |
| Kasia | Load down 40%: 4 shorter, easier runs, no long run. Bedtime and caffeine unchanged | Resting HR falls to 53–54 by day 6; HRV back to 65–70 ms; energy rises to 3–4; readiness week average +15 or more | Resting HR stays 58–60; HRV stays around 52 ms; energy stays 1–2; readiness week average changes less than +5 |
| Tomek | Bed at the recommended time: 7–7.5 h of sleep, late screens on 1–2 nights at most. Training unchanged | Energy rises to 3–4 from day 3; stress drops to 3; readiness week average +12 or more | Energy stays 1–2; stress stays 4–5; readiness week average changes less than +5 |

Do not let the "not improved" branch trigger the illness signal: keep respiratory rate and the illness toggle normal. A sick-looking week would change the story from "see your doctor because nothing helped" to "you are ill", which is a different demo.

## Realism rules

The data should look like a real person's month on a chart: noisy, but with causes visibly leading to effects. Use Python with `numpy` only, `numpy.random.default_rng(42)`, and keep every number below in the config dict.

**Noise**

- Smooth day-to-day noise for resting HR and HRV (each day keeps about 60% of yesterday's deviation), so lines drift instead of jumping randomly.
- Keep the 28-day spread big enough: resting HR at least 1.5 bpm, ln(HRV) at least 0.08, sleep at least 25 min. If the spread is too small, the z-scores in the readiness formula explode.
- Weekends: bedtime about 30 min later, steps more variable.

**Cause and effect (lagged to the next morning)**

| Cause | Effect next morning |
| --- | --- |
| Hard session (Load 13 or more) | Resting HR +1–2 bpm, HRV −5–8%, soreness +1 |
| Load spike lasting several days | The effects above add up, partly recovering on rest days |
| Sleep 1 h below need | HRV about −5%, energy −1 |
| Late caffeine | Sleep −20 to −40 min, bedtime +20 min |
| Late screens | Bedtime +30 to +60 min, sleep shorter by the same amount |
| Alcohol | HRV −4%, resting HR +1 bpm (kept small on purpose) |
| High stress | Sleep quality −1, mood −1 |

**Check-in follows the body, with noise:** energy tracks readiness with ±1 noise, clipped to 1–5. Soreness rises the day after long or hard sessions.

**Planned imperfections:** two missing check-ins for Kasia (2026-07-18, 2026-08-29) and three for Tomek (2026-07-12, 2026-07-26, 2026-08-15). All are outside the last 28 days, so baselines on demo day are unaffected, but the engine must handle gaps.

**Pitfalls**

- Never hand-edit JSON. Change the config, regenerate, commit both.
- Exactly one artifact night (Kasia, 2026-09-24): resting HR 88 bpm and HRV 18 ms, while her check-in that morning is normal (energy 4). The next day is back on trend.
- Do not overshoot: readiness should not go below 15, and no more than 5 tired days in a row, or it reads as illness.
- Keep Kasia's respiratory rate under baseline +1 and her illness toggle false the whole time.
- No dates after 2026-10-10.

## Validation

Two layers of checks: data checks you can run on your own from H+2.5, and acceptance tests that need the engine from H+4.5. Both live in `tests/test_personas.py`, and the acceptance tests are skipped until the engine module exists.

**Data checks (no engine needed)**

| Check | Expected |
| --- | --- |
| Every file matches the schema | All fields present, types and units as in Output format |
| Dates | 90 consecutive days per persona, no duplicates; branches cover 2026-10-04 to 2026-10-10 only |
| Ranges | All values inside the ranges in Output format, except the one artifact night |
| Missing check-ins | Exactly the planned dates, nothing else |
| Tomek watch fields | All `null` |
| Zone minutes | Sum within ±5 min of the session duration |
| Kasia holiday week | Average resting HR at least 5 bpm below her 28-day average before the holiday |
| Kasia load spike | 7-day average session minutes on demo day at least 1.3 × the 28-day average |
| Kasia long run | 2026-09-27 run more than 10% longer than her longest run in the 30 days before |
| Kasia tired days | Energy 2 or lower on 2026-09-29 to 2026-10-03 |
| Kasia late caffeine | On at least 4 of her 5 tired days |
| Artifact | Exactly one night with a resting HR jump above 25 bpm: 2026-09-24 |
| Illness signal | Kasia's respiratory rate never above baseline +1; illness toggle always false for both |
| Tomek exam period | Average hours slept in the last 14 days at least 1.5 h below his summer average |
| Determinism | Running the generator twice gives byte-identical files |

**Acceptance tests (with the engine)**

1. Kasia, demo day: readiness 20–35, confidence high.
2. Kasia, detective: causes in the order load spike, short sleep, late caffeine; holiday week shown as supporting evidence; 2026-09-24 listed as excluded.
3. Kasia, detective: alcohol not in the top 3; no illness signal.
4. Tomek, demo day: confidence low; detective top 2 are short sleep and late screens; no load spike.
5. Both personas, branch `improved`: the experiment evaluates to improved.
6. Both personas, branch `not_improved`: the experiment evaluates to not improved.

## Definition of done

The task is done when the engine tells both stories correctly from your data and the team can regenerate it with one command.

- [ ] `python scripts/generate_personas.py` regenerates all files with seed 42, identical every run
- [ ] Both personas, 90 days, plus both experiment branches committed under `data/`
- [ ] All data checks pass
- [ ] All acceptance tests pass with the engine
- [ ] `docs/PERSONAS.md`: per persona a five-line story, the key numbers for slides (for example "resting HR +7 bpm", "holiday week −6 bpm", "5.2 h sleep during exams") and a note that both people are fictional
- [ ] Data section in `docs/DISCLOSURE.md`: synthetic data generated by our own script during HackYeah, seed, no real persons, no external datasets

**Out of scope:** importing real Apple Health, Health Connect or Garmin data; a UI for generating new personas; more than two personas; sleep stages.

**Handoff notes**

- Post in the team chat at each checkpoint (H+1.5, H+4, H+7) with what changed and anything the engine owner must know.
- If an acceptance test fails, first check whether the scenario or the rule is wrong, and decide with the engine owner. Do not tune the data to hide a bug in a rule.
- Judges may ask how the data was made. Be ready to explain the generator in two minutes: config, noise, cause-and-effect rules, checks.

**Open questions:** who owns the backend rule engine, and the real submission deadline (the H+ checkpoints shift with it).
