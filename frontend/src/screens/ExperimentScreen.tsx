import { FileText, RotateCcw, Stethoscope, Sunrise, Target, Trophy } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { CaseHeader, CaseStat } from '@/components/case/CaseParts'
import { MissionMap } from '@/components/case/MissionMap'
import { MiniChart } from '@/components/MiniChart'
import { PrimaryButton } from '@/components/PrimaryButton'
import { XpPill } from '@/components/progress'
import { Screen } from '@/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { adherenceFor } from '@/lib/clues'
import { addDays, formatDay } from '@/lib/dates'
import { toCtx, useSession } from '@/lib/session'
import type { Experiment, ExperimentResult } from '@/lib/types'
import { XP } from '@/lib/progress'
import { useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

export function ExperimentScreen() {
  const { session } = useSession()
  if (!session.experiment) {
    return (
      <Screen>
        <EmptyState
          title="No mission running"
          message="The detective suggests one when your energy has been low for a few days."
          action={
            <Button asChild>
              <Link to="/detective">Open detective mode</Link>
            </Button>
          }
        />
      </Screen>
    )
  }
  return <ExperimentStatus experiment={session.experiment} />
}

function ExperimentStatus({ experiment }: { experiment: Experiment }) {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const ctx = toCtx(session, { experiment })
  const { data, error, loading, retry } = useApi(`experiment:${JSON.stringify(ctx)}`, () => api.experiment(ctx))

  const stop = () => {
    update({ experiment: null })
    navigate('/')
  }
  const closeCase = () => {
    update({ experiment: null, closed: [...session.closed, session.today] })
    navigate('/', { state: { gained: 'closed' } })
  }
  const restart = () => update({ experiment: { ...experiment, start: addDays(session.today, 1) } })

  const checkedIn = !!session.checkins[session.today]
  let footer = null
  if (data?.status === 'running' && data.day > 0 && !checkedIn)
    footer = (
      <PrimaryButton onClick={() => navigate('/check-in')}>
        <Sunrise aria-hidden />
        Start today’s check-in
        <XpPill amount={XP.checkin} />
      </PrimaryButton>
    )
  else if (data?.status === 'not_improved')
    footer = (
      <PrimaryButton onClick={() => navigate('/summary')}>
        <FileText aria-hidden />
        Prepare my doctor summary
      </PrimaryButton>
    )
  else if (data?.status === 'improved')
    footer = (
      <PrimaryButton onClick={closeCase}>
        <Trophy aria-hidden />
        Keep the change
        <XpPill amount={XP.closed} />
      </PrimaryButton>
    )
  else if (data?.status === 'not_enough_data')
    footer = (
      <PrimaryButton onClick={restart}>
        <RotateCcw aria-hidden />
        Try again from tomorrow
      </PrimaryButton>
    )

  const finished = data && data.status !== 'running'
  const answers = data
    ? Array.from({ length: data.days_total }, (_, i) => adherenceFor(session, experiment.start, i + 1)).filter(Boolean)
    : []
  const stuck = answers.filter((a) => a === 'yes').length

  return (
    <Screen footer={footer}>
      <CaseHeader
        title={data?.title ?? 'Your mission'}
        step={finished ? 4 : 2}
        stats={
          data && (
            <>
              <CaseStat value={data.status === 'running' ? `${data.day}/${data.days_total}` : `${data.days_total}/${data.days_total}`} label="mission days" />
              <CaseStat value={data.checkins_logged} label="check-ins" />
              {answers.length > 0 ? (
                <CaseStat value={stuck} label="days stuck to it" />
              ) : (
                <CaseStat value={data.energy_during ?? '–'} label="energy now" />
              )}
            </>
          )
        }
      />
      <p className="-mt-2 text-center text-sm text-muted-foreground">
        {formatDay(experiment.start)} – {formatDay(addDays(experiment.start, experiment.days - 1))}
      </p>

      {loading && <LoadingState label="Checking your mission" />}
      {error ? <ErrorState onRetry={retry} /> : null}
      {data && (
        <>
          {data.status === 'running' ? (
            <RunningCard result={data} checkedIn={checkedIn} />
          ) : (
            <Verdict result={data} />
          )}
          <MissionMap result={data} experiment={experiment} />
          {data.chart && data.chart.points.length > 1 && (
            <section className="rounded-3xl bg-card p-5 ring-1 ring-border">
              <MiniChart
                chart={data.chart}
                title="Your energy, before and during"
                caption="Dashed line = your energy in the 5 days before the mission."
              />
            </section>
          )}
          {data.status === 'running' && (
            <Button variant="ghost" className="h-11 w-full" onClick={stop}>
              Stop the mission
            </Button>
          )}
        </>
      )}
    </Screen>
  )
}

function RunningCard({ result, checkedIn }: { result: ExperimentResult; checkedIn: boolean }) {
  const waiting = result.day > 0 && !checkedIn
  return (
    <section className="flex items-start gap-3 rounded-3xl bg-coral-50 p-5 ring-1 ring-coral-500/40">
      {waiting ? (
        <Sunrise aria-hidden className="mt-0.5 size-6 shrink-0 text-coral-700" />
      ) : (
        <Target aria-hidden className="mt-0.5 size-6 shrink-0 text-coral-700" />
      )}
      <div>
        <p className="text-lg font-semibold">
          {result.day === 0 ? 'Starts tomorrow' : waiting ? `Day ${result.day}: check in first` : 'Keep going'}
        </p>
        <p className="mt-0.5">
          {waiting
            ? `Your morning check-in is still open.${result.day >= 2 ? ' It starts with a quick mission check.' : ''}`
            : result.summary}
        </p>
      </div>
    </section>
  )
}

const VERDICTS = {
  improved: {
    stamp: 'Case closed',
    title: 'Mystery solved',
    icon: Trophy,
    card: 'bg-green-50 ring-green-700/30',
    stampColor: 'border-green-700 text-green-700',
    note: 'Keep the change. You found what was draining you.',
  },
  not_improved: {
    stamp: 'To your doctor',
    title: 'No clear improvement',
    icon: Stethoscope,
    card: 'bg-navy-50 ring-navy-900/20',
    stampColor: 'border-coral-700 text-coral-700',
    note: 'You did the right thing: you tried a safe change first. Your doctor now gets a one-page summary instead of a guess.',
  },
  not_enough_data: {
    stamp: 'On hold',
    title: 'Not enough check-ins',
    icon: RotateCcw,
    card: 'bg-navy-50 ring-navy-900/20',
    stampColor: 'border-navy-700 text-navy-700',
    note: 'We need at least 5 morning check-ins to judge it fairly.',
  },
} as const

function Verdict({ result }: { result: ExperimentResult }) {
  const verdict = VERDICTS[result.status as keyof typeof VERDICTS]
  return (
    <section
      aria-labelledby="verdict"
      className={cn(
        'relative overflow-hidden rounded-3xl p-5 ring-1 animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none',
        verdict.card,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute right-4 top-4 rotate-[-8deg] rounded-md border-2 px-2 py-0.5 text-sm font-black uppercase tracking-[0.16em]',
          verdict.stampColor,
        )}
      >
        {verdict.stamp}
      </span>
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-navy-700">
        <verdict.icon aria-hidden className="size-4" />
        Verdict
      </p>
      <h2 id="verdict" className="mt-1.5 pr-28 text-2xl font-semibold leading-tight">
        {verdict.title}
        <span className="sr-only">. {verdict.stamp}.</span>
      </h2>
      <p className="mt-2">{result.summary}</p>
      {(result.energy_before !== null || result.rhr_during !== null) && (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {result.energy_before !== null && result.energy_during !== null && (
            <Stat label="Energy" value={`${result.energy_before} → ${result.energy_during}`} unit="out of 5" />
          )}
          {result.rhr_baseline !== null && result.rhr_during !== null && (
            <Stat label="Resting heart rate" value={`${result.rhr_during}`} unit={`bpm (usual ${result.rhr_baseline})`} />
          )}
        </dl>
      )}
      <p className="mt-4 font-medium">{verdict.note}</p>
    </section>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-sm text-muted-foreground">{unit}</dd>
    </div>
  )
}
