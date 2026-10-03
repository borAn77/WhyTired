import { Check, CircleCheck, CircleDashed, CircleX, Flag, MapPin, Stethoscope, Trophy, type LucideIcon } from 'lucide-react'

import { adherenceFor, type Adherence } from '@/lib/clues'
import { addDays, formatDay } from '@/lib/dates'
import { useSession } from '@/lib/session'
import type { Experiment, ExperimentResult } from '@/lib/types'
import { cn } from '@/lib/utils'

// The 7-day experiment as a winding road: one stop per day, the verdict at the end.
// The path is decoration (aria-hidden); the stops are an ordered list with full labels.

const STOP_X = [16, 52, 84, 52, 16, 52, 84, 52] // % from the left, zig-zag
const ROW = 88 // px between stops

const ADHERENCE: Record<Adherence, { label: string; icon: LucideIcon; node: string; text: string }> = {
  yes: { label: 'Stuck to it', icon: CircleCheck, node: 'bg-green-700 text-white', text: 'text-green-700' },
  partly: { label: 'Partly', icon: CircleDashed, node: 'bg-amber-50 text-amber-800 ring-2 ring-amber-800/40', text: 'text-amber-800' },
  no: { label: 'Skipped', icon: CircleX, node: 'bg-coral-50 text-coral-700 ring-2 ring-coral-500/50', text: 'text-coral-700' },
}

type Stop = { kind: 'day'; n: number; date: string } | { kind: 'verdict'; date: string }

export function MissionMap({ result, experiment }: { result: ExperimentResult; experiment: Experiment }) {
  const { session } = useSession()
  const finished = result.status !== 'running'
  const today = finished ? result.days_total + 1 : result.day // 1-based stop that is "today"
  const stops: Stop[] = [
    ...Array.from({ length: result.days_total }, (_, i) => ({ kind: 'day' as const, n: i + 1, date: addDays(experiment.start, i) })),
    { kind: 'verdict', date: addDays(experiment.start, result.days_total) },
  ]
  const points = stops.map((_, i) => ({ x: STOP_X[i % STOP_X.length], y: i * ROW + ROW / 2 }))
  const height = stops.length * ROW
  const reached = Math.max(0, Math.min(today, stops.length) - 1) // index of the last stop on the coral path

  const path = (upTo: number) =>
    points
      .slice(0, upTo + 1)
      .map((p, i, all) => {
        if (i === 0) return `M ${p.x} ${p.y}`
        const prev = all[i - 1]
        return `C ${prev.x} ${prev.y + ROW / 2}, ${p.x} ${p.y - ROW / 2}, ${p.x} ${p.y}`
      })
      .join(' ')

  return (
    <section aria-labelledby="mission-map" className="rounded-3xl bg-card p-5 ring-1 ring-border">
      <h2 id="mission-map" className="flex items-baseline justify-between">
        <span className="text-lg font-semibold">Mission map</span>
        <span className="text-sm text-muted-foreground">{result.checkins_logged} check-ins</span>
      </h2>
      <div className="relative mt-2" style={{ height }}>
        <svg aria-hidden className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          <path d={path(stops.length - 1)} fill="none" stroke="var(--wt-navy-100)" strokeWidth={4} strokeDasharray="2 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {reached > 0 && (
            <path d={path(reached)} fill="none" stroke="var(--wt-coral-500)" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <ol className="absolute inset-0">
          {stops.map((stop, i) => {
            const { x, y } = points[i]
            const labelLeft = x > 70
            if (stop.kind === 'verdict')
              return (
                <VerdictStop key="verdict" x={x} y={y} labelLeft={labelLeft} date={stop.date} status={result.status} />
              )
            const isToday = !finished && stop.n === today
            const passed = stop.n < today
            const answer = passed ? adherenceFor(session, experiment.start, stop.n) : undefined
            const look = answer ? ADHERENCE[answer] : null
            const Icon = look?.icon ?? (isToday ? MapPin : Check)
            const status = isToday ? 'Today' : look ? look.label : passed ? 'Done' : formatDay(stop.date)
            return (
              <li
                key={stop.n}
                aria-current={isToday ? 'step' : undefined}
                className="absolute flex -translate-y-1/2 items-center gap-2.5"
                style={{
                  top: y,
                  left: labelLeft ? undefined : `calc(${x}% - 26px)`,
                  right: labelLeft ? `calc(${100 - x}% - 26px)` : undefined,
                  flexDirection: labelLeft ? 'row-reverse' : 'row',
                }}
              >
                <span
                  className={cn(
                    'relative grid size-[52px] shrink-0 place-items-center rounded-full text-lg font-bold shadow-sm',
                    isToday && 'bg-coral-500 text-navy-900 ring-4 ring-coral-500/30',
                    !isToday && look && look.node,
                    !isToday && !look && passed && 'bg-navy-900 text-white',
                    !isToday && !passed && 'bg-card text-muted-foreground ring-2 ring-navy-100',
                  )}
                >
                  {isToday && (
                    <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-coral-500/40 motion-reduce:hidden" />
                  )}
                  {passed || isToday ? <Icon aria-hidden className="relative size-6" /> : stop.n}
                </span>
                <span className={cn('leading-tight', labelLeft && 'text-right')}>
                  <span className="block font-semibold">Day {stop.n}</span>
                  <span className={cn('block text-sm', look ? `font-medium ${look.text}` : 'text-muted-foreground', isToday && 'font-semibold text-coral-700')}>
                    {status}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function VerdictStop({
  x,
  y,
  labelLeft,
  date,
  status,
}: {
  x: number
  y: number
  labelLeft: boolean
  date: string
  status: ExperimentResult['status']
}) {
  const look =
    status === 'improved'
      ? { icon: Trophy, node: 'bg-green-700 text-white', text: 'Case closed' }
      : status === 'not_improved'
        ? { icon: Stethoscope, node: 'bg-navy-900 text-coral-500', text: 'To your doctor' }
        : status === 'not_enough_data'
          ? { icon: Flag, node: 'bg-navy-100 text-navy-900', text: 'On hold' }
          : { icon: Flag, node: 'border-2 border-dashed border-navy-300 bg-card text-navy-500', text: formatDay(date) }
  return (
    <li
      className="absolute flex -translate-y-1/2 items-center gap-2.5"
      style={{
        top: y,
        left: labelLeft ? undefined : `calc(${x}% - 30px)`,
        right: labelLeft ? `calc(${100 - x}% - 30px)` : undefined,
        flexDirection: labelLeft ? 'row-reverse' : 'row',
      }}
    >
      <span className={cn('grid size-[60px] shrink-0 place-items-center rounded-2xl shadow-sm', look.node)}>
        <look.icon aria-hidden className="size-7" />
      </span>
      <span className="leading-tight">
        <span className="block font-semibold">Verdict</span>
        <span className="block text-sm text-muted-foreground">{look.text}</span>
      </span>
    </li>
  )
}
