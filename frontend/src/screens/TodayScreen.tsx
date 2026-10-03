import { useState } from 'react'
import {
  BedDouble,
  CircleCheck,
  FlaskConical,
  Footprints,
  Pencil,
  Search,
  Sunrise,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { ErrorState, LoadingState } from '@/components/states'
import { api } from '@/lib/api'
import { daysBetween } from '@/lib/dates'
import { toCtx, useSession } from '@/lib/session'
import type { CoachRequest, Recommendation } from '@/lib/types'
import { useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

// Never color alone: every recommendation has an icon and a written title.
const ADVICE: Record<Recommendation, { title: string; detail: string; icon: LucideIcon; card: string; badge: string }> = {
  hard: {
    title: 'Hard training is fine',
    detail: 'Go for your planned session.',
    icon: Zap,
    card: 'bg-green-50 ring-green-700/30',
    badge: 'bg-green-700',
  },
  easy: {
    title: 'Keep it easy today',
    detail: 'Short and light: effort 5 out of 10 or lower.',
    icon: Footprints,
    card: 'bg-amber-50 ring-amber-800/30',
    badge: 'bg-amber-800',
  },
  rest: {
    title: 'Rest today',
    detail: 'No training today. A short walk is fine.',
    icon: BedDouble,
    card: 'bg-navy-50 ring-navy-900/20',
    badge: 'bg-navy-900',
  },
}

const DURATIONS = [30, 45, 60, 90, 120]

export function TodayScreen() {
  const { session } = useSession()
  if (!session.onboarded) return <Navigate to="/onboarding" replace />
  return <Today />
}

function Today() {
  const { session } = useSession()
  const navigate = useNavigate()
  const request: CoachRequest = { ...toCtx(session), planned_session: null }
  const coach = useApi(`coach:${JSON.stringify(request)}`, () => api.coach(request))
  const personas = useApi('personas', () => api.personas())
  const name = personas.data?.find((persona) => persona.id === session.personaId)?.name

  const experimentDay = session.experiment ? daysBetween(session.experiment.start, session.today) + 1 : null
  const result = coach.data

  let primary: { label: string; to: string; icon: LucideIcon } | null = null
  if (result && !result.has_checkin) primary = { label: 'Start my check-in', to: '/check-in', icon: Sunrise }
  else if (result?.detective_triggered && !session.experiment)
    primary = { label: 'Find out why', to: '/detective', icon: Search }
  else if (session.experiment) primary = { label: 'Open my experiment', to: '/experiment', icon: FlaskConical }

  return (
    <Screen
      footer={
        primary && (
          <PrimaryButton onClick={() => navigate(primary.to)}>
            <primary.icon aria-hidden />
            {primary.label}
          </PrimaryButton>
        )
      }
    >
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning{name ? `, ${name}` : ''}</h1>
        {session.goal && <p className="mt-1 text-muted-foreground">Your goal: {session.goal.toLowerCase()}</p>}
      </section>

      {coach.loading && <LoadingState label="Getting today's advice" />}
      {coach.error ? (
        <ErrorState
          title="We couldn't load today's advice"
          message="The server may be waking up, which takes up to a minute."
          onRetry={coach.retry}
        />
      ) : null}

      {result && !result.has_checkin && (
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <Sunrise aria-hidden className="size-7 text-coral-700" />
          <h2 className="mt-2 text-xl font-semibold">How are you this morning?</h2>
          <p className="mt-1 text-muted-foreground">Take the 15-second check-in to get today's advice.</p>
        </section>
      )}

      {result?.has_checkin && (
        <>
          <AdviceCard recommendation={result.recommendation} reasons={result.reasons} />
          <Link
            to="/check-in"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium text-navy-700 underline-offset-4 hover:underline focus-visible:outline-2"
          >
            <Pencil aria-hidden className="size-4" />
            Change my check-in answers
          </Link>
        </>
      )}

      {result?.detective_triggered && !session.experiment && (
        <section className="rounded-2xl border-2 border-coral-500 bg-coral-50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-700">
            <Search aria-hidden className="size-4" />
            Detective mode
          </p>
          <h2 className="mt-1.5 text-xl font-semibold">Your energy has been low for several days</h2>
          <p className="mt-1">Let's look for the cause in your own data. It takes a few seconds.</p>
        </section>
      )}

      {session.experiment && experimentDay !== null && (
        <section className="flex gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
          <FlaskConical aria-hidden className="mt-0.5 size-6 shrink-0 text-coral-700" />
          <div>
            <h2 className="font-semibold">
              {experimentDay < 1
                ? 'Your experiment starts tomorrow'
                : experimentDay <= session.experiment.days
                  ? `Experiment: day ${experimentDay} of ${session.experiment.days}`
                  : 'Your experiment is finished'}
            </h2>
            <p className="mt-0.5 text-muted-foreground">
              {experimentDay > session.experiment.days ? 'See whether it helped.' : 'Keep checking in each morning.'}
            </p>
          </div>
        </section>
      )}

      {result?.has_checkin && result.recommendation !== 'rest' && <PlannedSession />}
    </Screen>
  )
}

function AdviceCard({ recommendation, reasons }: { recommendation: Recommendation; reasons: string[] }) {
  const { title, detail, icon: Icon, card, badge } = ADVICE[recommendation]
  return (
    <section className={cn('rounded-2xl p-5 ring-1', card)} aria-labelledby="advice">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today's advice</p>
      <div className="mt-2 flex items-center gap-3">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl text-white', badge)}>
          <Icon aria-hidden className="size-6" />
        </span>
        <div>
          <h2 id="advice" className="text-2xl font-semibold leading-tight">
            {title}
          </h2>
          <p className="text-muted-foreground">{detail}</p>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold">Why:</p>
      <ul className="mt-1.5 space-y-1.5">
        {reasons.map((reason) => (
          <li key={reason} className="flex gap-2">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-navy-900" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Injury check for a planned session (Frandsen et al., BJSM 2025; see engine/load.py).
function PlannedSession() {
  const { session } = useSession()
  const [minutes, setMinutes] = useState<number | null>(null)
  const request: CoachRequest = {
    ...toCtx(session),
    planned_session: minutes ? { sport: session.sports[0]?.toLowerCase() ?? 'training', duration_min: minutes } : null,
  }
  const check = useApi(`planned:${JSON.stringify(request)}`, () =>
    minutes ? api.coach(request) : Promise.resolve(null),
  )
  const warning = check.data?.injury_warning

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="font-semibold">Planning a session today?</h2>
      <p className="mt-0.5 text-muted-foreground">Pick its length and we'll check it against the last 30 days.</p>
      <div role="radiogroup" aria-label="Planned session length" className="mt-3 flex flex-wrap gap-2">
        {DURATIONS.map((duration) => (
          <button
            key={duration}
            type="button"
            role="radio"
            aria-checked={minutes === duration}
            onClick={() => setMinutes(minutes === duration ? null : duration)}
            className={cn(
              'h-11 rounded-full px-4 font-medium ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-2',
              minutes === duration ? 'bg-navy-900 text-white ring-navy-900' : 'bg-app hover:bg-navy-50',
            )}
          >
            {duration} min
          </button>
        ))}
      </div>
      {minutes && check.data && (
        <p
          role="status"
          className={cn(
            'mt-4 flex gap-2.5 rounded-xl p-4',
            warning ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700',
          )}
        >
          {warning ? (
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          ) : (
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          )}
          <span className="font-medium">
            {warning ?? `${minutes} min is within what you've done in the last 30 days.`}
          </span>
        </p>
      )}
    </section>
  )
}
