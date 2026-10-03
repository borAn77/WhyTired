import {
  BookOpen,
  Brain,
  Briefcase,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  Coffee,
  Dumbbell,
  GraduationCap,
  Heart,
  Minus,
  Smartphone,
  Volume2,
  Wine,
  type LucideIcon,
} from 'lucide-react'

import { addDays, daysBetween } from './dates'
import type { SessionState } from './session'
import type { CauseId, ISODate } from './types'

// Follow-up cards in the check-in, chosen by simple rules from the user's own answers.
// They stay in the browser: the rule engine never reads them, they only turn into tips.

export type Adherence = 'yes' | 'partly' | 'no'

export interface DayClues {
  mission?: Adherence // did you stick to the mission yesterday?
  sleep?: string[] // what kept you from sleeping well
  stress?: string[] // what is behind the stress
}

export interface ClueOption {
  id: string
  label: string
  icon: LucideIcon
  tip?: string // safe, everyday tip; no medical advice
}

export const SLEEP_CLUES: ClueOption[] = [
  { id: 'screens', label: 'Screens in bed', icon: Smartphone, tip: 'Put the phone away 30 minutes before sleep.' },
  { id: 'caffeine', label: 'Coffee after 2 pm', icon: Coffee, tip: 'No coffee or energy drinks after 2 pm for a few days.' },
  { id: 'studying', label: 'Studying late', icon: BookOpen, tip: 'Pick a fixed time to stop studying in the evening.' },
  { id: 'worries', label: 'Worries', icon: Brain, tip: "Write tomorrow's to-do list before bed." },
  { id: 'alcohol', label: 'Alcohol in the evening', icon: Wine, tip: 'Try a few alcohol-free evenings this week.' },
  { id: 'noise', label: 'Noise or light', icon: Volume2, tip: 'Try earplugs, a sleep mask or a cooler room.' },
  { id: 'nothing', label: 'Nothing special', icon: Minus },
]

export const STRESS_CLUES: ClueOption[] = [
  { id: 'exams', label: 'Exams or studying', icon: GraduationCap, tip: 'Study in 50-minute blocks with a short walk in between.' },
  { id: 'work', label: 'Work', icon: Briefcase, tip: 'Plan one evening this week with no work at all.' },
  { id: 'personal', label: 'Personal life', icon: Heart, tip: 'Talk it through with someone you trust.' },
  { id: 'training', label: 'Training pressure', icon: Dumbbell, tip: 'Swap one hard session for an easy one this week.' },
  { id: 'unsure', label: 'Not sure', icon: CircleHelp },
]

export const ADHERENCE: { id: Adherence; label: string; icon: LucideIcon }[] = [
  { id: 'yes', label: 'Yes, fully', icon: CircleCheck },
  { id: 'partly', label: 'Partly', icon: CircleDashed },
  { id: 'no', label: 'No', icon: CircleX },
]

const MISSION_QUESTION: Record<CauseId, string> = {
  load_spike: 'Did you keep yesterday’s training light?',
  rhr_elevated: 'Did you keep yesterday’s training light?',
  sleep_debt: 'Did you keep your sleep window last night?',
  stress_spike: 'Did you do your wind-down yesterday?',
}

/** The mission card is asked the morning after each mission day. */
export function missionQuestion(session: SessionState): string | null {
  const experiment = session.experiment
  if (!experiment) return null
  const yesterdayDay = daysBetween(experiment.start, session.today)
  return yesterdayDay >= 1 && yesterdayDay <= experiment.days ? MISSION_QUESTION[experiment.cause_id] : null
}

/** Answer about mission day `n` (1-based) is given the next morning. */
export function adherenceFor(session: SessionState, start: ISODate, day: number): Adherence | undefined {
  return session.clues[addDays(start, day)]?.mission
}

export const needsSleepClue = (hours: number, quality: number | undefined) => hours <= 6 || (quality ?? 5) <= 2
export const needsStressClue = (stress: number | undefined) => (stress ?? 1) >= 4

const PATTERN_DAYS = 7
const PATTERN_MIN = 2

/** The clue the user named most often in the last 7 days, if it came up at least twice. */
export function cluePattern(session: SessionState) {
  const counts = new Map<ClueOption, number>()
  for (let i = 0; i < PATTERN_DAYS; i++) {
    const day = session.clues[addDays(session.today, -i)]
    const picked = [
      ...(day?.sleep ?? []).map((id) => SLEEP_CLUES.find((c) => c.id === id)),
      ...(day?.stress ?? []).map((id) => STRESS_CLUES.find((c) => c.id === id)),
    ]
    for (const clue of picked) if (clue?.tip) counts.set(clue, (counts.get(clue) ?? 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return best && best[1] >= PATTERN_MIN ? { clue: best[0], count: best[1] } : null
}
