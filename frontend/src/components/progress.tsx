import { BatteryLow, CircleCheck, Flame, Lightbulb, Search } from 'lucide-react'

import type { ClueOption } from '@/lib/clues'
import { checkinStreak } from '@/lib/progress'
import type { SessionState } from '@/lib/session'
import { cn } from '@/lib/utils'

/** The only reward in the app: mornings checked in on in a row. Hidden until the first one. */
export function StreakChip({ session }: { session: SessionState }) {
  const streak = checkinStreak(session)
  if (streak === 0) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-coral-50 px-3 py-1 text-sm font-semibold ring-1 ring-coral-500/40">
      <Flame aria-hidden className="size-4 text-coral-700" />
      {streak}-day streak
    </span>
  )
}

const RADAR_SIZE = 3

/** How close the user is to detective mode: low-energy mornings in a row, out of 3. */
export function DetectiveRadar({ lowDays, triggered }: { lowDays: number; triggered: boolean }) {
  const filled = triggered ? RADAR_SIZE : Math.min(lowDays, RADAR_SIZE)
  const title = triggered ? 'Case ready to open' : filled === 0 ? 'All quiet' : `${filled} of ${RADAR_SIZE} low mornings`
  const text = triggered
    ? '3 low-energy mornings in a row.'
    : filled === 0
      ? 'A case opens after 3 low-energy mornings in a row.'
      : `${RADAR_SIZE - filled} more in a row and a case opens.`
  return (
    <section
      aria-label="Detective radar"
      className={cn(
        'rounded-3xl p-5',
        triggered ? 'border-2 border-coral-500 bg-coral-50' : 'bg-card ring-1 ring-border',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em]',
            triggered ? 'text-coral-700' : 'text-navy-700',
          )}
        >
          <Search aria-hidden className="size-4" />
          Detective radar
        </p>
        <span aria-hidden className="flex gap-1.5">
          {Array.from({ length: RADAR_SIZE }, (_, i) => (
            <span
              key={i}
              className={cn(
                'grid size-8 place-items-center rounded-full',
                i < filled ? 'bg-coral-500 text-navy-900' : 'bg-navy-50 text-navy-300',
              )}
            >
              <BatteryLow className="size-4" />
            </span>
          ))}
        </span>
      </div>
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground">{text}</p>
    </section>
  )
}

export function DayComplete() {
  return (
    <section
      role="status"
      className="animate-in rounded-3xl bg-green-50 p-5 text-center ring-1 ring-green-700/30 fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
    >
      <CircleCheck aria-hidden className="mx-auto size-10 text-green-700" />
      <h2 className="mt-2 text-xl font-semibold">Day complete</h2>
      <p className="text-muted-foreground">See you at tomorrow's check-in.</p>
    </section>
  )
}

/** A clue the user named on several mornings this week, with one safe tip to try. */
export function CluePattern({ clue, count }: { clue: ClueOption; count: number }) {
  return (
    <section aria-label="Clue spotted" className="rounded-3xl bg-card p-5 ring-1 ring-border">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-coral-700">
        <Lightbulb aria-hidden className="size-4" />
        Clue spotted
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-navy-900 text-coral-500">
          <clue.icon aria-hidden className="size-5" />
        </span>
        <h2 className="text-lg font-semibold leading-snug">
          {clue.label}: {count} times this week
        </h2>
      </div>
      <p className="mt-3 rounded-2xl bg-coral-50 p-3.5">
        <span className="font-semibold">Try this: </span>
        {clue.tip}
      </p>
    </section>
  )
}
