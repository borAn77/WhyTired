import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ArrowLeft, Check, FlaskConical, Lock, Minus, Plus, Search, Stethoscope, Sunrise, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AnimatedLogo } from '@/components/AnimatedLogo'
import { ChoiceGroup } from '@/components/ChoiceGroup'
import { PrimaryButton } from '@/components/PrimaryButton'
import { LogoCharacter } from '@/components/stage/LogoCharacter'
import { Button } from '@/components/ui/button'
import {
  BRANDS,
  CONTEXT,
  DATA_LEVELS,
  DEVICES,
  GOALS,
  LEVELS,
  MINUTES,
  PER_WEEK,
  SPORTS,
  type Device,
  type Level,
  type Minutes,
  type PerWeek,
} from '@/lib/profile'
import { useSession } from '@/lib/session'
import type { DataLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const PROMISES: { icon: LucideIcon; text: string }[] = [
  { icon: Sunrise, text: '15-second morning check-in' },
  { icon: Search, text: 'Low energy? We look for causes in your data' },
  { icon: FlaskConical, text: 'Try one safe change for 7 days' },
  { icon: Stethoscope, text: 'Still tired? See your doctor well prepared' },
]

const OTHER = 'Other'
const MIN_SLEEP = 4
const MAX_SLEEP = 11

// Welcome, then five quick taps-only steps that open the user's "case file": goal, sports,
// training rhythm, sleep and the week around it, and what they track with (this sets the data
// level). The detective mascot reacts to each answer. Under a minute; "Other" takes free text.
export function OnboardingScreen() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const [goal, setGoal] = useState<string | null>(GOALS.some((g) => g.label === session.goal) ? session.goal : null)
  const [goalOther, setGoalOther] = useState('')
  const [sports, setSports] = useState<string[]>(session.sports.filter((s) => SPORTS.some((o) => o.label === s)))
  const [sportOther, setSportOther] = useState<string | null>(null) // null = "Other" not picked
  const [perWeek, setPerWeek] = useState<PerWeek | null>(session.profile?.perWeek ?? null)
  const [minutes, setMinutes] = useState<Minutes | null>(session.profile?.minutes ?? null)
  const [level, setLevel] = useState<Level | null>(session.profile?.level ?? null)
  const [sleep, setSleep] = useState(session.profile?.sleep ?? 7)
  const [context, setContext] = useState<string[]>(session.profile?.context ?? [])
  const [contextOther, setContextOther] = useState<string | null>(null)
  const [device, setDevice] = useState<Device | null>(session.profile?.device ?? null)
  const [brand, setBrand] = useState<string | null>(session.profile?.brand ?? null)
  const [brandOther, setBrandOther] = useState('')

  const goalValue = goal === OTHER ? goalOther.trim() : goal
  const allSports = [...sports, ...(sportOther?.trim() ? [sportOther.trim()] : [])]
  const allContext = [...context, ...(contextOther?.trim() ? [contextOther.trim()] : [])]
  const brandValue = device !== 'watch' ? null : brand === OTHER ? brandOther.trim() || null : brand
  const dataLevel: DataLevel = DEVICES.find((d) => d.id === device)?.level ?? 'basic'

  const finish = () => {
    update({
      onboarded: true,
      goal: goalValue || null,
      sports: allSports,
      dataLevel,
      profile: { perWeek, minutes, level, sleep, context: allContext, device, brand: brandValue },
    })
    navigate('/check-in')
  }

  // As on the check-in: a new step starts at the top, and keyboard and screen-reader focus moves
  // to its heading, so the new question is read out and Tab continues from there. Not on the
  // first load (the ref also keeps React's dev double-run from focusing it).
  const heading = useRef<HTMLHeadingElement>(null)
  const shownStep = useRef(step)
  useEffect(() => {
    if (shownStep.current === step) return
    shownStep.current = step
    heading.current?.closest('[data-phone-scroll]')?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [step])

  if (step === 0) {
    return (
      <div className="flex min-h-full flex-col px-6 pt-14">
        <AnimatedLogo className="self-center" />
        <h1 ref={heading} tabIndex={-1} className="mt-10 text-3xl font-semibold leading-tight tracking-tight outline-none">
          Find out why you're tired.
        </h1>
        <ul className="mt-6 space-y-4">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-coral-50 ring-1 ring-coral-500/30">
                <Icon aria-hidden className="size-5 text-coral-700" />
              </span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-start gap-2.5 text-muted-foreground">
          <Lock aria-hidden className="mt-1 size-4 shrink-0" />
          No account. Your history is stored only in this browser.
        </p>
        {/* Sticky, so "Get started" stays in view where the welcome is taller than the screen
            (720p projectors, small phones), with a short fade above it for the text scrolling
            underneath. On taller screens it simply sits at the bottom. */}
        <StickyFooter wide>
          <PrimaryButton onClick={() => setStep(1)}>Get started</PrimaryButton>
          <p className="mt-3 text-center text-sm text-muted-foreground">Takes under a minute. No diagnoses.</p>
        </StickyFooter>
      </div>
    )
  }

  const goalReply = GOALS.find((g) => g.label === goal)?.reply
  const steps: { title: string; hint: string; say: string; done: boolean; body: ReactNode }[] = [
    {
      title: 'What brings you here?',
      hint: 'Pick one.',
      say: goal === OTHER ? 'Noted. Every case is different.' : (goalReply ?? 'Every case starts with a goal.'),
      done: !!goalValue && goalValue.length >= 2,
      body: (
        <>
          <ChoiceGroup label="Your goal" className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <Tile key={g.label} emoji={g.emoji} label={g.label} selected={goal === g.label} onClick={() => setGoal(g.label)} />
            ))}
            <Tile wide span emoji="✏️" label={OTHER} selected={goal === OTHER} onClick={() => setGoal(OTHER)} />
          </ChoiceGroup>
          {goal === OTHER && (
            <OtherInput label="Your goal" value={goalOther} onChange={setGoalOther} placeholder="e.g. Sleep better before matches" />
          )}
        </>
      ),
    },
    {
      title: 'Which sports do you do?',
      hint: 'Pick all that apply.',
      say:
        allSports.length >= 3
          ? `${allSports.length} sports? Busy schedule!`
          : allSports.length > 0
            ? 'Got it. Every session counts.'
            : 'Tell me what you train.',
      done: allSports.length > 0,
      body: (
        <>
          <ChoiceGroup multiple label="Your sports" className="grid grid-cols-3 gap-2.5">
            {SPORTS.map((s) => (
              <Tile
                key={s.label}
                compact
                multiple
                emoji={s.emoji}
                label={s.label}
                selected={sports.includes(s.label)}
                onClick={() => setSports(toggle(sports, s.label))}
              />
            ))}
            <Tile
              wide
              span
              multiple
              emoji="✏️"
              label={OTHER}
              selected={sportOther !== null}
              onClick={() => setSportOther(sportOther === null ? '' : null)}
            />
          </ChoiceGroup>
          {sportOther !== null && (
            <OtherInput label="Your sport" value={sportOther} onChange={setSportOther} placeholder="e.g. Rowing" />
          )}
        </>
      ),
    },
    {
      title: 'How do you train?',
      hint: 'A usual week is fine.',
      say:
        perWeek === '5-6' || perWeek === '7+'
          ? 'That’s a lot of training. Recovery will matter.'
          : perWeek && minutes && level
            ? 'Nice rhythm. I’ll learn your usual week.'
            : 'Your usual week sets my baseline.',
      done: !!perWeek && !!minutes && !!level,
      body: (
        <div className="space-y-5">
          <Field label="Sessions per week">
            <ChoiceGroup label="Sessions per week" className="grid grid-cols-4 gap-2">
              {PER_WEEK.map((o) => (
                <Chip key={o.id} selected={perWeek === o.id} onClick={() => setPerWeek(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </ChoiceGroup>
          </Field>
          <Field label="A usual session">
            <ChoiceGroup label="A usual session" className="grid grid-cols-2 gap-2">
              {MINUTES.map((o) => (
                <Chip key={o.id} selected={minutes === o.id} onClick={() => setMinutes(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </ChoiceGroup>
          </Field>
          <Field label="How seriously?">
            <ChoiceGroup label="How seriously" className="grid grid-cols-3 gap-2.5">
              {LEVELS.map((o) => (
                <Tile key={o.id} compact emoji={o.emoji} label={o.label} selected={level === o.id} onClick={() => setLevel(o.id)} />
              ))}
            </ChoiceGroup>
          </Field>
        </div>
      ),
    },
    {
      title: 'Your week outside sport',
      hint: 'Sleep and life change how tired you feel.',
      say: context.includes('Night shifts')
        ? 'Night shifts shake up sleep. Noted.'
        : context.includes('Exams soon')
          ? 'Exams drain energy. Good to know.'
          : sleep < 7
            ? `${formatHours(sleep)} h is on the short side. Noted.`
            : 'Life outside sport counts too.',
      done: contextOther === null || contextOther.trim().length >= 2,
      body: (
        <div className="space-y-5">
          <Field label="Usual sleep on a normal night">
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-card p-4 ring-1 ring-border">
              <StepButton label="Half an hour less" disabled={sleep <= MIN_SLEEP} onClick={() => setSleep(sleep - 0.5)}>
                <Minus aria-hidden />
              </StepButton>
              <output aria-live="polite" className="text-4xl font-bold tabular-nums tracking-tight">
                {formatHours(sleep)}
                <span className="ml-1 text-xl font-medium text-muted-foreground">h</span>
              </output>
              <StepButton label="Half an hour more" disabled={sleep >= MAX_SLEEP} onClick={() => setSleep(sleep + 0.5)}>
                <Plus aria-hidden />
              </StepButton>
            </div>
          </Field>
          <Field label="What else fills your week?" hint="Optional. Pick any.">
            <ChoiceGroup multiple label="What else fills your week" className="flex flex-wrap gap-2">
              {CONTEXT.map((o) => (
                <Chip key={o.label} multiple selected={context.includes(o.label)} onClick={() => setContext(toggle(context, o.label))}>
                  <span aria-hidden>{o.emoji}</span> {o.label}
                </Chip>
              ))}
              <Chip multiple selected={contextOther !== null} onClick={() => setContextOther(contextOther === null ? '' : null)}>
                <span aria-hidden>✏️</span> {OTHER}
              </Chip>
            </ChoiceGroup>
            {contextOther !== null && (
              <OtherInput label="What else" value={contextOther} onChange={setContextOther} placeholder="e.g. Volunteering" />
            )}
          </Field>
        </div>
      ),
    },
    {
      title: 'What do you track with?',
      hint: 'This sets how much data the detective can use.',
      say: DEVICES.find((d) => d.id === device)?.reply ?? 'Last clue: what can I measure?',
      done: device !== null && (device !== 'watch' || brand !== OTHER || brandOther.trim().length >= 2),
      body: (
        <div className="space-y-5">
          <ChoiceGroup label="What you track with" className="grid gap-2.5">
            {DEVICES.map((d) => (
              <Tile key={d.id} wide emoji={d.emoji} label={d.label} selected={device === d.id} onClick={() => setDevice(d.id)} />
            ))}
          </ChoiceGroup>
          {device === 'watch' && (
            <Field label="Which one?" hint="Optional.">
              <ChoiceGroup label="Which watch" className="flex flex-wrap gap-2">
                {[...BRANDS, OTHER].map((b) => (
                  <Chip key={b} selected={brand === b} onClick={() => setBrand(brand === b ? null : b)}>
                    {b}
                  </Chip>
                ))}
              </ChoiceGroup>
              {brand === OTHER && (
                <OtherInput label="Your watch" value={brandOther} onChange={setBrandOther} placeholder="e.g. Coros" />
              )}
            </Field>
          )}
          {device && <DataMeter level={dataLevel} />}
        </div>
      ),
    },
  ]

  // The last step is the reveal: the case file built from the answers.
  if (step > steps.length) {
    return (
      <div className="flex min-h-full flex-col px-5 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} aria-label="Back">
            <ArrowLeft aria-hidden />
            Back
          </Button>
        </div>
        <CaseFile
          heading={heading}
          goal={goalValue ?? ''}
          sports={allSports}
          rhythm={[PER_WEEK.find((o) => o.id === perWeek)?.en, MINUTES.find((o) => o.id === minutes)?.label, LEVELS.find((o) => o.id === level)?.label]}
          sleep={sleep}
          context={allContext}
          device={DEVICES.find((d) => d.id === device)?.label ?? ''}
          brand={brandValue}
          dataLevel={dataLevel}
        />
        <StickyFooter>
          <PrimaryButton onClick={finish}>Start my first check-in</PrimaryButton>
          <p className="mt-3 text-center text-sm text-muted-foreground">5 taps, 15 seconds. Then today’s advice.</p>
        </StickyFooter>
      </div>
    )
  }

  const current = steps[step - 1]
  return (
    <div className="flex min-h-full flex-col px-5 pt-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} aria-label="Back">
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          Step {step} of {steps.length}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {steps.map((_, i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < step ? 'bg-coral-500' : 'bg-navy-100')}
          />
        ))}
      </div>

      <Mascot say={current.say} />
      <h1 ref={heading} tabIndex={-1} className="mt-4 text-2xl font-semibold leading-tight tracking-tight outline-none">
        {current.title}
      </h1>
      <p className="mt-1 text-muted-foreground">{current.hint}</p>
      <div className="mt-5">{current.body}</div>

      <StickyFooter>
        <PrimaryButton disabled={!current.done} onClick={() => setStep(step + 1)}>
          {step === steps.length ? 'Open my case file' : 'Continue'}
        </PrimaryButton>
      </StickyFooter>
    </div>
  )
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
const formatHours = (hours: number) => (Number.isInteger(hours) ? String(hours) : hours.toFixed(1))

// The screen's one action stays in view while the options scroll underneath it. `wide` matches
// the welcome's wider side padding.
function StickyFooter({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('sticky bottom-0 mt-auto bg-app/95 pb-6 pt-4 backdrop-blur', wide ? '-mx-6 px-6' : '-mx-5 px-5')}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-8 bg-linear-to-t from-app to-transparent" />
      {children}
    </div>
  )
}

// The detective reacts to each answer in a speech bubble.
function Mascot({ say }: { say: string }) {
  return (
    <div className="mt-5 flex items-end gap-2.5">
      <LogoCharacter className="w-14 shrink-0" />
      <p
        key={say}
        aria-live="polite"
        className="relative rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 font-medium shadow-sm ring-1 ring-border motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2"
      >
        {say}
      </p>
    </div>
  )
}

function Tile({
  emoji,
  label,
  selected,
  onClick,
  multiple = false,
  compact = false,
  wide = false,
  span = false,
}: {
  emoji: string
  label: string
  selected: boolean
  onClick: () => void
  multiple?: boolean
  compact?: boolean
  wide?: boolean
  span?: boolean // fill the whole grid row ("Other" under the grid of options)
}) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'relative rounded-2xl bg-card text-left ring-1 ring-border transition hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2',
        compact && 'flex min-h-23 flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-center',
        wide && 'flex min-h-16 items-center gap-3 px-4 py-3',
        span && 'col-span-full',
        !compact && !wide && 'flex min-h-26 flex-col justify-between gap-2 p-4',
        selected && 'bg-coral-50 ring-2 ring-coral-500 hover:bg-coral-50 motion-safe:animate-in motion-safe:zoom-in-95',
      )}
    >
      <span aria-hidden className={cn('leading-none', compact ? 'text-3xl' : 'text-[2rem]')}>
        {emoji}
      </span>
      <span className={cn('font-semibold leading-snug', compact && 'text-sm leading-tight', wide && 'flex-1')}>{label}</span>
      {selected && (
        <span
          aria-hidden
          className={cn(
            'grid size-6 place-items-center rounded-full bg-coral-500 text-navy-900',
            wide ? 'shrink-0' : 'absolute right-2 top-2',
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

function Chip({
  children,
  selected,
  onClick,
  multiple = false,
}: {
  children: ReactNode
  selected: boolean
  onClick: () => void
  multiple?: boolean
}) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-card px-4 py-2 font-medium ring-1 ring-border transition hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2',
        selected && 'bg-coral-50 ring-2 ring-coral-500 hover:bg-coral-50',
      )}
    >
      {children}
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-semibold">
        {label}
        {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
      </p>
      {children}
    </div>
  )
}

function OtherInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input
        autoFocus
        value={value}
        maxLength={40}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl bg-card px-4 text-base ring-1 ring-border placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-700"
      />
    </label>
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
      className="grid size-12 place-items-center rounded-full bg-navy-50 text-navy-900 ring-1 ring-border hover:bg-navy-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  )
}

// The three data levels as a meter: the chosen device fills its level and the ones below, and
// each level says what it adds (with a check, so it never relies on colour alone).
function DataMeter({ level }: { level: DataLevel }) {
  const reached = DATA_LEVELS.findIndex((l) => l.level === level)
  return (
    <section aria-label={`Data level: ${DATA_LEVELS[reached].label}`} className="rounded-3xl bg-navy-900 p-5 text-white">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-coral-500">Data level</span>
        <span className="text-xl font-semibold">{DATA_LEVELS[reached].label}</span>
      </p>
      <div aria-hidden className="mt-3 flex gap-1.5">
        {DATA_LEVELS.map((l, i) => (
          <span
            key={l.level}
            className={cn('h-2.5 flex-1 rounded-full transition-colors duration-300', i <= reached ? 'bg-coral-500' : 'bg-white/15')}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {DATA_LEVELS.map((l, i) => {
          const on = i <= reached
          return (
            <li key={l.level} className={cn('flex gap-2.5', !on && 'text-navy-300')}>
              {on ? (
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-coral-500" strokeWidth={3} />
              ) : (
                <Minus aria-hidden className="mt-0.5 size-5 shrink-0" />
              )}
              <span>
                <span className="font-semibold">{l.label}:</span> {l.adds}
                <span className="sr-only">{on ? ' (included)' : ' (not included)'}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-navy-100">Less data means lower confidence, and the app always says so.</p>
    </section>
  )
}

// The reveal at the end: every answer on one card, stamped like the detective's other files.
function CaseFile({
  heading,
  goal,
  sports,
  rhythm,
  sleep,
  context,
  device,
  brand,
  dataLevel,
}: {
  heading: RefObject<HTMLHeadingElement | null>
  goal: string
  sports: string[]
  rhythm: (string | undefined)[]
  sleep: number
  context: string[]
  device: string
  brand: string | null
  dataLevel: DataLevel
}) {
  const emojiFor = (label: string) => SPORTS.find((s) => s.label === label)?.emoji ?? '🏅'
  // Each row is a few short parts; a short part never breaks across lines ("30–60 min" stays
  // whole), while long free text from "Other" still wraps.
  const rows: { emoji: string; label: string; parts: string[] }[] = [
    { emoji: '🎯', label: 'Goal', parts: [goal] },
    { emoji: emojiFor(sports[0] ?? ''), label: 'Sports', parts: sports },
    { emoji: '📅', label: 'Training', parts: rhythm.filter((part): part is string => !!part) },
    { emoji: '😴', label: 'Sleep', parts: [`About ${formatHours(sleep)} h a night`] },
    ...(context.length > 0 ? [{ emoji: '🗓️', label: 'Also', parts: context }] : []),
    {
      emoji: DEVICES.find((d) => d.label === device)?.emoji ?? '📝',
      label: 'Data',
      parts: [brand ?? device, `${DATA_LEVELS.find((l) => l.level === dataLevel)?.label} data`],
    },
  ]
  return (
    <section aria-labelledby="case-file" className="mt-4">
      <div className="flex flex-col items-center text-center">
        <LogoCharacter scanning className="w-24" />
        <h1
          ref={heading}
          id="case-file"
          tabIndex={-1}
          className="mt-3 text-2xl font-semibold leading-tight tracking-tight outline-none"
        >
          Your case file is open
        </h1>
        <p className="mt-1 text-muted-foreground">Everything the detective starts with.</p>
      </div>
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <span
          aria-hidden
          className="absolute right-4 top-4 rotate-[-8deg] rounded-md border-2 border-coral-500 px-2 py-0.5 text-sm font-black uppercase tracking-[0.16em] text-coral-500"
        >
          Opened
        </span>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-coral-500">Case file #001</p>
        <dl className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-3">
              <dt className="flex w-24 shrink-0 items-center gap-2 text-navy-100">
                <span aria-hidden>{row.emoji}</span>
                {row.label}
              </dt>
              <dd className="min-w-0 font-medium">
                {row.parts.map((part, i) => (
                  <span key={part}>
                    {i > 0 && (row.label === 'Sports' || row.label === 'Also' ? ', ' : ' · ')}
                    <span className={part.length <= 18 ? 'whitespace-nowrap' : undefined}>{part}</span>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
