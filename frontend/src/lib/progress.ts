import { addDays } from './dates'
import type { SessionState } from './session'

// Motivation layer, kept in the browser only: the rule engine never sees XP or streaks.
// XP rewards the habit (checking in, following the advice, trying the experiment), never more
// training, and a rest day earns exactly as much as a hard day.
export const XP = { checkin: 10, done: 20, mission: 50 } as const

const LEVELS = ['Rookie', 'Sleuth', 'Detective', 'Inspector', 'Chief inspector']
const XP_PER_LEVEL = 100

export function totalXp(session: SessionState): number {
  return (
    Object.keys(session.checkins).length * XP.checkin +
    Object.keys(session.done).length * XP.done +
    session.missions.length * XP.mission
  )
}

export function levelFor(xp: number) {
  const index = Math.min(Math.floor(xp / XP_PER_LEVEL), LEVELS.length - 1)
  const maxed = index === LEVELS.length - 1
  return {
    number: index + 1,
    name: LEVELS[index],
    next: maxed ? null : LEVELS[index + 1],
    inLevel: maxed ? XP_PER_LEVEL : xp - index * XP_PER_LEVEL,
    perLevel: XP_PER_LEVEL,
  }
}

/** Check-ins on consecutive days up to today. Today not checked in yet doesn't break it. */
export function checkinStreak(session: SessionState): number {
  let day = session.checkins[session.today] ? session.today : addDays(session.today, -1)
  let streak = 0
  while (session.checkins[day]) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}
