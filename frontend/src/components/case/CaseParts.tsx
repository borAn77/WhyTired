import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, Info } from 'lucide-react'

import { LogoMark } from '@/components/Logo'
import { DATA_LEVELS } from '@/lib/labels'
import type { DataLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

// The "case file" framing shared by detective mode, the experiment and its verdict.

const CASE_STEPS =['Clues', 'Suspects', 'Mission', 'Verdict'] as const

export function MascotBadge({ className }: { className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-white shadow-md ring-4 ring-white/15', className)}>
      <LogoMark className="w-[70%]" />
    </span>
  )
}

/** Steps before `current` are done, `current` is highlighted. */
export function CaseProgress({ current, className }: { current: number; className?: string }) {
  return (
    <ol aria-label="Case progress" className={cn('flex items-start', className)}>
      {CASE_STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2', i <= current ? 'bg-coral-500' : 'bg-white/20')}
              />
            )}
            <span
              className={cn(
                'relative grid size-7 place-items-center rounded-full text-sm font-bold',
                done && 'bg-coral-500 text-navy-900',
                active && 'bg-navy-900 text-white ring-2 ring-coral-500',
                !done && !active && 'bg-navy-700 text-navy-100',
              )}
            >
              {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('text-sm', active ? 'font-semibold text-white' : 'text-navy-100')}>
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function CaseStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5">
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-sm leading-tight text-navy-100">{label}</p>
    </div>
  )
}

export function CaseHeader({
  title,
  stats,
  dataLevel,
  step,
}: {
  title: string
  stats?: ReactNode
  dataLevel?: DataLevel
  step: number
}) {
  const level = dataLevel ? DATA_LEVELS[dataLevel] : null
  return (
    <section className="overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-lg" aria-labelledby="case-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-500">Case file #001</p>
          <h1 id="case-title" className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
        </div>
        <MascotBadge className="size-16 rotate-6" />
      </div>
      {stats && <div className="mt-4 grid grid-cols-3 gap-2">{stats}</div>}
      {level && (
        <p className="mt-3 flex items-center gap-2 text-navy-100">
          <level.icon aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="font-semibold text-white">{level.label}</span> · {level.detail}
          </span>
        </p>
      )}
      {dataLevel === 'basic' && (
        <p className="mt-1.5 flex items-center gap-2 text-navy-100">
          <Info aria-hidden className="size-4 shrink-0" />
          No watch: medium confidence at most.
        </p>
      )}
      <CaseProgress current={step} className="mt-5" />
    </section>
  )
}

const KEY_MARKS = {
  bar: 'h-3.5 w-2.5 rounded-t-[3px] bg-coral-600',
  dashed: 'w-4 border-t-2 border-dashed border-navy-700',
} as const

/** A one-line chart key: each entry pairs a shape (a bar or a dashed line) with words. */
export function ChartKey({ items }: { items: { mark: keyof typeof KEY_MARKS; label: string }[] }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {items.map(({ mark, label }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={KEY_MARKS[mark]} />
          {label}
        </span>
      ))}
    </p>
  )
}

/** Fades content in one after another; switched off for people who prefer reduced motion. */
export function Reveal({ index = 0, children, className }: { index?: number; children: ReactNode; className?: string }) {
  const style: CSSProperties = { animationDelay: `${index * 120}ms` }
  return (
    <div
      style={style}
      className={cn('animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 motion-reduce:animate-none', className)}
    >
      {children}
    </div>
  )
}

const SCAN_LINES = [
  'Reading your check-ins',
  'Comparing with your usual weeks',
  'Checking your past for alibis',
  'Throwing out fake clues',
]

export function InvestigatingState() {
  const [line, setLine] = useState(0)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const ticker = window.setInterval(() => setLine((l) => (l + 1) % SCAN_LINES.length), 1100)
    const slowTimer = window.setTimeout(() => setSlow(true), 4000)
    return () => {
      window.clearInterval(ticker)
      window.clearTimeout(slowTimer)
    }
  }, [])

  return (
    <section role="status" aria-live="polite" className="rounded-3xl bg-navy-900 p-6 text-center text-white">
      <div className="relative mx-auto grid size-24 place-items-center">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-coral-500/30 motion-reduce:hidden" />
        <MascotBadge className="size-20" />
      </div>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-coral-500">Investigating</p>
      <p className="mt-1 text-lg font-semibold">{SCAN_LINES[line]}…</p>
      {slow && (
        <p className="mt-4 rounded-2xl bg-white/10 p-3 text-navy-100">
          Waking up the server. On the free plan this can take up to a minute, only the first time.
        </p>
      )}
    </section>
  )
}
