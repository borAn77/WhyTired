import { useState, type ReactNode } from 'react'
import { Minus, Plus, Thermometer, Watch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { api } from '@/lib/api'
import { toCtx, useSession } from '@/lib/session'
import type { CheckIn } from '@/lib/types'
import { useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

type ScaleKey = 'energy' | 'sleep_quality' | 'stress' | 'soreness'

const SCALES: { key: ScaleKey; question: string; labels: string[] }[] = [
  { key: 'energy', question: 'How much energy do you have?', labels: ['Empty', 'Low', 'OK', 'Good', 'Full'] },
  { key: 'sleep_quality', question: 'How well did you sleep?', labels: ['Very badly', 'Badly', 'OK', 'Well', 'Very well'] },
  { key: 'stress', question: 'How stressed do you feel?', labels: ['Not at all', 'A little', 'Somewhat', 'Very', 'Extremely'] },
  { key: 'soreness', question: 'How sore are your muscles?', labels: ['Not at all', 'A little', 'Somewhat', 'Very', 'Extremely'] },
]

const MIN_SLEEP = 0
const MAX_SLEEP = 14

// The 15-second morning check-in. Sleep hours are prefilled from the watch when there is one.
export function CheckInScreen() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const ctx = toCtx(session)
  const { data } = useApi(`coach:${JSON.stringify(ctx)}`, () => api.coach({ ...ctx, planned_session: null }))

  const [answers, setAnswers] = useState<Partial<CheckIn>>(session.checkins[session.today] ?? {})
  const measured = data?.measured_sleep_hours ?? null
  const sleep = answers.sleep_hours ?? (measured !== null ? Math.round(measured * 2) / 2 : 7.5)
  const complete = SCALES.every(({ key }) => answers[key] !== undefined)

  const submit = () => {
    const checkin: CheckIn = {
      energy: answers.energy!,
      sleep_hours: sleep,
      sleep_quality: answers.sleep_quality!,
      stress: answers.stress!,
      soreness: answers.soreness!,
      ill: answers.ill ?? false,
    }
    update({ checkins: { ...session.checkins, [session.today]: checkin } })
    navigate('/')
  }

  const [first, ...rest] = SCALES
  return (
    <Screen
      footer={
        <PrimaryButton disabled={!complete} onClick={submit}>
          Done: see today's advice
        </PrimaryButton>
      }
    >
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning</h1>
        <p className="mt-1 text-muted-foreground">5 quick questions. Tap an answer for each.</p>
      </section>

      <Scale
        question={first.question}
        labels={first.labels}
        value={answers[first.key]}
        onChange={(v) => setAnswers({ ...answers, [first.key]: v })}
      />

      <fieldset className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <legend className="sr-only">How long did you sleep?</legend>
        <p aria-hidden className="font-semibold">
          How long did you sleep?
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <StepButton
            label="Half an hour less"
            disabled={sleep <= MIN_SLEEP}
            onClick={() => setAnswers({ ...answers, sleep_hours: sleep - 0.5 })}
          >
            <Minus aria-hidden />
          </StepButton>
          <output aria-live="polite" className="text-3xl font-semibold tabular-nums">
            {sleep.toFixed(1)} <span className="text-lg font-medium text-muted-foreground">h</span>
          </output>
          <StepButton
            label="Half an hour more"
            disabled={sleep >= MAX_SLEEP}
            onClick={() => setAnswers({ ...answers, sleep_hours: sleep + 0.5 })}
          >
            <Plus aria-hidden />
          </StepButton>
        </div>
        {measured !== null && answers.sleep_hours === undefined && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Watch aria-hidden className="size-4" />
            Filled in from your watch ({measured.toFixed(1)} h)
          </p>
        )}
      </fieldset>

      {rest.map(({ key, question, labels }) => (
        <Scale
          key={key}
          question={question}
          labels={labels}
          value={answers[key]}
          onChange={(v) => setAnswers({ ...answers, [key]: v })}
        />
      ))}

      <button
        type="button"
        role="switch"
        aria-checked={answers.ill ?? false}
        onClick={() => setAnswers({ ...answers, ill: !answers.ill })}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-border',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          answers.ill && 'bg-coral-50 ring-2 ring-coral-500',
        )}
      >
        <Thermometer aria-hidden className="size-5 shrink-0 text-coral-700" />
        <span className="flex-1">
          <span className="block font-semibold">I feel ill today</span>
          <span className="block text-sm text-muted-foreground">Fever, cold or flu. We'll suggest rest.</span>
        </span>
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition',
            answers.ill ? 'justify-end bg-coral-700' : 'justify-start bg-navy-100',
          )}
        >
          <span className="size-5 rounded-full bg-white shadow" />
        </span>
      </button>
    </Screen>
  )
}

function Scale({
  question,
  labels,
  value,
  onChange,
}: {
  question: string
  labels: string[]
  value: number | undefined
  onChange: (value: number) => void
}) {
  return (
    <fieldset className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <legend className="sr-only">{question}</legend>
      <div aria-hidden className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">{question}</p>
        <p className="shrink-0 text-sm font-medium text-coral-700">{value ? labels[value - 1] : ''}</p>
      </div>
      <div role="radiogroup" aria-label={question} className="mt-3 grid grid-cols-5 gap-2">
        {labels.map((label, i) => {
          const option = i + 1
          const selected = value === option
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option}: ${label}`}
              onClick={() => onChange(option)}
              className={cn(
                'h-12 rounded-xl text-lg font-semibold ring-1 ring-border transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2',
                selected ? 'bg-navy-900 text-white ring-navy-900' : 'bg-app text-navy-900 hover:bg-navy-50',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-sm text-muted-foreground">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </fieldset>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-12 place-items-center rounded-full bg-navy-50 text-navy-900 ring-1 ring-border hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
