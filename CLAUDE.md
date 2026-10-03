# Project: WhyTired — HackYeah build

> The agreed implementation plan (folder ownership, data model, API, rule thresholds, timeline) is in
> `docs/PLAN.md`. Where it is more specific than this brief, `docs/PLAN.md` wins.

## Context
We are building WhyTired for HackYeah, "Sport & Healthcare" open task. The official brief asks for a solution that helps people take an informed, active role in their health, physical activity or wellbeing, for a specific user group with a concrete need. Judges want a clear user journey, practical value, accessibility, low effort for regular use, and an achievable next step for the user.

Time available: LESS THAN 24 HOURS in total, including slides and demo prep.
Deadline: **Sunday 4 Oct 2026, 10:00 CEST**. Feature freeze: **Sunday 06:00**. Submit by 09:00.

Team: 2 people.
- **Boran**: backend (FastAPI + rule engine), frontend, app integration, deploy.
- **Teammate**: synthetic data generator and the AI/LLM layer.

### Judging criteria and what they mean for this build
- Idea & Innovation (30%): the detective mode and the personal experiment loop are our innovation. They must be the clearest part of the demo.
- Relation to Category (20%): we cover activity/recovery patterns, adaptation to different circumstances (no-watch mode), and preparation for healthcare appointments.
- Practical Applicability / Usability (20%): low effort (15-second check-in), plain language, every screen ends with one achievable next step.
- Design (20%): the UI must look polished and consistent. Budget real time for design. Do not ship default-looking screens.
- Completeness & Implementation Value (10%): it must work end to end for the demo, but do not over-engineer the backend.

## Target user
Active students and young adults in Poland (roughly 18–30) who train regularly (running, gym, team sports) and feel persistently tired without knowing why. Some have a smartwatch, many do not. Long waits for specialists in Poland make it valuable to try safe self-adjustments first and arrive at the family doctor (POZ) well prepared.

## User journey (the demo follows this exactly)
1. **Onboarding (under 1 minute):** goal, sports, whether they have a smartwatch. This sets the data level.
2. **Every morning (15 seconds):** a 5-question check-in. The daily coach answers: hard training / easy training / rest, with one-line reasons.
3. **Low energy for 3+ days:** detective mode starts. It shows likely causes from the user's own data, with evidence and a confidence level, and excludes unreliable sensor data with a reason.
4. **Achievable next step:** the user starts a 7-day personal experiment (e.g. reduce training load by 40%, log resting HR each morning). The app tracks it.
5. **Result:** improved → keep the change, back to normal coaching. Not improved → the app prepares a one-page summary for the family doctor in Polish, which the user can print or share.

## Features
1. **Detective mode (P0, must be fully done)**
   - Candidate causes from rules: training load spike, accumulated sleep debt, stress spike, resting HR elevated vs. baseline.
   - Each candidate is checked against the user's own history. Example: "During your holiday week your resting HR dropped 6 bpm, which suggests training load is a likely factor."
   - Rank causes, show evidence and confidence (high / medium / low), and show which data level the finding is based on.
   - Propose one simple experiment, then evaluate it after 7 days: improved / not improved.

2. **Daily coach (P1, simple)**
   - Today only: hard / easy / rest, with reasons. No multi-day plan rewriting.
   - Inputs: resting HR vs. 7-day and 28-day baseline, sleep vs. personal average, check-in scores, session RPE load (duration in minutes × effort 1–10).
   - Injury-risk warning if a planned session is more than 10% longer than the longest session in the last 30 days.

3. **Doctor summary (P1)**
   - A printable HTML page in Polish (English toggle optional). "Print → Save as PDF" is enough.
   - Contains: complaint timeline, key trends with small charts, what was tried and the result, "Questions to ask your doctor".
   - Must NOT contain diagnoses or recommended lab tests. Short disclaimer at the bottom.
   - "Share" button: a read-only link or QR code to the summary, for a doctor, coach or family member. A mock link is fine for the demo.

4. **No-watch mode (P1)**
   - Three data levels, always shown on findings:
     - Basic: check-in + manually logged sessions (duration + RPE).
     - Medium: phone step count + manual pulse (guided 30-second timer; optional if time runs short).
     - Full: smartwatch data (resting HR, HRV, sleep).
   - Camera-based pulse measurement is out of scope.

5. **Stretch (only if everything above is done):** CSV import of the user's own data in a documented format, to show a real integration path.

## Sensor artifact rules
Flag a data point as unreliable and exclude it from evidence if:
- Resting HR changes more than 25 bpm vs. the previous day with no matching change in check-in or activity.
- Sleep data is missing for most of the night, or HR during sleep is above the user's daytime average.
- Values are physiologically implausible (resting HR < 30 or > 120).
Show excluded points in the UI with a short reason.

## AI / LLM rules
- All numbers and findings come from the rule engine in code. The LLM only explains them in plain language and writes summary text.
- Send the LLM a structured JSON of computed findings, never raw time series and never personal identifiers.
- The LLM must not invent numbers, diagnose, or recommend medication or lab tests. Enforce this in the system prompt and validate the output (every number in the text must exist in the input JSON; if validation fails, fall back to a template text).
- LLM provider configurable via environment variable. API keys in `.env`, never committed.

## Explainability and disclosure (required by HackYeah rules)
The team must be able to explain and defend every part of the code. Therefore:
- Prefer simple, readable code over clever abstractions. Small pure functions for every rule.
- Each rule function has a short comment explaining what it does and, where relevant, the research it is based on:
  - Single-session load spike (>10% of longest session in last 30 days): Garmin-RUNSAFE cohort, Frandsen et al., BJSM 2025.
  - Session RPE training load: Foster et al., 2001.
  - Subjective wellbeing check-ins as load indicators: Saw et al., BJSM 2016.
- Maintain `docs/DECISIONS.md`: one short entry per architectural decision (what, why, alternatives considered).
- Maintain `docs/DISCLOSURE.md`: every AI tool used during development, every external API/model, every library with its licence, the research sources above, and a statement that the synthetic data was generated by us. State that all code was written during HackYeah.
- `README.md`: what the project does, architecture diagram (Mermaid), how to run it, demo walkthrough.

## Demo data
No real patient data. Build a synthetic data generator:
- 90 days of data for two personas from the target group:
  - **Persona A — Kasia, 23, student, amateur runner, has a smartwatch.** Training load spikes in the last 2 weeks; energy drops for 5 days; an earlier holiday week with low load and visibly lower resting HR; one night with an obvious sensor artifact.
  - **Persona B — Tomek, 21, student, gym-goer, no smartwatch.** Check-ins and manual sessions only; sleep debt during an exam period.
- A "time travel" control in the demo UI: move the current day forward to show the experiment running and its result, including the "not improved" branch that leads to the doctor summary.

## Design requirements
- Mobile-first layout. On desktop, render the app inside a phone-sized frame for the demo.
- Define design tokens first: colors (deep navy primary, one accent: coral, matching our logo), type scale, spacing, radius. Use them everywhere.
- Use a component library to look polished quickly (Tailwind + shadcn/ui).
- Accessibility: WCAG AA contrast, minimum 16px body text, plain language with no medical jargon, never rely on color alone (use icons/labels for confidence levels).
- Every screen answers "what should I do?" with one primary action. Charts only where they support a finding.
- Include proper empty, loading and error states. Use the WhyTired logo on onboarding and in the header.

## Stack
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui, web only.
- Backend: FastAPI (Python). The rule engine lives here as pure, testable functions.
- Data: synthetic JSON files loaded in memory. No database, no auth.
- Deployment for the demo link: frontend on Vercel, backend on Render. If deployment becomes a blocker, a local demo plus a screen recording is the fallback.

## Time plan
See `docs/PLAN.md` for the timeline adjusted to the real deadline (milestones M0–M6).
**Feature freeze 4 hours before the deadline.** After that: design polish, bug fixes, 10-slide PDF, demo rehearsal.

## Working style
- After each milestone, make sure the app runs end to end, then commit with a clear message.
- If something takes more than 45 minutes longer than planned, stop and propose a simpler version.
- Ask before adding new dependencies or changing the stack.
- When you write non-obvious code, explain it briefly in the chat so the team understands it.

## Definition of done
1. Onboarding → check-in → daily coach recommendation with reasons, for Persona A.
2. Detective mode shows ranked causes with evidence and confidence, excludes the artifact night and says why.
3. Start the experiment, time-travel 7 days, see "not improved".
4. Polish doctor summary page opens, prints cleanly, has a share button.
5. Switch to Persona B (no watch): detective mode still works with lower confidence clearly shown.
6. Demo link works; README, DECISIONS.md and DISCLOSURE.md are complete.

## Submission checklist (Challenge Rocket)
- Project title: WhyTired
- Team name and members
- Project description
- Max 10-slide PDF presentation
- Optional but planned: screenshots, code repository, demo link
