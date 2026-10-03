import { useState } from 'react'
import { BedDouble, EyeOff, HeartPulse, Target, Trophy, type LucideIcon } from 'lucide-react'

import { MascotBadge } from '@/components/case/CaseParts'
import { formatDay } from '@/lib/dates'
import type { ExcludedPoint, ExperimentPlan, Explanation } from '@/lib/types'
import { cn } from '@/lib/utils'

const FAKE_METRICS: Record<string, { name: string; unit: string; icon: LucideIcon }> = {
  resting_hr: { name: 'Resting heart rate', unit: 'bpm', icon: HeartPulse },
  sleep: { name: 'Sleep', unit: 'h', icon: BedDouble },
}

const firstSentence = (text: string) => text.split(/(?<=\.)\s+/)[0] ?? text

// Unreliable sensor readings the engine threw out, grouped by night, each with a short reason.
export function FakeClues({ points }: { points: ExcludedPoint[] }) {
  if (points.length === 0) return null
  const nights = Object.entries(
    points.reduce<Record<string, ExcludedPoint[]>>((groups, point) => {
      ;(groups[point.date] ??= []).push(point)
      return groups
    }, {}),
  )

  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-dashed border-navy-300 bg-card p-5">
      <span
        aria-hidden
        className="absolute right-4 top-4 rotate-[-8deg] rounded-md border-2 border-coral-700 px-2 py-0.5 text-sm font-black uppercase tracking-[0.16em] text-coral-700"
      >
        Dismissed
      </span>
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-navy-700">
        <EyeOff aria-hidden className="size-4" />
        Fake {nights.length === 1 ? 'clue' : 'clues'}
      </p>
      <h2 className="mt-1 pr-28 text-lg font-semibold leading-snug">
        {nights.length === 1 ? '1 night' : `${nights.length} nights`} of sensor glitches thrown out
      </h2>
      <p className="mt-0.5 text-muted-foreground">A loose strap can't fool the detective.</p>

      <ul className="mt-4 space-y-3">
        {nights.map(([date, items]) => (
          <li key={date} className="rounded-2xl bg-navy-50 p-4">
            <p className="font-semibold">{formatDay(date)}</p>
            <ul className="mt-2 space-y-2.5">
              {items.map((point) => {
                const metric = FAKE_METRICS[point.metric] ?? { name: point.metric, unit: '', icon: EyeOff }
                return (
                  <li key={point.metric} className="flex gap-3">
                    <metric.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-navy-500" />
                    <div>
                      <p>
                        <span className="font-medium">{metric.name}</span>
                        {point.value !== null && (
                          <>
                            {' '}
                            <span className="sr-only">value excluded: </span>
                            <span className="font-bold tabular-nums line-through decoration-coral-700 decoration-2">
                              {point.value} {metric.unit}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="text-muted-foreground">{firstSentence(point.reason)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function MissionCard({ plan }: { plan: ExperimentPlan }) {
  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-sm ring-2 ring-coral-500" aria-labelledby="mission">
      <div className="bg-coral-50 p-5">
        <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-coral-700">
          <Target aria-hidden className="size-4" />
          Your mission · {plan.days} days
        </p>
        <h2 id="mission" className="mt-1.5 text-xl font-semibold leading-snug">
          {plan.title}
        </h2>
      </div>
      <div className="space-y-4 p-5">
        <ol className="space-y-3">
          {plan.steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-coral-500 text-sm font-bold text-navy-900"
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Tracked every morning</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {plan.track.map((item) => (
              <li key={item} className="rounded-full bg-navy-50 px-3 py-1 text-sm font-medium">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-3 rounded-2xl bg-navy-900 p-3.5 text-white">
          <Trophy aria-hidden className="size-6 shrink-0 text-coral-500" />
          <span>
            <span className="font-semibold">Day {plan.days}:</span> the verdict, and a case-closed badge if it worked.
          </span>
        </p>
      </div>
    </section>
  )
}

const LONG_NOTE = 160

export function DetectiveNotes({ explanation }: { explanation: Explanation }) {
  const [open, setOpen] = useState(false)
  const long = explanation.text.length > LONG_NOTE
  return (
    <section className="flex items-start gap-3" aria-label="Detective's notes">
      <MascotBadge className="mt-1 size-11 ring-navy-100" />
      <div className="relative flex-1 rounded-3xl rounded-tl-md bg-card p-4 shadow-sm ring-1 ring-border">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-coral-700">Detective's notes</p>
        <p className={cn('mt-1.5 leading-relaxed', long && !open && 'line-clamp-3')}>{explanation.text}</p>
        {long && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="mt-1 min-h-11 rounded-lg font-semibold text-navy-700 underline-offset-4 hover:underline focus-visible:outline-2"
          >
            {open ? 'Show less' : 'Read all notes'}
          </button>
        )}
        {explanation.source === 'llm' && (
          <p className="mt-2 text-sm text-muted-foreground">Written by AI from our numbers, then fact-checked.</p>
        )}
      </div>
    </section>
  )
}
