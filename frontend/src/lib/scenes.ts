import { observationsFor, type DayClues } from './clues'
import { DEMO_DAY } from './dates'
import { PERSONAS } from './profile'
import { DEFAULT_SESSION, toCtx, type SessionState } from './session'
import { encodeShare } from './share'
import type { CheckIn, ISODate } from './types'

// The presenter's demo script: Kasia (watch) carries the first half, Tomek (no watch) the second,
// so every screen is shown once. Each scene is a complete session state plus a screen, so any
// scene can be opened directly (→ / ← keys, a clicker, or ?scene=N) and always looks the same.

export interface Scene {
  title: string
  headline: string // the guided tour's title for this step (what the audience reads)
  caption: string // the guided tour's one sentence
  say: string // what the presenter says
  tap?: string // what to tap live, if anything
  seconds: number // pace target
  bonus?: boolean // not part of the timed run (Q&A)
  state: SessionState
  route: string
  scrollTo?: string // text to scroll the phone to
}

const session = (patch: Partial<SessionState>): SessionState => ({
  ...DEFAULT_SESSION,
  onboarded: true,
  lang: 'en',
  ...patch,
})

// Kasia's last four mornings, copied from her persona data (backend/data/kasia.json), so the
// streak shows without changing anything the rule engine sees.
const KASIA_PAST: Record<ISODate, CheckIn> = {
  '2026-09-30': { energy: 2, sleep_hours: 6.5, sleep_quality: 3, stress: 3, soreness: 4, ill: false },
  '2026-10-01': { energy: 2, sleep_hours: 6, sleep_quality: 3, stress: 2, soreness: 3, ill: false },
  '2026-10-02': { energy: 1, sleep_hours: 6, sleep_quality: 3, stress: 3, soreness: 3, ill: false },
  '2026-10-03': { energy: 2, sleep_hours: 6, sleep_quality: 3, stress: 2, soreness: 4, ill: false },
}
// The answers the presenter taps in scene 1 (same as the persona data for the demo day).
const KASIA_TODAY: CheckIn = { energy: 2, sleep_hours: 6, sleep_quality: 3, stress: 3, soreness: 3, ill: false }
const KASIA_CLUES_PAST: Record<ISODate, DayClues> = {
  '2026-10-02': { sleep: ['caffeine'] },
  '2026-10-03': { sleep: ['screens'] },
}

const kasia = {
  personaId: 'kasia',
  dataLevel: 'full' as const,
  ...PERSONAS.kasia,
}
const kasiaBefore = session({ ...kasia, checkins: KASIA_PAST, clues: KASIA_CLUES_PAST })
const kasiaAfter = session({
  ...kasia,
  checkins: { ...KASIA_PAST, [DEMO_DAY]: KASIA_TODAY },
  clues: { ...KASIA_CLUES_PAST, [DEMO_DAY]: { sleep: ['caffeine'] } },
})

// Tomek's exam weeks: what he named on the follow-up cards (short nights, high stress).
const TOMEK_CLUES_PAST: Record<ISODate, DayClues> = {
  '2026-10-01': { sleep: ['studying'], stress: ['exams'] },
  '2026-10-02': { sleep: ['studying', 'screens'], stress: ['exams'] },
  '2026-10-03': { sleep: ['worries'], stress: ['exams'] },
  '2026-10-04': { sleep: ['studying', 'worries'], stress: ['exams'] },
}
// Mission checks, each given the morning after a mission day.
const MISSION_WEEK: Record<ISODate, DayClues> = {
  '2026-10-06': { mission: 'yes' },
  '2026-10-07': { mission: 'yes' },
  '2026-10-08': { mission: 'partly' },
  '2026-10-09': { mission: 'yes' },
  '2026-10-10': { mission: 'yes' },
  '2026-10-11': { mission: 'yes' },
  '2026-10-12': { mission: 'yes' },
}
const VERDICT_DAY = '2026-10-12'

const tomek = {
  personaId: 'tomek',
  dataLevel: 'basic' as const,
  ...PERSONAS.tomek,
}
const tomekDetective = session({ ...tomek, clues: TOMEK_CLUES_PAST })
const tomekMission = session({
  ...tomek,
  clues: TOMEK_CLUES_PAST,
  experiment: { cause_id: 'sleep_debt', start: '2026-10-05', days: 7 },
})
const tomekNextMorning = session({ ...tomekMission, today: '2026-10-06' })
const tomekVerdict = session({
  ...tomekMission,
  today: VERDICT_DAY,
  clues: { ...TOMEK_CLUES_PAST, ...MISSION_WEEK },
})
const doctorPage = `/s/${encodeShare(toCtx(tomekVerdict, { lang: 'pl' }), observationsFor(tomekVerdict))}`

const kasiaClosed = session({
  ...kasia,
  scenario: 'improved',
  today: VERDICT_DAY,
  checkins: { ...KASIA_PAST, [DEMO_DAY]: KASIA_TODAY },
  clues: { ...KASIA_CLUES_PAST, ...MISSION_WEEK },
  experiment: { cause_id: 'load_spike', start: '2026-10-05', days: 7 },
})

export const SCENES: Scene[] = [
  {
    title: 'Kasia: morning check-in',
    headline: 'A 15-second morning check-in',
    caption: 'Kasia, 23, a runner with a watch, answers 5 quick questions each morning.',
    say: 'Kasia, 23, runner, has a watch. Every morning: a 15-second check-in. A short night, so the app asks why.',
    tap: 'Low → That’s right → OK → Coffee after 2 pm → Next → Somewhat → Somewhat → Finish',
    seconds: 20,
    state: kasiaBefore,
    route: '/check-in',
  },
  {
    title: 'Kasia: today’s advice',
    headline: 'One clear answer for today',
    caption: 'Rest today. The reasons come from her own numbers.',
    say: 'One clear answer: rest today, with the reasons. Small rewards keep the habit going.',
    seconds: 8,
    state: kasiaAfter,
    route: '/',
  },
  {
    title: 'Kasia: the app noticed',
    headline: 'It notices patterns',
    caption: 'Late coffee, twice this week. After 3 low mornings, the detective opens a case.',
    say: 'It noticed a pattern: coffee after 2 pm, twice this week, with one small tip. And a third low morning in a row: the detective opens a case.',
    seconds: 10,
    state: kasiaAfter,
    route: '/',
    scrollTo: 'Clue spotted',
  },
  {
    title: 'Detective: the case file',
    headline: 'The detective ranks the causes',
    caption: 'All from her own data. Prime suspect: training load, 2,700 against her usual 1,050.',
    say: 'The detective ranks suspects from her own data. Prime suspect: her training load, far above her usual week.',
    seconds: 12,
    state: kasiaAfter,
    route: '/detective',
  },
  {
    title: 'Detective: alibi check',
    headline: 'Checked against her own past',
    caption: 'In her holiday week she trained less: more energy, resting heart rate 6 bpm lower.',
    say: 'It checks her own past: in her holiday week she trained less, and her resting heart rate was lower.',
    seconds: 10,
    state: kasiaAfter,
    route: '/detective',
    scrollTo: 'Alibi check',
  },
  {
    title: 'Detective: fake clue',
    headline: 'Bad sensor data is left out',
    caption: 'One night of impossible watch readings is thrown out, with the reason shown.',
    say: 'One night a loose strap gave an impossible heart-rate jump. It is thrown out, with the reason shown.',
    seconds: 10,
    state: kasiaAfter,
    route: '/detective',
    scrollTo: 'sensor glitches',
  },
  {
    title: 'Tomek: no watch',
    headline: 'No watch? It still works',
    caption: 'Tomek, 21, uses check-ins only. It finds his exam-time sleep debt, at medium confidence.',
    say: 'Tomek, 21, gym, no watch. Same detective on check-ins only: it finds his exam-time sleep debt and honestly caps confidence at medium.',
    seconds: 15,
    state: tomekDetective,
    route: '/detective',
  },
  {
    title: 'Tomek: the mission',
    headline: 'One safe change for 7 days',
    caption: 'Not a diagnosis. Tomek tries a fixed sleep window for a week.',
    say: 'Not a diagnosis: one safe change for 7 days. A fixed sleep window.',
    seconds: 8,
    state: tomekMission,
    route: '/experiment',
  },
  {
    title: 'Next morning: mission check',
    headline: 'One tap each morning',
    caption: 'Did you stick to it? The check-in starts with this question.',
    say: 'Every morning starts with one tap: did you stick to it?',
    tap: 'Yes, fully',
    seconds: 10,
    state: tomekNextMorning,
    route: '/check-in',
  },
  {
    title: 'A week later: the verdict',
    headline: 'A week later: the verdict',
    caption: 'He stuck to it and is still tired. Next step: the family doctor.',
    say: 'He stuck to it almost every day and is still tired. Verdict: time for the family doctor.',
    seconds: 12,
    state: tomekVerdict,
    route: '/experiment',
  },
  {
    title: 'Doctor summary',
    headline: 'Ready for the doctor',
    caption: 'One page in Polish for the family doctor, to print or share by QR code.',
    say: 'The app prepares one page for the family doctor, in Polish, to print or share as a QR code.',
    tap: 'Show link and QR code',
    seconds: 8,
    state: tomekVerdict,
    route: '/summary',
  },
  {
    title: 'What the doctor sees',
    headline: 'What the doctor sees',
    caption: 'Timeline, trends, what he tried and questions to ask. No diagnoses.',
    say: 'Timeline, trends, what he tried, what he noticed himself, and questions to ask. No diagnoses.',
    seconds: 15,
    state: tomekVerdict,
    route: doctorPage,
  },
  {
    title: 'Bonus: when it works',
    headline: 'And when the change works',
    caption: 'Kasia’s energy came back, so the case is closed. She keeps the change.',
    say: 'If the change works: case closed, keep the change. For questions.',
    seconds: 0,
    bonus: true,
    state: kasiaClosed,
    route: '/experiment',
  },
]
