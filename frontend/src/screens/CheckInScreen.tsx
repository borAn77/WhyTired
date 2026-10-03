import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  Angry,
  ArrowLeft,
  ArrowRight,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Check,
  Frown,
  Laugh,
  Meh,
  Minus,
  Plus,
  Search,
  Smile,
  Target,
  Thermometer,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PrimaryButton } from '@/components/PrimaryButton'
import { XpPill } from '@/components/progress'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import {
  ADHERENCE,
  SLEEP_CLUES,
  STRESS_CLUES,
  missionQuestion,
  needsSleepClue,
  needsStressClue,
  type Adherence,
  type ClueOption,
  type DayClues,
} from '@/lib/clues'
import { XP } from '@/lib/progress'
import { toCtx, useSession } from '@/lib/session'
import type { CheckIn } from '@/lib/types'
import { useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

type ScaleKey = 'energy' | 'sleep_quality' | 'stress' | 'soreness'
type Option = { label: string; icon: LucideIcon }

// Faces go from bad to good for sleep, and from good to bad for stress and soreness,
// so the icon always matches how the answer feels. Every option also has a written label.
const BAD_TO_GOOD = [Angry, Frown, Meh, Smile, Laugh]
const GOOD_TO_BAD = [...BAD_TO_GOOD].reverse()
const options = (labels: string[], icons: LucideIcon[]): Option[] => labels.map((label, i) => ({ label, icon: icons[i] }))

const SCALES: Record<ScaleKey, { question: string; options: Option[] }> = {
  energy: {
    question: 'How much energy do you have?',
    options: options(['Empty', 'Low', 'OK', 'Good', 'Full'], [Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging]),
  },
  sleep_quality: {
    question: 'How well did you sleep?',
    options: options(['Very badly', 'Badly', 'OK', 'Well', 'Very well'], BAD_TO_GOOD),
  },
  stress: {
    question: 'How stressed do you feel?',
    options: options(['Not at all', 'A little', 'Somewhat', 'Very', 'Extremely'], GOOD_TO_BAD),
  },
  soreness: {
    question: 'How sore are your muscles?',
    options: options(['Not at all', 'A little', 'Somewhat', 'Very', 'Extremely'], GOOD_TO_BAD),
  },
}

type Step = ScaleKey | 'sleep_hours' | 'mission' | 'sleep_clue' | 'stress_clue'

const MIN_SLEEP = 0
const MAX_SLEEP = 14
const ADVANCE_MS = 280

// The 15-second morning check-in: one question per card, a tap answers and moves on.
// Sleep hours are prefilled from the watch when there is one. Follow-up cards appear by
// simple rules (lib/clues.ts): the mission card while an experiment runs, and a "what's behind
// it" card after a short or bad night or a high stress answer.
export function CheckInScreen() {
  const { session } = useSession()
  // A new day (time travel) starts a fresh check-in instead of keeping yesterday's answers.
  return <CheckInCards key={session.today} />
}

function CheckInCards() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const ctx = toCtx(session)
  const { data } = useApi(`coach:${JSON.stringify(ctx)}`, () => api.coach({ ...ctx, planned_session: null }))

  const [answers, setAnswers] = useState<Partial<CheckIn>>(session.checkins[session.today] ?? {})
  const [clues, setClues] = useState<DayClues>(session.clues[session.today] ?? {})
  const [index, setIndex] = useState(0)
  const measured = data?.measured_sleep_hours ?? null
  const sleep = answers.sleep_hours ?? (measured !== null ? Math.round(measured * 2) / 2 : 7.5)
  const isNew = !session.checkins[session.today]
  const mission = missionQuestion(session)

  const steps = [
    mission && 'mission',
    'energy',
    'sleep_hours',
    'sleep_quality',
    needsSleepClue(sleep, answers.sleep_quality) && 'sleep_clue',
    'stress',
    needsStressClue(answers.stress) && 'stress_clue',
    'soreness',
  ].filter(Boolean) as Step[]
  const stepCount = useRef(steps.length)
  useEffect(() => {
    stepCount.current = steps.length
  })
  const step = steps[Math.min(index, steps.length - 1)]
  const last = index >= steps.length - 1

  const heading = useRef<HTMLHeadingElement>(null)
  const advanceTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(advanceTimer.current), [])
  useEffect(() => {
    // Move keyboard and screen-reader focus to the new question.
    if (index > 0) heading.current?.focus()
  }, [index])

  const answered = (key: Step) => {
    if (key === 'sleep_hours') return true
    if (key === 'mission') return clues.mission !== undefined
    if (key === 'sleep_clue') return (clues.sleep?.length ?? 0) > 0
    if (key === 'stress_clue') return (clues.stress?.length ?? 0) > 0
    return answers[key] !== undefined
  }
  const complete = steps.every(answered)

  // The step list can grow from the answer just given (a follow-up card), so the next
  // index is read when the timer fires, not now.
  const advance = () => {
    window.clearTimeout(advanceTimer.current)
    advanceTimer.current = window.setTimeout(
      () => setIndex((i) => Math.min(i + 1, stepCount.current - 1)),
      ADVANCE_MS,
    )
  }
  const choose = (key: ScaleKey, value: number) => {
    setAnswers({ ...answers, [key]: value })
    if (!last) advance()
  }

  const submit = () => {
    const checkin: CheckIn = {
      energy: answers.energy!,
      sleep_hours: sleep,
      sleep_quality: answers.sleep_quality!,
      stress: answers.stress!,
      soreness: answers.soreness!,
      ill: answers.ill ?? false,
    }
    // Keep only follow-up answers whose card was actually part of today's check-in.
    const kept: DayClues = {
      mission: steps.includes('mission') ? clues.mission : undefined,
      sleep: steps.includes('sleep_clue') ? clues.sleep : undefined,
      stress: steps.includes('stress_clue') ? clues.stress : undefined,
    }
    update({
      checkins: { ...session.checkins, [session.today]: checkin },
      clues: { ...session.clues, [session.today]: kept },
    })
    navigate('/', { state: isNew ? { gained: 'checkin' } : null })
  }

  const footer = last ? (
    <PrimaryButton disabled={!complete} onClick={submit}>
      <Check aria-hidden />
      Finish check-in
      {isNew && <XpPill amount={XP.checkin} />}
    </PrimaryButton>
  ) : (
    <PrimaryButton disabled={!answered(step)} onClick={() => setIndex(index + 1)}>
      {step === 'sleep_hours' ? 'That’s right' : 'Next'}
      <ArrowRight aria-hidden />
    </PrimaryButton>
  )

  let card: ReactNode
  if (step === 'sleep_hours')
    card = (
      <SleepCard
        heading={heading}
        sleep={sleep}
        fromWatch={measured !== null && answers.sleep_hours === undefined ? measured : null}
        onChange={(hours) => setAnswers({ ...answers, sleep_hours: hours })}
      />
    )
  else if (step === 'mission')
    card = (
      <MissionCheck
        heading={heading}
        question={mission ?? ''}
        value={clues.mission}
        onChange={(value) => {
          setClues({ ...clues, mission: value })
          advance()
        }}
      />
    )
  else if (step === 'sleep_clue' || step === 'stress_clue') {
    const kind = step === 'sleep_clue' ? 'sleep' : 'stress'
    card = (
      <ClueCard
        heading={heading}
        question={kind === 'sleep' ? 'What got in the way of your sleep?' : 'What’s behind the stress?'}
        options={kind === 'sleep' ? SLEEP_CLUES : STRESS_CLUES}
        selected={clues[kind] ?? []}
        onChange={(ids) => setClues({ ...clues, [kind]: ids })}
      />
    )
  } else
    card = (
      <ScaleCard heading={heading} scale={SCALES[step]} value={answers[step]} onChange={(value) => choose(step, value)}>
        {last && <IllSwitch on={answers.ill ?? false} onToggle={() => setAnswers({ ...answers, ill: !answers.ill })} />}
      </ScaleCard>
    )

  return (
    <Screen footer={footer}>
      <div className="flex items-center gap-3">
        {index > 0 ? (
          <Button variant="ghost" size="sm" className="-ml-2 h-11" onClick={() => setIndex(index - 1)}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
        ) : (
          <p className="font-semibold">Good morning</p>
        )}
        <div aria-hidden className="flex flex-1 gap-1.5">
          {steps.map((key, i) => (
            <span
              key={key}
              className={cn('h-2 flex-1 rounded-full transition-colors', i <= index ? 'bg-coral-500' : 'bg-navy-100')}
            />
          ))}
        </div>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {Math.min(index, steps.length - 1) + 1}/{steps.length}
        </span>
      </div>

      <div key={step} className="animate-in fade-in slide-in-from-right-6 duration-300 motion-reduce:animate-none">
        {card}
      </div>
    </Screen>
  )
}

function MissionCheck({
  heading,
  question,
  value,
  onChange,
}: {
  heading: RefObject<HTMLHeadingElement | null>
  question: string
  value: Adherence | undefined
  onChange: (value: Adherence) => void
}) {
  return (
    <section className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-coral-700">
        <Target aria-hidden className="size-4" />
        Mission check
      </p>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold leading-tight tracking-tight outline-none">
        {question}
      </h1>
      <div role="radiogroup" aria-label={question} className="grid gap-2.5">
        {ADHERENCE.map(({ id, label, icon: Icon }) => {
          const selected = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className={cn(
                'flex min-h-14 items-center gap-3.5 rounded-2xl px-4 text-left text-lg font-semibold ring-1 transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] motion-reduce:transition-none',
                selected ? 'bg-navy-900 text-white ring-navy-900' : 'bg-card text-navy-900 ring-border hover:bg-navy-50',
              )}
            >
              <Icon aria-hidden className={cn('size-7 shrink-0', selected ? 'text-coral-500' : 'text-navy-500')} />
              {label}
            </button>
          )
        })}
      </div>
      <p className="text-muted-foreground">Honest answers make the result fair. Partly is fine.</p>
    </section>
  )
}

function ClueCard({
  heading,
  question,
  options,
  selected,
  onChange,
}: {
  heading: RefObject<HTMLHeadingElement | null>
  question: string
  options: ClueOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  // "Nothing special" / "Not sure" (no tip) can't be combined with a real clue.
  const toggle = (option: ClueOption) => {
    if (selected.includes(option.id)) return onChange(selected.filter((id) => id !== option.id))
    if (!option.tip) return onChange([option.id])
    const real = options.filter((o) => o.tip).map((o) => o.id)
    onChange([...selected.filter((id) => real.includes(id)), option.id])
  }
  return (
    <section className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-coral-700">
        <Search aria-hidden className="size-4" />
        Clue hunt
      </p>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold leading-tight tracking-tight outline-none">
        {question}
      </h1>
      <p className="text-muted-foreground">Pick all that apply.</p>
      <div role="group" aria-label={question} className="grid grid-cols-2 gap-2.5">
        {options.map((option) => {
          const on = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(option)}
              className={cn(
                'flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl p-3.5 text-left font-semibold ring-1 transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] motion-reduce:transition-none',
                on ? 'bg-navy-900 text-white ring-navy-900' : 'bg-card text-navy-900 ring-border hover:bg-navy-50',
              )}
            >
              <option.icon aria-hidden className={cn('size-6', on ? 'text-coral-500' : 'text-navy-500')} />
              {option.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ScaleCard({
  heading,
  scale,
  value,
  onChange,
  children,
}: {
  heading: RefObject<HTMLHeadingElement | null>
  scale: { question: string; options: Option[] }
  value: number | undefined
  onChange: (value: number) => void
  children?: ReactNode
}) {
  return (
    <section className="space-y-4">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold leading-tight tracking-tight outline-none">
        {scale.question}
      </h1>
      <div role="radiogroup" aria-label={scale.question} className="grid gap-2.5">
        {scale.options.map(({ label, icon: Icon }, i) => {
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
                'flex min-h-14 items-center gap-3.5 rounded-2xl px-4 text-left text-lg font-semibold ring-1 transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] motion-reduce:transition-none',
                selected ? 'bg-navy-900 text-white ring-navy-900' : 'bg-card text-navy-900 ring-border hover:bg-navy-50',
              )}
            >
              <Icon aria-hidden className={cn('size-7 shrink-0', selected ? 'text-coral-500' : 'text-navy-500')} />
              <span className="flex-1">{label}</span>
              <span aria-hidden className={cn('text-base tabular-nums', selected ? 'text-navy-100' : 'text-muted-foreground')}>
                {option}
              </span>
            </button>
          )
        })}
      </div>
      {children}
    </section>
  )
}

function SleepCard({
  heading,
  sleep,
  fromWatch,
  onChange,
}: {
  heading: RefObject<HTMLHeadingElement | null>
  sleep: number
  fromWatch: number | null
  onChange: (hours: number) => void
}) {
  return (
    <section className="space-y-4">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold leading-tight tracking-tight outline-none">
        How long did you sleep?
      </h1>
      <div className="rounded-3xl bg-card p-6 ring-1 ring-border">
        <div className="flex items-center justify-between gap-3">
          <StepButton label="Half an hour less" disabled={sleep <= MIN_SLEEP} onClick={() => onChange(sleep - 0.5)}>
            <Minus aria-hidden />
          </StepButton>
          <output aria-live="polite" className="text-5xl font-bold tabular-nums tracking-tight">
            {sleep.toFixed(1)}
            <span className="ml-1 text-2xl font-medium text-muted-foreground">h</span>
          </output>
          <StepButton label="Half an hour more" disabled={sleep >= MAX_SLEEP} onClick={() => onChange(sleep + 0.5)}>
            <Plus aria-hidden />
          </StepButton>
        </div>
        {fromWatch !== null && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-muted-foreground">
            <Watch aria-hidden className="size-4" />
            Filled in from your watch ({fromWatch.toFixed(1)} h)
          </p>
        )}
      </div>
    </section>
  )
}

function IllSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-border',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        on && 'bg-coral-50 ring-2 ring-coral-500',
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
          on ? 'justify-end bg-coral-700' : 'justify-start bg-navy-100',
        )}
      >
        <span className="size-5 rounded-full bg-white shadow" />
      </span>
    </button>
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
      className="grid size-14 place-items-center rounded-full bg-navy-50 text-navy-900 ring-1 ring-border hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
