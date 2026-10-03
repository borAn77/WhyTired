import { BatteryLow, CircleCheck, Flame, PartyPopper, Search, Sparkles } from 'lucide-react'

import { MascotBadge } from '@/components/case/CaseParts'
import { XP, checkinStreak, levelFor, totalXp } from '@/lib/progress'
import type { SessionState } from '@/lib/session'
import { cn } from '@/lib/utils'

export function ProgressCard({ session }: { session: SessionState }) {
  const level = levelFor(totalXp(session))
  const streak = checkinStreak(session)
  const percent = Math.round((level.inLevel / level.perLevel) * 100)
  return (
    <section aria-label="Your progress" className="flex items-center gap-3.5 rounded-3xl bg-navy-900 p-4 text-white shadow-lg">
      <MascotBadge className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-coral-500">Level {level.number}</span>
          <span className="shrink-0 text-sm tabular-nums text-navy-100">
            {level.inLevel}/{level.perLevel} XP
          </span>
        </p>
        <p className="text-lg font-semibold leading-tight">{level.name}</p>
        <div
          role="progressbar"
          aria-label={`XP towards level ${level.number + 1}`}
          aria-valuemin={0}
          aria-valuemax={level.perLevel}
          aria-valuenow={level.inLevel}
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15"
        >
          <div className="h-full rounded-full bg-coral-500 transition-[width] duration-700" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-sm text-navy-100">
          {level.next ? `${level.perLevel - level.inLevel} XP to ${level.next}` : 'Top level reached'}
        </p>
      </div>
      <div className="flex w-14 shrink-0 flex-col items-center border-l border-white/15 pl-3">
        <Flame aria-hidden className={cn('size-6', streak > 0 ? 'text-coral-500' : 'text-navy-300')} />
        <span className="text-xl font-bold tabular-nums leading-tight">{streak}</span>
        <span className="text-center text-sm leading-tight text-navy-100">day streak</span>
      </div>
    </section>
  )
}

export function XpPill({ amount }: { amount: number }) {
  return (
    <span className="ml-auto rounded-full bg-navy-900/10 px-2.5 py-0.5 text-sm font-bold tabular-nums">+{amount} XP</span>
  )
}

export function XpToast({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="flex animate-in items-center gap-2 rounded-2xl bg-coral-50 px-4 py-3 font-semibold ring-1 ring-coral-500/40 fade-in zoom-in-95 duration-300 motion-reduce:animate-none"
    >
      <Sparkles aria-hidden className="size-5 shrink-0 text-coral-700" />
      {text}
    </p>
  )
}

const RADAR_SIZE = 3

/** How close the user is to detective mode: low-energy mornings in a row, out of 3. */
export function DetectiveRadar({ lowDays, triggered }: { lowDays: number; triggered: boolean }) {
  const filled = triggered ? RADAR_SIZE : Math.min(lowDays, RADAR_SIZE)
  const title = triggered ? 'Case ready to open' : filled === 0 ? 'All quiet' : `${filled} of ${RADAR_SIZE} low mornings`
  const text = triggered
    ? '3 low-energy mornings in a row. Time to find out why.'
    : filled === 0
      ? 'The detective opens a case after 3 low-energy mornings in a row.'
      : `${RADAR_SIZE - filled} more in a row and the detective opens a case.`
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

export function DayComplete({ levelUp }: { levelUp: string | null }) {
  return (
    <section
      role="status"
      className="animate-in rounded-3xl bg-green-50 p-5 text-center ring-1 ring-green-700/30 fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
    >
      {levelUp ? (
        <PartyPopper aria-hidden className="mx-auto size-10 text-green-700" />
      ) : (
        <CircleCheck aria-hidden className="mx-auto size-10 text-green-700" />
      )}
      <h2 className="mt-2 text-xl font-semibold">{levelUp ? `Level up: ${levelUp}!` : 'Day complete'}</h2>
      <p className="text-muted-foreground">+{XP.done} XP. See you at tomorrow's check-in.</p>
    </section>
  )
}
