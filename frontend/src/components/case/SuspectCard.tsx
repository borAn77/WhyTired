import { useId, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  Brain,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  HeartPulse,
  History,
  Moon,
  Search,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

import { MiniChart } from '@/components/MiniChart'
import { CONFIDENCE } from '@/lib/labels'
import { formatShort } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Cause, CauseId, Evidence, HistoryCheck } from '@/lib/types'

const SUSPECT_ICONS: Record<CauseId, LucideIcon> = {
  load_spike: TrendingUp,
  sleep_debt: Moon,
  stress_spike: Brain,
  rhr_elevated: HeartPulse,
}

// Short labels for the clue tiles. The full sentence from the engine is kept for screen readers.
const CLUES: Record<string, { label: string; icon: LucideIcon; unit?: string }> = {
  weekly_load: { label: 'Training load, last 7 days', icon: TrendingUp, unit: 'pts' },
  training_days: { label: 'Training days, last 7', icon: CalendarDays, unit: '/ 7' },
  sleep_debt: { label: 'Sleep missed this week', icon: Moon },
  sleep_hours: { label: 'Sleep per night', icon: BedDouble },
  stress: { label: 'Stress this week', icon: Brain },
  resting_hr: { label: 'Resting heart rate', icon: HeartPulse },
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function SuspectCard({ cause, rank }: { cause: Cause; rank: number }) {
  const prime = rank === 1
  const [open, setOpen] = useState(prime)
  const Icon = SUSPECT_ICONS[cause.id] ?? Search

  return (
    <article
      className={cn(
        'overflow-hidden rounded-3xl bg-card shadow-sm',
        prime ? 'ring-2 ring-coral-500' : 'ring-1 ring-border',
      )}
    >
      <p
        className={cn(
          'flex items-center justify-between px-5 py-2 text-sm font-bold uppercase tracking-[0.14em]',
          prime ? 'bg-coral-500 text-navy-900' : 'bg-navy-50 text-navy-700',
        )}
      >
        <span>{prime ? 'Prime suspect' : `Suspect #${rank}`}</span>
        <span aria-hidden>#{rank}</span>
      </p>

      <div className="space-y-4 p-5">
        <header className="flex items-start gap-3">
          <span
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-2xl',
              prime ? 'bg-navy-900 text-coral-500' : 'bg-navy-50 text-navy-700',
            )}
          >
            <Icon aria-hidden className="size-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-lg font-semibold leading-snug">{cause.title}</h3>
            <EvidenceMeter cause={cause} />
          </div>
        </header>

        {open ? (
          <div className="space-y-4">
            <ul className={cn('grid gap-2', cause.evidence.length > 1 && 'grid-cols-2')}>
              {cause.evidence.map((evidence) => (
                <ClueTile key={evidence.metric} evidence={evidence} />
              ))}
            </ul>
            {cause.chart && (
              <div className="rounded-2xl bg-app p-3 ring-1 ring-border">
                <MiniChart chart={cause.chart} height="h-28" />
              </div>
            )}
            {cause.history_check && <AlibiCheck check={cause.history_check} />}
            <HowSure cause={cause} />
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setOpen(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-navy-50 font-semibold text-navy-900 hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Search aria-hidden className="size-5" />
            Inspect {cause.evidence.length} {cause.evidence.length === 1 ? 'clue' : 'clues'}
          </button>
        )}
      </div>
    </article>
  )
}

// Four segments = the four confidence checks (score). Always paired with the written label.
function EvidenceMeter({ cause }: { cause: Cause }) {
  const filled = Math.max(0, Math.min(4, cause.score))
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-2.5 w-5 rounded-full', i < filled ? 'bg-navy-900' : 'bg-navy-100')} />
        ))}
      </span>
      <span className="text-sm font-semibold">{CONFIDENCE[cause.confidence].label}</span>
    </div>
  )
}

function ClueTile({ evidence }: { evidence: Evidence }) {
  const clue = CLUES[evidence.metric] ?? { label: evidence.metric, icon: Search }
  const unit = clue.unit ?? evidence.unit
  const up = evidence.baseline !== null && evidence.value > evidence.baseline
  const Trend = up ? ArrowUp : ArrowDown
  return (
    <li className="rounded-2xl bg-app p-3.5 ring-1 ring-border">
      <span className="sr-only">{evidence.text}</span>
      <div aria-hidden>
        <p className="flex items-center gap-1.5 text-sm leading-tight text-muted-foreground">
          <clue.icon className="size-4 shrink-0 text-coral-600" />
          {clue.label}
        </p>
        <p className="mt-1.5 flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums tracking-tight">{fmt(evidence.value)}</span>
          <span className="font-medium text-muted-foreground">{unit}</span>
        </p>
        {evidence.baseline !== null ? (
          <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-coral-700">
            <Trend className="size-3.5" strokeWidth={3} />
            usual {fmt(evidence.baseline)}
          </p>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-coral-700">vs your usual</p>
        )}
      </div>
    </li>
  )
}

const lastSentence = (text: string) => text.split(/(?<=\.)\s+/).pop() ?? text
const signed = (n: number) => `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`

function AlibiCheck({ check }: { check: HistoryCheck }) {
  const period = check.period_tag ? `${check.period_tag[0].toUpperCase()}${check.period_tag.slice(1)} week` : 'An earlier week'
  const range =
    check.period_start && check.period_end ? `${formatShort(check.period_start)} – ${formatShort(check.period_end)}` : null
  const deltas = [
    check.energy_delta !== null && { label: 'Energy', value: signed(check.energy_delta), unit: '' },
    check.rhr_delta !== null && { label: 'Resting HR', value: signed(check.rhr_delta), unit: 'bpm' },
  ].filter(Boolean) as { label: string; value: string; unit: string }[]

  return (
    <div className="rounded-2xl bg-navy-50 p-4">
      <span className="sr-only">{check.text}</span>
      <div aria-hidden>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-navy-700">
            <History className="size-4" />
            Alibi check
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold',
              check.supports ? 'bg-green-700 text-white' : 'bg-navy-100 text-navy-900',
            )}
          >
            {check.supports ? <CircleCheck className="size-4" /> : <CircleMinus className="size-4" />}
            {check.supports ? 'Confirmed' : 'Not confirmed'}
          </span>
        </div>
        <p className="mt-2 font-semibold">
          {period}
          {range && <span className="font-normal text-muted-foreground"> · {range}</span>}
        </p>
        {deltas.length > 0 ? (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {deltas.map((delta) => (
                <span key={delta.label} className="rounded-xl bg-card px-3 py-1.5 ring-1 ring-border">
                  <span className="text-sm text-muted-foreground">{delta.label} </span>
                  <span className="font-bold tabular-nums">
                    {delta.value}
                    {delta.unit && ` ${delta.unit}`}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-2">{lastSentence(check.text)}</p>
          </>
        ) : (
          <p className="mt-1">{check.text}</p>
        )}
      </div>
    </div>
  )
}

function HowSure({ cause }: { cause: Cause }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        How sure are we?
        <ChevronDown aria-hidden className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={listId} className="space-y-3 pb-1 pt-1">
          <ul className="space-y-2">
            {cause.checks.map((check) => {
              const CheckIcon = check.passed ? CircleCheck : CircleMinus
              return (
                <li key={check.label} className="flex gap-2.5">
                  <CheckIcon
                    aria-label={check.passed ? 'Yes' : 'No'}
                    className={cn('mt-0.5 size-5 shrink-0', check.passed ? 'text-green-700' : 'text-navy-500')}
                  />
                  <span className={cn(!check.passed && 'text-muted-foreground')}>{check.label}</span>
                </li>
              )
            })}
          </ul>
          <p className="text-sm text-muted-foreground">
            4 checks = high, 2–3 = medium, 0–1 = low.
            {cause.data_level_used === 'basic' && ' Without watch or pulse data the most we can say is medium.'}
          </p>
        </div>
      )}
    </div>
  )
}
