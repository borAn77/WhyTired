import { addDays } from './dates'
import type { SessionState } from './session'

// Motivation layer, kept in the browser only: the rule engine never sees the streak.
// It counts the habit (checking in), never training, so a rest day keeps it going too.

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
