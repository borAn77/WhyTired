import { useState } from 'react'
import { ArrowLeft, Check, FlaskConical, Search, Stethoscope, Sunrise, Watch, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AnimatedLogo } from '@/components/AnimatedLogo'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const GOALS = ['Feel less tired', 'Train for a race', 'Get stronger', 'Stay consistent']
const SPORTS = ['Running', 'Gym', 'Team sports', 'Cycling', 'Swimming', 'Other']

const PROMISES: { icon: LucideIcon; text: string }[] = [
  { icon: Sunrise, text: 'A 15-second check-in each morning' },
  { icon: Search, text: 'When your energy stays low, we look for the cause in your own data' },
  { icon: FlaskConical, text: 'You try one safe change for 7 days' },
  { icon: Stethoscope, text: "If it doesn't help, you see your doctor well prepared" },
]

// Under a minute: welcome, then three questions. The watch answer sets the data level.
export function OnboardingScreen() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<string | null>(session.goal)
  const [sports, setSports] = useState<string[]>(session.sports)
  const [hasWatch, setHasWatch] = useState<boolean | null>(null)

  const finish = () => {
    update({ onboarded: true, goal, sports, dataLevel: hasWatch ? 'full' : 'basic' })
    navigate('/check-in')
  }

  if (step === 0) {
    return (
      <div className="flex min-h-full flex-col px-6 pb-6 pt-14">
        <AnimatedLogo className="self-center" />
        <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight">Find out why you're tired.</h1>
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
        <div className="mt-auto pt-8">
          <PrimaryButton onClick={() => setStep(1)}>Get started</PrimaryButton>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Takes under a minute. WhyTired gives no diagnoses.
          </p>
        </div>
      </div>
    )
  }

  const steps = [
    {
      title: "What's your main goal?",
      hint: 'Pick one.',
      done: goal !== null,
      body: (
        <Choices options={GOALS} isSelected={(option) => goal === option} onToggle={setGoal} />
      ),
    },
    {
      title: 'Which sports do you do?',
      hint: 'Pick all that apply.',
      done: sports.length > 0,
      body: (
        <Choices
          options={SPORTS}
          multiple
          isSelected={(option) => sports.includes(option)}
          onToggle={(option) =>
            setSports(sports.includes(option) ? sports.filter((s) => s !== option) : [...sports, option])
          }
        />
      ),
    },
    {
      title: 'Do you wear a smartwatch or fitness tracker?',
      hint: 'This decides how much data we can use.',
      done: hasWatch !== null,
      body: (
        <div className="space-y-3">
          <Choices
            options={['Yes, I wear one', "No, I don't"]}
            isSelected={(option) => (option.startsWith('Yes') ? hasWatch === true : hasWatch === false)}
            onToggle={(option) => setHasWatch(option.startsWith('Yes'))}
          />
          {hasWatch !== null && (
            <p className="flex gap-2.5 rounded-xl bg-navy-50 p-4">
              <Watch aria-hidden className="mt-0.5 size-5 shrink-0 text-navy-500" />
              <span>
                {hasWatch
                  ? 'Great: besides your check-ins we can use resting heart rate, HRV and sleep from your watch.'
                  : "No problem. We'll use your check-ins and the sessions you log. Findings will show lower confidence, and that's shown honestly."}
              </span>
            </p>
          )}
        </div>
      ),
    },
  ]
  const current = steps[step - 1]
  const last = step === steps.length

  return (
    <div className="flex min-h-full flex-col px-6 pb-6 pt-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} aria-label="Back">
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          Question {step} of {steps.length}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {steps.map((_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < step ? 'bg-coral-500' : 'bg-navy-100')} />
        ))}
      </div>
      <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight">{current.title}</h1>
      <p className="mt-1 text-muted-foreground">{current.hint}</p>
      <div className="mt-6">{current.body}</div>
      <div className="mt-auto pt-8">
        <PrimaryButton disabled={!current.done} onClick={() => (last ? finish() : setStep(step + 1))}>
          {last ? 'Start my first check-in' : 'Continue'}
        </PrimaryButton>
      </div>
    </div>
  )
}

function Choices({
  options,
  isSelected,
  onToggle,
  multiple = false,
}: {
  options: string[]
  isSelected: (option: string) => boolean
  onToggle: (option: string) => void
  multiple?: boolean
}) {
  return (
    <div role={multiple ? 'group' : 'radiogroup'} className="grid gap-3">
      {options.map((option) => {
        const selected = isSelected(option)
        return (
          <button
            key={option}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={selected}
            onClick={() => onToggle(option)}
            className={cn(
              'flex min-h-14 items-center justify-between rounded-xl bg-card px-4 text-left text-base font-medium ring-1 ring-border transition',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
              selected && 'bg-coral-50 ring-2 ring-coral-500',
            )}
          >
            {option}
            {selected && <Check aria-hidden className="size-5 text-coral-700" />}
          </button>
        )
      })}
    </div>
  )
}
