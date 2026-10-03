import { useLocation } from 'react-router-dom'

import { daysBetween } from '@/lib/dates'
import { useSession } from '@/lib/session'

import type { Mood } from './LogoCharacter'
import type { PersonaKey } from './story'

// Read-only view of the session: which screen, which persona, and whether a 7-day
// experiment has finished. Never writes to the session or calls the API.
export function useStageState() {
  const { session } = useSession()
  // The router matches routes ignoring case and a trailing slash ("/Onboarding/" shows the
  // onboarding screen), so read the path the same way or the story falls back to "Today".
  const pathname = useLocation().pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const persona: PersonaKey = session.personaId === 'tomek' ? 'tomek' : 'kasia'
  const exp = session.experiment
  const finished = exp !== null && daysBetween(exp.start, session.today) >= exp.days
  const mood: Mood = finished && session.scenario === 'improved' ? 'energised' : 'tired'
  return { pathname, persona, finished, scenario: session.scenario, mood }
}
