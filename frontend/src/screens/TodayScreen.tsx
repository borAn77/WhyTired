import { useEffect, useState } from 'react'
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
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { CluePattern, DayComplete, DetectiveRadar, ProgressCard, XpPill, XpToast } from '@/components/progress'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { ErrorState, LoadingState } from '@/components/states'
import { api } from '@/lib/api'
import { cluePattern } from '@/lib/clues'
import { daysBetween } from '@/lib/dates'
import { XP, levelFor, totalXp } from '@/lib/progress'
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

// What "done" means per recommendation. A rest day earns the same XP as a hard day.
const DONE_LABEL: Record<Recommendation, string> = {
  hard: 'Training done',
  easy: 'Easy day done',
  rest: 'Rest day done',
}

function Today() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const request: CoachRequest = { ...toCtx(session), planned_session: null }
  const coach = useApi(`coach:${JSON.stringify(request)}`, () => api.coach(request))
  const personas = useApi('personas', () => api.personas())
  const name = personas.data?.find((persona) => persona.id === session.personaId)?.name
  const result = coach.data

  // The radar needs the low-energy streak, which only the detective returns. It is only asked
  // when detective mode is not triggered, so this call never runs the LLM explanation.
  // Today counts as checked in only when the user answered in the app. The synthetic data has
  // check-ins for almost every day, but every new morning should ask again.
  const checkedIn = !!session.checkins[session.today]
  const needsRadar = checkedIn && !!result && !result.detective_triggered
  const radar = useApi(`radar:${needsRadar}:${JSON.stringify(request)}`, () =>
    needsRadar ? api.detective(toCtx(session)) : Promise.resolve(null),
  )

  const [levelUp, setLevelUp] = useState<string | null>(null)
  const [toast, setToast] = useState(() => (location.state as { gained?: string } | null)?.gained ?? null)
  useEffect(() => {
    if (!toast) return
    // Clear the router state so a reload doesn't show the reward again.
    navigate('.', { replace: true, state: null })
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast, navigate])

  const experimentDay = session.experiment ? daysBetween(session.experiment.start, session.today) + 1 : null
  const doneToday = session.done[session.today]
  const pattern = cluePattern(session)

  const markDone = () => {
    if (!result) return
    const before = levelFor(totalXp(session))
    const next = { ...session, done: { ...session.done, [session.today]: result.recommendation } }
    const after = levelFor(totalXp(next))
    setLevelUp(after.number > before.number ? after.name : null)
    update({ done: next.done })
  }

  let footer = null
  if (!checkedIn)
    footer = (
      <PrimaryButton onClick={() => navigate('/check-in')}>
        <Sunrise aria-hidden />
        Start my check-in
        <XpPill amount={XP.checkin} />
      </PrimaryButton>
    )
  else if (result?.detective_triggered && !session.experiment)
    footer = (
      <PrimaryButton onClick={() => navigate('/detective')}>
        <Search aria-hidden />
        Find out why
      </PrimaryButton>
    )
  else if (session.experiment)
    footer = (
      <PrimaryButton onClick={() => navigate('/experiment')}>
        <FlaskConical aria-hidden />
        Open my experiment
      </PrimaryButton>
    )
  else if (result && !doneToday)
    footer = (
      <PrimaryButton onClick={markDone}>
        <CircleCheck aria-hidden />
        {DONE_LABEL[result.recommendation]}
        <XpPill amount={XP.done} />
      </PrimaryButton>
    )

  return (
    <Screen footer={footer}>
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning{name ? `, ${name}` : ''}</h1>
        {session.goal && <p className="mt-1 text-muted-foreground">Your goal: {session.goal.toLowerCase()}</p>}
      </section>

      <ProgressCard session={session} />
      {toast && (
        <XpToast text={toast === 'closed' ? `+${XP.closed} XP: case closed!` : `+${XP.checkin} XP: check-in done`} />
      )}

      {checkedIn && coach.loading && <LoadingState label="Getting today's advice" />}
      {checkedIn && coach.error ? (
        <ErrorState
          title="We couldn't load today's advice"
          message="The server may be waking up, which takes up to a minute."
          onRetry={coach.retry}
        />
      ) : null}

      {!checkedIn && (
        <section className="rounded-3xl bg-card p-5 ring-1 ring-border">
          <Sunrise aria-hidden className="size-7 text-coral-700" />
          <h2 className="mt-2 text-xl font-semibold">How are you this morning?</h2>
          <p className="mt-1 text-muted-foreground">5 taps, 15 seconds. Then you get today's advice.</p>
        </section>
      )}

      {doneToday && !session.experiment && <DayComplete levelUp={levelUp} />}

      {checkedIn && result && (
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

      {checkedIn && pattern && <CluePattern clue={pattern.clue} count={pattern.count} />}

      {checkedIn && result && !session.experiment && (result.detective_triggered || radar.data) && (
        <DetectiveRadar lowDays={radar.data?.low_energy_days ?? 0} triggered={result.detective_triggered} />
      )}

      {session.experiment && experimentDay !== null && (
        <section className="flex gap-3 rounded-3xl bg-card p-5 ring-1 ring-border">
          <FlaskConical aria-hidden className="mt-0.5 size-6 shrink-0 text-coral-700" />
          <div>
            <h2 className="font-semibold">
              {experimentDay < 1
                ? 'Your mission starts tomorrow'
                : experimentDay <= session.experiment.days
                  ? `Mission: day ${experimentDay} of ${session.experiment.days}`
                  : 'Your mission is finished'}
            </h2>
            <p className="mt-0.5 text-muted-foreground">
              {experimentDay > session.experiment.days ? 'See whether it helped.' : 'Keep checking in each morning.'}
            </p>
          </div>
        </section>
      )}

      {checkedIn && result && result.recommendation !== 'rest' && !doneToday && <PlannedSession />}
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
