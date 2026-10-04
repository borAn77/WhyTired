import { createContext, useContext } from 'react'

import type { DayClues } from './clues'
import { DEMO_DAY } from './dates'
import type { CheckIn, Ctx, DataLevel, Experiment, ISODate, Lang, Recommendation, Scenario } from './types'

// The backend is stateless (docs/DECISIONS.md, D1): the browser keeps the session and sends
// it with every request. Stored in localStorage so a page reload keeps the demo where it was.

export interface SessionState {
  personaId: string
  today: ISODate // moved by the demo "time travel" controls
  scenario: Scenario // which future branch the synthetic data follows
  dataLevel: DataLevel
  checkins: Record<ISODate, CheckIn> // check-ins logged in the app override synthetic ones
  experiment: Experiment | null
  onboarded: boolean
  goal: string | null // onboarding answers (shown in the app, not used by the rules)
  sports: string[]
  lang: Lang
  done: Record<ISODate, Recommendation> // days the user marked today's advice as done
  clues: Record<ISODate, DayClues> // answers to the follow-up cards (tips only, never sent to the API)
  closed: ISODate[] // days a case was closed because the experiment worked
}

export const DEFAULT_SESSION: SessionState = {
  personaId: 'kasia',
  today: DEMO_DAY,
  scenario: 'not_improved',
  dataLevel: 'full',
  checkins: {},
  experiment: null,
  onboarded: false,
  goal: null,
  sports: [],
  lang: 'en',
  done: {},
  clues: {},
  closed: [],
}

export interface SessionApi {
  session: SessionState
  update: (patch: Partial<SessionState>) => void
  reset: () => void
}

export const SessionContext = createContext<SessionApi | null>(null)

export function useSession(): SessionApi {
  const api = useContext(SessionContext)
  if (!api) throw new Error('useSession must be used inside <SessionProvider>')
  return api
}

export function toCtx(session: SessionState, overrides: Partial<Ctx> = {}): Ctx {
  return {
    persona_id: session.personaId,
    today: session.today,
    scenario: session.scenario,
    data_level: session.dataLevel,
    checkins: session.checkins,
    experiment: session.experiment,
    lang: session.lang,
    ...overrides,
  }
}

const STORAGE_KEY = 'whytired.session.v1'

export function loadSession(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SESSION, ...(JSON.parse(raw) as Partial<SessionState>) }
  } catch {
    // storage blocked (private mode): fall back to a fresh session
  }
  return DEFAULT_SESSION
}

export function saveSession(session: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // storage blocked: the session just won't survive a reload
  }
}
