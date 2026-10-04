import { useId, useState } from 'react'
import { BedDouble, ChevronDown, EyeOff, HeartPulse, Target, type LucideIcon } from 'lucide-react'

import { MascotBadge } from '@/components/case/CaseParts'
import { formatDay } from '@/lib/dates'
import type { ExcludedPoint, ExperimentPlan, Explanation } from '@/lib/types'
import { cn } from '@/lib/utils'

const FAKE_METRICS: Record<string, { name: string; unit: string; icon: LucideIcon }> = {
  resting_hr: { name: 'Resting heart rate', unit: 'bpm', icon: HeartPulse },
  sleep: { name: 'Sleep', unit: 'h', icon: BedDouble },
}

const firstSentence = (text: string) => text.split(/(?<=\.)\s+/)[0] ?? text

// Unreliable sensor readings the engine threw out, grouped by night. The headline stays in view;
// the values and the short reason for each one open with "Why?".
export function FakeClues({ points }: { points: ExcludedPoint[] }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
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
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg font-semibold text-navy-700 underline-offset-4 hover:underline focus-visible:outline-2"
      >
        Why?
        <ChevronDown aria-hidden className={cn('size-5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul id={listId} className="mt-2 space-y-3">
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
      )}
    </section>
  )
}

// The mission and its steps. The morning check-in then asks each day whether it was kept.
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
      <ol className="space-y-3 p-5">
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
    </section>
  )
}

const TEASER = 120 // characters of the notes shown before "Read all notes"

// The opening of the notes: up to the last full stop, comma or colon that fits (else the last
// space), so a cut never splits a number or a word.
function teaser(text: string): string {
  if (text.length <= TEASER) return text
  const cut = text.slice(0, TEASER)
  const sentence = cut.lastIndexOf('. ')
  if (sentence >= TEASER / 2) return cut.slice(0, sentence + 1)
  const clause = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(': '))
  return `${cut.slice(0, clause >= TEASER / 2 ? clause : cut.lastIndexOf(' '))}…`
}

export function DetectiveNotes({ explanation }: { explanation: Explanation }) {
  const [open, setOpen] = useState(false)
  const short = teaser(explanation.text)
  const long = short !== explanation.text
  return (
    <section className="flex items-start gap-3" aria-label="Detective's notes">
      <MascotBadge className="mt-1 size-11 ring-navy-100" />
      <div className="relative flex-1 rounded-3xl rounded-tl-md bg-card p-4 shadow-sm ring-1 ring-border">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-coral-700">Detective's notes</p>
        <p className="mt-1.5 leading-relaxed">{open ? explanation.text : short}</p>
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
          <p className="mt-2 text-sm text-muted-foreground">Written by AI from our numbers. Every number in it is checked.</p>
        )}
      </div>
    </section>
  )
}
