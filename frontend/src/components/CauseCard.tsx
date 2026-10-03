import { useId, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  HeartPulse,
  History,
  Info,
  Moon,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

import { ConfidenceBadge } from '@/components/badges'
import { MiniChart } from '@/components/MiniChart'
import { Button } from '@/components/ui/button'
import { CONFIDENCE } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Cause, ConfidenceCheck, HistoryCheck } from '@/lib/types'

const EVIDENCE_ICONS: Record<string, LucideIcon> = {
  weekly_load: TrendingUp,
  training_days: CalendarDays,
  sleep_debt: Moon,
  sleep_hours: Moon,
  stress: TrendingUp,
  resting_hr: HeartPulse,
}

export function CauseCard({ cause, rank, expanded = false }: { cause: Cause; rank: number; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded)
  return (
    <article className="space-y-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
      <header className="flex items-start gap-3">
        <span
          aria-label={`Cause ${rank}`}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-bold text-white"
        >
          {rank}
        </span>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-snug">{cause.title}</h3>
          <ConfidenceBadge level={cause.confidence} />
        </div>
      </header>

      <ul className="space-y-2">
        {cause.evidence.map((evidence) => {
          const Icon = EVIDENCE_ICONS[evidence.metric] ?? TrendingUp
          return (
            <li key={evidence.metric} className="flex gap-2.5">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-coral-600" />
              <span>{evidence.text}</span>
            </li>
          )
        })}
      </ul>

      {open ? (
        <>
          {cause.chart && <MiniChart chart={cause.chart} />}
          {cause.history_check && <HistoryCallout check={cause.history_check} />}
          <ConfidenceChecks cause={cause} />
        </>
      ) : (
        <Button variant="outline" className="h-11 w-full text-base" onClick={() => setOpen(true)}>
          Show the evidence
        </Button>
      )}
    </article>
  )
}

function HistoryCallout({ check }: { check: HistoryCheck }) {
  const Icon = check.supports ? History : Info
  return (
    <div className="rounded-xl bg-navy-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <Icon aria-hidden className="size-4" />
        Checked against your own history
      </p>
      <p className="mt-1.5">{check.text}</p>
    </div>
  )
}

function ConfidenceChecks({ cause }: { cause: Cause }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const passed = cause.checks.slice(0, 4).filter((check) => check.passed).length
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Why {CONFIDENCE[cause.confidence].label.toLowerCase()}?
        <ChevronDown aria-hidden className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={listId} className="space-y-3 pb-1 pt-2">
          <ul className="space-y-2">
            {cause.checks.map((check) => (
              <CheckRow key={check.label} check={check} />
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {passed} of 4 checks passed. 4 = high, 2–3 = medium, 0–1 = low.
            {cause.data_level_used === 'basic' && ' Without watch or pulse data the most we can say is medium.'}
          </p>
        </div>
      )}
    </div>
  )
}

function CheckRow({ check }: { check: ConfidenceCheck }) {
  const Icon = check.passed ? CircleCheck : CircleMinus
  return (
    <li className="flex gap-2.5">
      <Icon
        aria-label={check.passed ? 'Yes' : 'No'}
        className={cn('mt-0.5 size-5 shrink-0', check.passed ? 'text-green-700' : 'text-navy-500')}
      />
      <span className={cn(!check.passed && 'text-muted-foreground')}>{check.label}</span>
    </li>
  )
}
