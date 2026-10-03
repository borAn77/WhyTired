# Architecture decisions

One short entry per decision: what, why, alternatives considered.

## D1: Stateless backend, session kept in the browser
- **What:** The browser keeps the demo session in localStorage: persona, simulated "today", scenario, data level, logged check-ins and the active experiment. It sends that context with every API call. The backend has no database and no auth.
- **Why:**
  - The brief rules out a DB.
  - Many judges may open the same demo link at once, and a stateless API cannot mix up their sessions.
  - It survives restarts and cold starts on the free hosting tier.
  - Every endpoint is a pure function of its input, which makes it easy to test and to explain.
- **Alternatives:** in-memory server sessions (lost on restart, shared between visitors) and SQLite (more code, no demo value).

## D2: Deterministic synthetic data, committed as JSON
- **What:** A seeded generator (`backend/scripts/generate_personas.py`) writes 90 days of history plus 14 future days per outcome branch (`improved` / `not_improved`) for two personas. The JSON files are committed. Time travel only moves "today" forward into the chosen branch.
- **Why:**
  - The demo looks identical every run.
  - Tests can assert on the story, e.g. "Kasia's top cause is the load spike".
  - No real patient data is involved.
- **Alternatives:** generating data at request time (non-deterministic) and simulating the future from the experiment (much harder to explain).

## D3: Data level is a request parameter
- **What:** Before the rules run, `store.restrict_to_level()` removes the fields that the chosen level does not have:
  - Basic: check-ins + logged sessions
  - Medium: + phone steps + manual pulse
  - Full: + smartwatch
- **Why:** The rule engine never has to branch on "has a watch". No-watch mode works for any persona, and the effect of missing data shows up in the confidence.
- **Alternatives:** separate rule sets per level (duplicated logic).

## D4: Rules in code, the LLM only explains
- **What:** All numbers, causes and confidence levels come from small pure functions in `backend/app/engine/`. The LLM receives only the computed findings, with no raw time series and no identifiers, and writes plain-language text.
- **Why:** The results are reproducible, testable and defensible, and the team can explain every number.
- **Alternatives:** asking the LLM to analyse raw data (not explainable, may invent numbers).

## D5: Confidence is a points score with a cap per data level
- **What:** A cause gets +1 if it fires, +1 if the signal is strong, +1 if the user's own history supports it, and +1 if objective data (resting HR/HRV) corroborates it. It loses 1 if fewer than 70% of days have data. A score of ≥4 is high, 2–3 is medium, and ≤1 is low. The Basic level is capped at medium.
- **Why:** Simple enough to explain in one sentence, and it makes "less data → less certainty" visible.
- **Alternatives:** a statistical model (not explainable in a 24 h build).

## D6: The share link encodes the request, with no database
- **What:** The doctor-summary share link is `/s/<token>`, where the token is the base64url-encoded request context. Opening it recomputes the same summary, read-only. The QR code encodes the same link.
- **Why:** It is a real, working link with no storage, and opening it again later gives the same result.
- **Alternatives:** storing summaries server-side (needs a DB) and a mock link (less convincing).

## D7: Vercel frontend + Render API, joined by a rewrite
- **What:** Vercel serves the React app and rewrites `/api/*` to the Render service (`frontend/vercel.json`). Render runs FastAPI from `render.yaml`.
- **Why:** One public URL, no CORS configuration, and free tiers. The skeleton was deployed in M0 so deployment does not become a last-minute blocker.
- **Alternatives:**
  - One Docker service (slower to iterate).
  - Serverless Python on Vercel (timeouts on LLM calls).
  - Fallback if hosting fails: local demo + screen recording.

## D8: Injury-risk rule applied to session duration
- **What:** A planned session longer than 110% of the longest session in the last 30 days triggers a warning.
- **Why:** Frandsen et al. (BJSM 2025, Garmin-RUNSAFE) found that single-session spikes above the longest run of the last 30 days were linked to running injuries. They measured running **distance**. We apply the same rule to **duration**, because our users also do gym and team sports, where distance does not exist. The code comment says so explicitly.
- **Alternatives:** acute:chronic workload ratio (the same study did not find it useful for single sessions).

## D9: LLM call setup
- **What:**
  - Anthropic API, model `claude-opus-5` (overridable via `ANTHROPIC_MODEL`), `effort: low`, 8 s timeout.
  - Answers are cached in memory by a hash of the input.
  - `LLM_PROVIDER=none` uses templates only.
  - Every number in the generated text must exist in the input, and diagnosis, medication and lab-test terms are blocked.
  - Any failure falls back to template text: an error, a timeout, a refusal, or a failed validation.
- **Why:** The demo never hangs or shows invented numbers, and it works without a key.
- **Alternatives:** no LLM (less natural language) and LLM without validation (unsafe).

## D10: The artifact jump rule also checks your recent normal
- **What:** A resting-HR reading is excluded as an artifact only if all three hold:
  - it is more than 25 bpm away from the last valid reading
  - it is more than 25 bpm away from the median of the last 7 valid readings
  - the check-in and the previous day's training did not change much
- **Why:** With only the brief's "vs. the previous day" rule, a real HR rise after a very hard day would be accepted, and then the next normal morning would look like a 25+ bpm "jump" and be thrown away. That error cascaded for days in our tests. The median check makes a return to normal always count as valid.
- **Alternatives:** comparing with the previous raw value (it accepts the artifact as the new reference point).
