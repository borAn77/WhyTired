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

## D7: Everything on Render: static site (frontend) + web service (API)
- **What:** The React app is a free Render static site, served from a CDN. It calls the API service directly through `VITE_API_URL`, and the API allows cross-origin requests (CORS). The API has no cookies and no logins. Both services deploy from `main` (`render.yaml`).
- **Why:**
  - We started with Vercel for the frontend and a `/api` rewrite to Render. Vercel's free plan blocked deploys of a teammate's commits, so the team moved everything to Render: one dashboard for both services.
  - A static site has no cold start. The page appears instantly while the free API wakes up (about 50 s), and the app shows a loading state in the meantime.
- **Alternatives:**
  - Serving the built frontend from FastAPI: one service, but the page itself would wait for the cold start.
  - Vercel with a rewrite: dropped, see above.
  - Fallback if hosting fails: local demo + screen recording.

## D8: Injury-risk rule applied to session duration
- **What:** A planned session longer than 110% of the longest session in the last 30 days triggers a warning.
- **Why:** Frandsen et al. (BJSM 2025, Garmin-RUNSAFE) found that single-session spikes above the longest run of the last 30 days were linked to running injuries. They measured running **distance**. We apply the same rule to **duration**, because our users also do gym and team sports, where distance does not exist. The code comment says so explicitly.
- **Alternatives:** acute:chronic workload ratio (the same study did not find it useful for single sessions).

## D9: LLM call setup
- **What:**
  - Anthropic API through the official SDK. The model is `claude-haiku-4-5`, chosen by Berken as the fastest Claude model, well inside the time limit; it can be overridden with `ANTHROPIC_MODEL`. `effort: low` is sent only to models that support it.
  - Each attempt has 8 s, there is one retry, and the whole call has a hard limit of 10 s. Answers are cached in memory by a hash of the input.
  - `LLM_PROVIDER` selects the provider:
    - `anthropic` (default)
    - `ollama` (a local model for offline work)
    - `none` (templates only)
  - Every number in the generated text must exist in the input, and diagnosis, medication and lab-test terms are blocked.
  - Any failure falls back to the template text and logs the reason: an error (including an account without credits), a timeout, a refusal, or a failed validation.
- **Why:** The demo never hangs or shows invented numbers, and it works without a key or credits.
- **Alternatives:** no LLM (less natural language) and an LLM without validation (unsafe).

## D10: The artifact jump rule also checks your recent normal
- **What:** A resting-HR reading is excluded as an artifact only if all three hold:
  - it is more than 25 bpm away from the last valid reading
  - it is more than 25 bpm away from the median of the last 7 valid readings
  - the check-in and the previous day's training did not change much
- **Why:** With only the brief's "vs. the previous day" rule, a real HR rise after a very hard day would be accepted, and then the next normal morning would look like a 25+ bpm "jump" and be thrown away. That error cascaded for days in our tests. The median check makes a return to normal always count as valid.
- **Alternatives:** comparing with the previous raw value (it accepts the artifact as the new reference point).
- **Update (found by Berken):** The brief also lets a change in activity explain a jump. In our first version, a hard training day therefore "explained" even a +35 bpm night, so the artifact stayed in the data. Training raises the next morning's resting HR by a few bpm, never 25+, so training alone no longer explains a flagged jump. A check-in change (feeling much worse, e.g. getting ill) still does, because illness can really raise resting HR and we must not hide that.

## D11: "Your usual week" is the median of the previous 4 weeks
- **What:** Training-load rules compare the last 7 days with the median of the 4 weekly loads before them, not the mean.
- **Why:** With the mean, one holiday week made a normal week look like a 1.3× spike, and the first week of a spike pulled "usual" up. The median is robust to one unusual week. Berken's first engine already used medians for baselines, for the same reason.
- **Alternatives:** the mean (distorted by single weeks), and acute:chronic ratios (more complex, and not linked to single-session injury risk in Frandsen 2025).

## D12: Daily coach = red flags + two safety rules
- **What:** The coach counts red flags this morning, ordered with how you feel first:
  - energy ≤ 2
  - resting HR ≥ usual + 5 bpm
  - sleep ≥ 1.5 h below usual
  - soreness ≥ 4
  - stress ≥ 4
  - last 7 days' load ≥ 1.3× the usual week

  0 flags → hard, 1–2 → easy, 3+ → rest. At most 3 reasons are shown.

  Safety rules from Berken's first coach:
  - "I feel ill" always means rest.
  - Never two hard days in a row (a session at effort ≥ 7/10 yesterday means easy at most).

  During a load-cut experiment, training is capped at easy and the old load spike is no longer counted, because the user is already acting on it.
- **Why:** Every outcome is explainable in one sentence and testable. The check-in comes first because subjective measures react most sensitively to training strain (Saw et al., 2016).
- **Alternatives:** readiness scores mixing all signals into one number (harder to explain), and multi-day plan rewriting (out of scope: today only).

## D13: Motivation layer and follow-up cards stay in the browser
- **What:**
  - XP, levels, the check-in streak and "today's advice done" are counted in the browser session only. XP rewards the habit (check-in +10, advice done +20, accepting a mission +50), never more training: a rest day earns the same as a hard day.
  - Every new day asks for a check-in again. A day counts as checked in only when the user answered in the app, even though the synthetic data has check-ins for almost every day.
  - Follow-up cards are added to the check-in by simple rules (`frontend/src/lib/clues.ts`): a mission check while an experiment runs ("Did you keep yesterday's training light?"), a "what got in the way of your sleep?" card after ≤ 6 h or a bad night, and a "what's behind the stress?" card when stress is 4 or 5. A clue named twice in 7 days shows one everyday tip on the Today screen. Mission answers show on the 7-day tracker.
- **Why:** The rule engine and the shared `models.py` contract stay unchanged, so all numbers and findings still come from the engine alone. The follow-up cards are rule-based, not LLM-generated, so every question can be explained in one sentence. The tips are everyday habits (screens, caffeine timing, evening alcohol, study breaks), never medical advice. Evening alcohol is a sleep clue because it is common in our age group and disturbs sleep and next-morning resting heart rate. Smoking is not asked: it does not change from day to day, so it cannot explain a recent drop in energy, and asking it would add a sensitive question for little value.
- **Alternatives:** sending the extra answers to the engine (a contract change for both of us, too late before the feature freeze) and LLM-generated questions (harder to explain, and the brief limits the LLM to explaining computed findings).
