# Demo personas: Kasia and Tomek

Both people are **fictional** and all of their data is **synthetic**. We generated it with our
own deterministic script (`backend/scripts/generate_personas.py`). No real person and no
external dataset was used.

Data covers 90 days, 2026-07-07 to the demo day **2026-10-04** (D0). Each persona also has two
14-day experiment branches after D0: `improved` and `not_improved`. The full scenario is in
`docs/PERSONAS_BRIEF.md`. All numbers below are what the engine shows on demo day.

## Kasia, 23: runner with a smartwatch (Full data level)

1. **Who:** Kasia is a 23-year-old student training for her first half marathon. She wears a smartwatch.
2. **Sport:** She usually runs 4 times a week, about 1,050 load points.
3. **90 days:** She has an easy holiday week (5–11 Aug), where her resting HR drops to about 48. From 21 Sept her training spikes to 6 runs a week, with a 110-minute long run on 3 Oct. She drinks coffee late on her last 5 evenings, and one night in between (24 Sept) her watch strap is loose.
4. **Demo day:** Her energy has been 1–2 out of 5 for 5 days, and the coach says **rest**.
5. **What the app finds:** Training load spike (high confidence), then resting HR up (medium), then too little sleep (medium). Her holiday week supports the load cause. The 24 Sept night is left out as unreliable. The app suggests cutting training load by 40% for 7 days. On the `not_improved` branch this leads to the doctor summary.

**Key numbers for slides**

| What | Number |
| --- | --- |
| Training load, last 7 days | **2700** vs usual **1050** load points (6 of 7 days trained, usually 4) |
| Resting HR this week | **61** vs usual **54** bpm (+7) |
| Sleep, last 7 days | **6.6** vs usual **7.3** h a night (about 4.6 h short in total) |
| Holiday week (5–11 Aug) | energy **+1.1** points, resting HR **−6** bpm vs her normal days |
| Artifact night | **24 Sept**: resting HR 88 bpm (a 31 bpm jump), only 35% of the night recorded, check-in normal (energy 4). Excluded with a reason |
| Long run | **110 min** on 3 Oct, more than 10% longer than her longest run in the previous 30 days |

## Tomek, 21: gym and football, no smartwatch (Basic data level)

1. **Who:** Tomek is a 21-year-old student with no smartwatch. He uses only check-ins and the sessions he logs himself.
2. **Sport:** Gym on Monday, Wednesday and Friday, and football on Sunday.
3. **90 days:** He has a summer break with long nights (15–21 Aug). Then the September retake exams start (from 23 Sept): he sleeps 5–6 h, is on his phone late, is stressed, and drops one gym session, so his load goes down, not up.
4. **Demo day:** His energy has been 1–2 for 4 days. He slept 5.0 h, and the coach says **rest**.
5. **What the app finds:** Too little sleep, then a stress spike, both medium confidence and clearly marked as based on check-ins only. No load spike and no heart data. His summer break supports both causes. The app suggests keeping a fixed sleep window for 7 days.

**Key numbers for slides**

| What | Number |
| --- | --- |
| Sleep, last 7 days | **5.3** vs usual **7.0** h a night |
| Sleep debt | **11.9 h** short over the last 7 days |
| Stress this week | **4.3** vs usual **2.7** out of 5 |
| Holiday week (15–21 Aug) | energy **+1.0** points vs his normal days |
| Coach on demo day | **Rest**: energy 2 out of 5, slept 5.0 h (2.0 h less than usual), stress 4 out of 5 |

## Regenerating the data

```bash
cd backend
uv run python -m scripts.generate_personas   # writes data/kasia.json and data/tomek.json
uv run pytest tests/test_personas.py         # data checks + the demo story on the real engine
```

Every scenario number is in the `CONFIG` dict at the top of the script. Never edit the JSON by
hand: change `CONFIG`, regenerate, and commit both. The noise comes from Python's `random.Random`
with fixed seeds (Kasia 42, Tomek 43, branches +1000 / +2000), so every run produces
byte-identical files. A test checks this.
