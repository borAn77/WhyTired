import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Heart, HeartPulse, RotateCcw, TriangleAlert } from 'lucide-react'

import { MANUAL_MAX, MANUAL_MIN, MEASURE_MS, estimateBpm, pulseFromTaps, type PulseResult } from '@/lib/pulse'
import { cn } from '@/lib/utils'

const RING_RADIUS = 92
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const LINK = 'min-h-11 rounded-lg px-1 font-medium text-navy-700 underline underline-offset-4 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2'

// The optional last card of the check-in for users without a watch: tap the heart on every
// beat for 30 seconds, or type in a number from a monitor. The bpm math is in lib/pulse.ts.
export function PulseTap({
  heading,
  value,
  onChange,
}: {
  heading: RefObject<HTMLHeadingElement | null>
  value: number | null | undefined
  onChange: (pulse: number | null) => void
}) {
  const [manual, setManual] = useState(false)
  const [taps, setTaps] = useState<number[]>([]) // tap times in ms (event timestamps)
  const [elapsed, setElapsed] = useState(0)
  const start = taps[0] // the timer starts at the first tap, so the user starts when ready
  const done = elapsed >= MEASURE_MS
  const result = done ? pulseFromTaps(taps) : null

  useEffect(() => {
    if (start === undefined || done) return
    const tick = () => setElapsed(Math.min(MEASURE_MS, performance.now() - start))
    const interval = window.setInterval(tick, 250)
    const end = window.setTimeout(tick, Math.ceil(MEASURE_MS - (performance.now() - start)) + 1)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(end)
    }
  }, [start, done])

  // A good result becomes the check-in's pulse as soon as the 30 seconds are up.
  const measured = result?.kind === 'ok' ? result.bpm : null
  const save = useRef(onChange)
  useEffect(() => {
    save.current = onChange
  })
  useEffect(() => {
    if (measured !== null) save.current(measured)
  }, [measured])

  // The heart disappears when time is up; keep keyboard focus on the page by moving it to the result.
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (done && document.activeElement === document.body) resultRef.current?.focus({ preventScroll: true })
  }, [done])

  const reset = () => {
    setTaps([])
    setElapsed(0)
  }
  const measureAgain = () => {
    reset()
    onChange(null)
  }
  const tap = (time: number) => {
    if (done || (start !== undefined && time - start > MEASURE_MS)) return
    setTaps((list) => [...list, time])
    navigator.vibrate?.(15)
  }

  // Not every tap: screen readers only hear when measuring starts and how it ended.
  let announcement = ''
  if (!manual && result) announcement = resultText(result, taps.length)
  else if (!manual && start !== undefined) announcement = 'Started. Keep tapping on every beat for 30 seconds.'

  let body: ReactNode
  if (manual) body = <ManualPulse value={value} onChange={onChange} />
  else if (result)
    body = <Result ref={resultRef} result={result} taps={taps.length} onAgain={measureAgain} />
  else if (start === undefined && value != null)
    body = (
      <div className="space-y-4 text-center">
        <Reading bpm={value} />
        <AgainButton onClick={measureAgain} />
      </div>
    )
  else body = <HeartButton taps={taps} elapsed={elapsed} onTap={tap} />

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold leading-tight tracking-tight outline-none">
          Morning pulse
        </h1>
        <span className="text-muted-foreground">Optional · 30 seconds</span>
      </div>
      <div className="flex gap-3">
        <HeartPulse aria-hidden className="mt-0.5 size-6 shrink-0 text-coral-700" />
        <ol className="list-decimal space-y-1 pl-5 leading-snug marker:font-semibold marker:text-coral-700">
          <li>Two fingers of one hand on your neck, next to your windpipe.</li>
          <li>Tap the heart with your other hand on every beat.</li>
        </ol>
      </div>

      <div className="rounded-3xl bg-card p-4 ring-1 ring-border">{body}</div>

      <p className="text-center">
        <button
          type="button"
          className={LINK}
          onClick={() => {
            reset()
            setManual(!manual)
          }}
        >
          {manual ? 'Tap along instead' : 'Enter a number instead'}
        </button>
      </p>
      <p className="text-muted-foreground">Not a medical measurement. It compares your mornings with your own usual.</p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  )
}

function resultText(result: PulseResult, taps: number) {
  if (result.kind === 'too_few') return 'Time’s up. Not enough taps. Try again.'
  if (result.kind === 'out_of_range') return 'Time’s up. That’s outside the usual resting range. Measure again?'
  const uneven = result.uneven ? ' Your taps were uneven. Measure again for a steadier number.' : ''
  return `Time’s up. Your morning pulse is ${result.bpm} bpm, from ${taps} taps.${uneven}`
}

function HeartButton({ taps, elapsed, onTap }: { taps: number[]; elapsed: number; onTap: (time: number) => void }) {
  const face = useRef<HTMLSpanElement>(null)
  // A touch fires pointerdown (the moment the finger lands, which we time) and then click.
  // Keyboard (Space, Enter) and screen readers fire click only.
  const fromPointer = useRef(false)
  const started = taps.length > 0
  const estimate = estimateBpm(taps)

  const tap = (time: number) => {
    onTap(time)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      face.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], {
        duration: 200,
        easing: 'ease-out',
      })
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative grid size-50 place-items-center">
        {/* Decoration only: without pointer-events-none the ring sits on top of the heart and takes every tap. */}
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 -rotate-90">
          <circle cx="100" cy="100" r={RING_RADIUS} fill="none" strokeWidth="8" className="stroke-navy-100" />
          {started && (
            <circle
              cx="100"
              cy="100"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - elapsed / MEASURE_MS)}
              className="stroke-coral-600 transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none"
            />
          )}
        </svg>
        <button
          type="button"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            fromPointer.current = true
            tap(event.timeStamp)
          }}
          onPointerCancel={() => {
            fromPointer.current = false
          }}
          onKeyDown={(event) => {
            fromPointer.current = false
            if (event.repeat) event.preventDefault() // holding a key down is not a beat
          }}
          onClick={(event) => {
            if (fromPointer.current) fromPointer.current = false
            else tap(event.timeStamp)
          }}
          className={cn(
            'grid size-40 touch-manipulation select-none place-items-center rounded-full bg-coral-500 text-navy-900',
            'shadow-lg shadow-coral-500/30 focus-visible:outline-2 focus-visible:outline-offset-4',
          )}
        >
          <span ref={face} className="flex flex-col items-center gap-1.5">
            <Heart aria-hidden className="size-12" fill="currentColor" />
            <span className="max-w-28 text-center font-semibold leading-tight">Tap on every beat</span>
          </span>
        </button>
      </div>
      {/* One short line while measuring: on a short screen it stays above the footer and clear of
          the floating "Ask WhyTired" button. */}
      {started ? (
        <p className="text-center tabular-nums">
          <span className="font-semibold">{Math.ceil((MEASURE_MS - elapsed) / 1000)} s left</span>
          <span className="text-muted-foreground">
            {' · '}
            {taps.length} {taps.length === 1 ? 'tap' : 'taps'}
          </span>
          {estimate && <span className="font-semibold"> · ≈ {estimate} bpm</span>}
        </p>
      ) : (
        <div className="text-center">
          <p className="text-lg font-semibold">30 seconds</p>
          <p className="text-muted-foreground">The timer starts at your first tap.</p>
        </div>
      )}
    </div>
  )
}

function Result({
  ref,
  result,
  taps,
  onAgain,
}: {
  ref: RefObject<HTMLDivElement | null>
  result: PulseResult
  taps: number
  onAgain: () => void
}) {
  return (
    <div className="space-y-4 text-center">
      <div ref={ref} tabIndex={-1} className="space-y-3 outline-none">
        {result.kind === 'ok' ? (
          <>
            <Reading bpm={result.bpm} detail={`from ${taps} taps in 30 seconds`} />
            {result.uneven && <Note>Your taps were uneven. Measure again for a steadier number.</Note>}
          </>
        ) : (
          <Note>
            {result.kind === 'too_few' ? 'Not enough taps. Try again.' : 'That’s outside the usual resting range. Measure again?'}
          </Note>
        )}
      </div>
      <AgainButton onClick={onAgain} />
    </div>
  )
}

function Reading({ bpm, detail }: { bpm: number; detail?: string }) {
  return (
    <div>
      <p className="font-semibold text-coral-700">Your morning pulse</p>
      <p className="text-6xl font-bold tabular-nums tracking-tight">
        {bpm}
        <span className="ml-1.5 text-2xl font-medium text-muted-foreground">bpm</span>
      </p>
      {detail && <p className="mt-1 text-muted-foreground">{detail}</p>}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-left font-medium text-amber-800">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      {children}
    </p>
  )
}

function AgainButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy-50 px-5 font-semibold text-navy-900 ring-1 ring-border hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <RotateCcw aria-hidden className="size-5" />
      Measure again
    </button>
  )
}

function ManualPulse({ value, onChange }: { value: number | null | undefined; onChange: (pulse: number | null) => void }) {
  const [text, setText] = useState(value != null ? String(value) : '')
  const [touched, setTouched] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  useEffect(() => input.current?.focus(), [])

  const number = Number(text)
  const valid = text !== '' && Number.isInteger(number) && number >= MANUAL_MIN && number <= MANUAL_MAX
  const change = (raw: string) => {
    setText(raw)
    const n = Number(raw)
    onChange(raw !== '' && Number.isInteger(n) && n >= MANUAL_MIN && n <= MANUAL_MAX ? n : null)
  }

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-lg font-semibold">
        Your pulse
      </label>
      <div className="flex items-center gap-3">
        <input
          ref={input}
          id={id}
          type="number"
          inputMode="numeric"
          min={MANUAL_MIN}
          max={MANUAL_MAX}
          step={1}
          value={text}
          onChange={(event) => change(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-describedby={`${id}-hint`}
          aria-invalid={touched && text !== '' && !valid}
          className="h-14 w-32 rounded-2xl bg-app px-4 text-3xl font-bold tabular-nums ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <span className="text-xl font-medium text-muted-foreground">bpm</span>
      </div>
      <p id={`${id}-hint`} className="text-muted-foreground">
        From a blood-pressure monitor or pulse oximeter, or count for 30 seconds and double it.
      </p>
      {touched && text !== '' && !valid && (
        <Note>
          Enter a whole number from {MANUAL_MIN} to {MANUAL_MAX}.
        </Note>
      )}
    </div>
  )
}
