# WhyTired: HackYeah build plan

## Context
The repo `borAn77/WhyTired` is pushed with `main` and `dev` and only holds a README and a .gitignore. We are building the app described in the brief for the HackYeah "Sport & Healthcare" task.
- **Deadline:** Sun 10:00 CEST. It is now Sat ~11:30, so there are ~18.5 h until the feature freeze at Sun 06:00.
- **Team (2):** Boran owns the backend, the frontend and the app, working with Claude in this session. The teammate owns the synthetic data and the AI layer.
- **LLM:** Anthropic.
- **Accent color:** coral on deep navy.
- **Toolchain on this Mac:** node 22, npm, uv, python 3.14 and docker are all available.
- **Definition of done:** the brief's 6 items.

## Key decisions (to be seeded into docs/DECISIONS.md)
1. **Stateless backend.**
   - The client keeps the session in localStorage: persona, today, scenario, data level, logged check-ins and the active experiment.
   - Every POST call sends that context. No DB and no auth.
   - This is safe when many judges use one demo link, and it survives Render restarts.
2. **Deterministic synthetic data, committed as JSON.**
   - A seeded generator produces 90 days of history plus 14 "future" days for each outcome branch (`improved` / `not_improved`).
   - Time travel only moves `today`.
3. **Data level is a request parameter.** The engine reads only the fields that level allows. This means no-watch mode can also be shown on Kasia, and Tomek has no watch data at all.
4. **Confidence is a points score with a cap per data level.** Basic can never go above Medium.
5. **The share link is a base64url token of the request context** (`/s/<token>`). It is a real, read-only, reproducible link that needs no DB. The QR code encodes that link.
6. **Deployment:** both on Render (`render.yaml`): the frontend as a free static site, which calls the API service directly (`VITE_API_URL`, CORS on the API). See DECISIONS D7 for why we left Vercel.
7. **LLM call setup:**
   - Model `claude-haiku-4-5`, overridable with `ANTHROPIC_MODEL`.
   - No `effort` setting, because Haiku rejects it; an 8 s timeout; responses cached in memory by a hash of the input.
   - Any of these falls back to template text: an error, a timeout, a refusal stop_reason, or a failed validation.
   - Prompt caching isn't worth it here because the system prompt is shorter than the minimum cacheable length.
8. **The Frandsen 2025 rule was measured on running *distance*.** We apply the same >10% rule to session *duration* so it works across sports. This is stated in the code comment and in DECISIONS.md.

## Folder structure
```
CLAUDE.md                 # this brief, team line filled in (shared rules for both Claude sessions)
README.md  render.yaml      # Render blueprint for the API
docs/DECISIONS.md  docs/DISCLOSURE.md
backend/                  # FastAPI, uv, Python 3.12 pinned for Render
  .env.example            # LLM_PROVIDER=anthropic|none, ANTHROPIC_API_KEY, ANTHROPIC_MODEL
  app/main.py             # routes only
  app/models.py           # Pydantic = data + API contract (shared, change via PR)
  app/store.py            # load data/*.json; build day list for (persona, today, scenario, data_level)
  app/engine/             # pure functions, no I/O, one commented rule per function
    load.py baselines.py artifacts.py causes.py coach.py experiment.py summary.py
  app/llm/                # teammate: providers.py explain.py validate.py templates.py (EN/PL)
  scripts/generate_personas.py   # teammate: seeded, stdlib only
  data/kasia.json tomek.json     # generated, committed
  tests/                  # pytest per engine module + persona integration + validator
frontend/                 # Vite + React + TS + Tailwind + shadcn/ui, npm
  src/styles/tokens.css   # design tokens (CSS vars → Tailwind theme)
  src/lib/                # api.ts types.ts (hand-mirrored models) session.ts share.ts
  src/components/         # PhoneFrame DemoPanel ConfidenceBadge DataLevelBadge CauseCard ExcludedList MiniChart Logo states/
  src/screens/            # Onboarding CheckIn Today Detective Experiment Result DoctorSummary
```
Also: `.gitignore` gets `!.env.example`, because `.env.*` currently hides it.

## Data model (backend/app/models.py)
- `Profile`: id, name, age, goal, sports[], has_watch
- `CheckIn` (5 questions): energy 1–5, sleep_hours, sleep_quality 1–5, stress 1–5, soreness 1–5
- `Session`: sport, duration_min, rpe 1–10. Load = duration × RPE (Foster 2001)
- `WatchDay`: resting_hr, hrv_ms, sleep_min, sleep_coverage 0–1, sleep_hr_avg, day_hr_avg
- `DayRecord`: date, checkin?, sessions[], steps?, manual_pulse?, watch?
- `PersonaFile`: profile, history: DayRecord[90], future: {improved: DayRecord[14], not_improved: DayRecord[14]}
- `Ctx` (body of every POST): persona_id, today, scenario, data_level basic|medium|full, checkins {date: CheckIn}, experiment?, lang pl|en
- Outputs:
  - `Cause`: id, confidence, score, evidence[], history_check, data_level_used, chart
  - `ExcludedPoint`: date, metric, value, reason
  - `DetectiveResult`, `CoachResult`, `Experiment`, `ExperimentResult`, `DoctorSummary`

## Engine rules (starting thresholds, tuned against the synthetic data)
| Rule | Fires when |
|---|---|
| low-energy trigger | energy ≤ 2 on ≥ 3 consecutive days (subjective check-ins as load indicators: Saw 2016) |
| load_spike | last-7-day load ≥ 1.3× your usual week = the median of the 4 weeks before (strong ≥ 1.5×, DECISIONS D11) |
| sleep_debt | Σ(personal 28-day average − hours slept) over 7 days ≥ 4 h (strong ≥ 7 h) |
| stress_spike | 7-day mean stress ≥ 28-day mean + 1.0 (strong +1.5) |
| rhr_elevated | 7-day mean resting HR ≥ 28-day baseline + 5 bpm (strong +8). Medium/Full only |
| history check | the lowest-factor 7-day window in the user's past (e.g. Kasia's holiday week; the last 14 days are left out) vs. all other past days. Supports the cause if energy is ≥ +0.5 or resting HR is ≤ −3 bpm |
| confidence | +1 fires, +1 strong, +1 history supports, +1 objective corroboration (RHR/HRV), −1 if fewer than 70% of days have data. ≥4 high, 2–3 medium, ≤1 low. Basic is capped at medium |
| artifacts | the 3 rules from the brief. The jump rule also requires >25 bpm from the median of the last 7 valid readings (DECISIONS D10). Excluded points are returned with a reason |
| experiment eval | improved if mean energy on days 4–7 ≥ the pre-experiment mean + 1.0 and, when resting HR exists, resting HR ≤ baseline + 3. Fewer than 5 check-ins → not_enough_data |
| coach | One flag each for: energy ≤ 2, resting HR ≥ usual + 5, sleep ≤ usual − 1.5 h, soreness ≥ 4, stress ≥ 4, load ratio ≥ 1.3.<br>0 flags → hard, 1–2 → easy, ≥3 → rest. Feeling ill → rest. Hard yesterday → easy at most. A load-cut experiment caps at easy (DECISIONS D12) |
| injury warning | planned duration > 1.10 × the longest session in the last 30 days (Frandsen 2025, used as a duration proxy) |

**Experiment per top cause:**
- load_spike or rhr_elevated → −40% load for 7 days, plus logging resting HR each morning
- sleep_debt → a fixed sleep window
- stress_spike → 2 extra easy days plus a wind-down routine

**LLM input and output:**
- Input is the findings JSON only: relative days, no name and no dates.
- The validator checks two things:
  - every number in the text, normalized for Polish decimal commas, must exist in the input
  - a blocklist of diagnosis, medication and lab/test terms in EN and PL must not appear
- If either check fails, the template text is used.

## API (all stateless)
- `GET /api/health`
- `GET /api/personas`
- `POST /api/coach` (Ctx plus planned_session?) → CoachResult
- `POST /api/detective` (Ctx) → DetectiveResult: causes, excluded points, suggested experiment, explanation {text, source: llm|template}
- `POST /api/experiment` (Ctx with experiment) → ExperimentResult
- `POST /api/summary` (Ctx) → DoctorSummary: timeline, trends, what was tried and the result, questions, disclaimer. Questions come from a fixed per-cause list, with no diagnoses and no lab tests
- `POST /api/import/csv`: stretch goal only

## Frontend notes
- The app sits in a phone frame on desktop.
- `DemoPanel` sits outside the frame and holds:
  - −1 / +1 / +7 day buttons
  - the scenario toggle
  - the persona switch
  - reset
- **Tokens:**
  - Colors: navy primary, coral accent.
  - Coral is ~2.8:1 on white, so it fails AA as text. Use it for fills and icons with navy text, and add a darker coral token for text and for white-on-coral (must be ≥4.5:1).
  - Type: 16px body text minimum.
- Confidence and data level are always shown with an icon and a label, never color alone.
- Every screen has one primary action, plus empty, loading and error states.
- The summary page has `@media print` rules for one A4 page.

## Time plan (milestone = runs end to end, then commit → PR to dev; dev → main when green)
| When | Boran + Claude | Teammate (data/AI) | Exit check |
|---|---|---|---|
| Sat 11:30–13:00 | **M0:**<br>• CLAUDE.md<br>• scaffold backend and frontend<br>• tokens, PhoneFrame, logo<br>• `models.py` contract committed by ~12:15<br>• deploy skeleton | persona storylines → generator against the contract (Kasia first) | deployed page calls /api/health |
| 13:00–17:00 | **M1:** engine + pytest, `/api/detective` | both personas + future branches (~14:30), then the LLM layer (EN) | pytest green; Kasia → load_spike high, artifact night excluded with reason |
| 17:00–21:00 | **M2:** Detective screen, polished (the main demo screen) | LLM wired into /detective, PL templates, data tuned to the story | detective works end to end with LLM and with fallback |
| 21:00–23:30 | **M3:** Onboarding → Check-in → Today/coach + `/api/coach` | Polish summary copy + questions, summary LLM text, DISCLOSURE draft | DoD 1 |
| 23:30–02:30 | **M4:**<br>• DemoPanel<br>• experiment and result screens<br>• `/api/experiment`, `/api/summary`<br>• summary page + print + share/QR | validator tests, Tomek tuning, README walkthrough text | DoD 2–4 locally |
| 02:30–04:00 | **M5:** Tomek / no-watch UI, empty/loading/error states | rules bug bash, screenshots | DoD 5 |
| 04:00–06:00 | **M6:** production deploy, README (Mermaid), DECISIONS.md, buffer | slides outline | DoD 6 on the demo URL |
| **Sun 06:00** | **FEATURE FREEZE.** Then: polish, bug fixes, 10-slide PDF, 2 rehearsals | | |
| Sun 09:00 | Submit on Challenge Rocket (1 h margin) | | |

**Cut order** (apply when a step runs more than 45 min over):
1. manual-pulse timer
2. EN toggle on the summary
3. LLM text on the summary (use templates)
4. polish of the "improved" screen
5. CSV import never starts unless everything else is done

## Dependencies to approve
- **Frontend:**
  - tailwindcss
  - shadcn/ui and what its init pulls in (radix, cva, clsx, tailwind-merge)
  - lucide-react
  - recharts (through shadcn charts)
  - react-router-dom
  - qrcode.react
- **Backend:**
  - fastapi, uvicorn, pydantic, anthropic, python-dotenv
  - dev: pytest, httpx
- All of these are MIT, BSD, ISC or Apache licensed. The licences get listed in DISCLOSURE.md.

## Needed from the team
- **Logo:** put it at `frontend/public/logo.svg` (PNG also works). A placeholder wordmark is used until then.
- **Anthropic key:** goes in `backend/.env`, which is never committed.
- **Deploy accounts:** a Render account connected to GitHub (static site + API).
- **Teammate:** has accepted the repo invite and works on `feature/data-ai`.

## Verification
- `cd backend && uv run pytest` covers:
  - every rule
  - Kasia: load_spike ranked first with high confidence, artifact night excluded
  - Tomek: sleep_debt ranked first with confidence ≤ medium
  - not_improved branch
  - validator rejects invented numbers and banned terms
- `cd frontend && npm run build` passes, which includes tsc.
- Local run is `uv run uvicorn app.main:app --reload` together with `npm run dev`. Walk through DoD 1–5 with the DemoPanel.
- Remove the API key and check that explanations still render, labelled "template".
- Summary page: print preview fits one A4 page, and the share link opens in a private window.
- Repeat the walkthrough on the deployed URL. Before the demo, call `/api/health` to wake Render from its cold start.

## Persona data
The day-by-day stories of Kasia and Tomek are documented in `docs/PERSONAS.md`, owned by Berken. The original data brief is `docs/PERSONAS_BRIEF.md`.
- **Source of truth:** the generator, `backend/scripts/generate_personas.py`.
- **Tests:** `backend/tests/test_personas.py` locks the demo story: causes and their confidence, the artifact night, and both experiment branches.
- **Regenerating:** `cd backend && uv run python -m scripts.generate_personas`. A test fails if the committed JSON doesn't match the generator.

## Ownership and git workflow
- **Boran (+Claude):**
  - `backend/app/` (except `llm/`)
  - `backend/scripts/` + `backend/data/` (generator done in M1, story beats from Berken's first dataset)
  - `frontend/`
  - deploy config and docs
- **Berken:**
  - `backend/app/llm/` (prompt, provider, validator, EN/PL templates) + tests
  - Polish copy for the doctor summary, DISCLOSURE, slides
- `engine/` and the root `requirements.txt` hold Berken's first dataset (CSV). The app doesn't use them; Berken decides whether to keep them.
- `backend/app/models.py` is the shared contract. Change it only through a PR that both of you look at.
- `main` is the live demo: every push to `main` deploys on Render.
  - **Boran (+Claude):** push straight to `main`, but only after `uv run pytest` and `npm run build` pass.
  - **Berken:** work on `feature/<topic>` and open a PR; Boran merges it.
  - `dev` is no longer used.

## LLM layer interface (owner: Berken)
Everything lives in `backend/app/llm/`: `providers.py`, `explain.py`, `validate.py`, `templates.py`. Tests go in `backend/tests/test_llm.py`.

```python
# backend/app/llm/explain.py
from app.models import DetectiveResult, Explanation, Lang

def explain_detective(result: DetectiveResult, lang: Lang) -> Explanation: ...
```
- **Where it's called:** `POST /api/detective` calls this only when `result.triggered`. Boran wires it into `main.py` once the module exists.
- **Model input:** only the computed findings, no names, no dates and no raw time series:
  - `low_energy_days`, `data_level`
  - per cause: id, title, confidence, evidence (text, value, baseline, unit), and history (supports, energy_delta, rhr_delta)
  - the number of excluded nights and the experiment title
- **Output:** 2–4 plain sentences in `lang` (`en` / `pl`), returned as `Explanation(text=..., source="llm")`.
- **Validation (`validate.py`):** if either check fails, return the `templates.py` text with `source="template"`.
  1. Every number in the text must exist in the input JSON. Normalise Polish decimals (`6,5` → `6.5`) and allow the same rounding.
  2. No blocked terms, in EN or PL: diagnoses and diseases, medication and supplements, lab and blood tests. **Match whole words only.** For example, `lekarz` (doctor) is fine but `leki` (medication) is not, and `lab` must not match `label`.
- **Provider (`providers.py`):**
  - `LLM_PROVIDER=anthropic|none`. With `none`, always use the template.
  - `ANTHROPIC_MODEL`, default `claude-haiku-4-5`, using the official `anthropic` SDK (already a dependency).
  - No `effort` for Haiku (newer models get `effort: low`), about 8 s timeout, at most 1 retry.
  - Errors, timeouts and `stop_reason == "refusal"` all fall back to the template.
  - Cache answers in memory by a hash of the input JSON.
- **Tests:**
  - the validator rejects an invented number and a blocked word
  - `LLM_PROVIDER=none` returns the template
  - templates exist for all 4 cause ids in both languages
- **Later (M4):** `explain_summary(summary: DoctorSummary) -> Explanation` writes the "In short" paragraph of the Polish doctor summary.
