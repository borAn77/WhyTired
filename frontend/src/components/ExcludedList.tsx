import { EyeOff } from 'lucide-react'

import { formatDay } from '@/lib/dates'
import type { ExcludedPoint } from '@/lib/types'

const METRIC_NAMES: Record<string, string> = {
  resting_hr: 'Resting heart rate',
  sleep: 'Sleep',
}

// Unreliable sensor readings that the engine left out, grouped by night, each with its reason.
export function ExcludedList({ points }: { points: ExcludedPoint[] }) {
  if (points.length === 0) return null
  const nights = Object.entries(
    points.reduce<Record<string, ExcludedPoint[]>>((groups, point) => {
      ;(groups[point.date] ??= []).push(point)
      return groups
    }, {}),
  )
  const label = nights.length === 1 ? '1 night' : `${nights.length} nights`

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-semibold">
        <EyeOff aria-hidden className="size-5 text-navy-500" />
        We left out {label} of unreliable data
      </h2>
      <p className="mt-1 text-muted-foreground">So a glitch can't push the result in the wrong direction.</p>
      <ul className="mt-3 space-y-3">
        {nights.map(([date, items]) => (
          <li key={date} className="rounded-xl bg-navy-50 p-4">
            <p className="font-semibold">{formatDay(date)}</p>
            <ul className="mt-1 space-y-1.5">
              {items.map((point) => (
                <li key={point.metric}>
                  <span className="font-medium">{METRIC_NAMES[point.metric] ?? point.metric}:</span> {point.reason}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
