import { FastForward, FileText, RotateCcw, Stethoscope, Sunrise, Target, TriangleAlert, Trophy } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { CaseHeader, CaseStat, ChartKey } from '@/components/case/CaseParts'
import { MissionMap } from '@/components/case/MissionMap'
import { MiniChart } from '@/components/MiniChart'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { adherenceFor } from '@/lib/clues'
import { DEMO_DAY, LAST_ALLOWED_DAY, addDays, formatDay } from '@/lib/dates'
import { useScenes } from '@/lib/sceneContext'
import { toCtx, useSession } from '@/lib/session'
import type { Experiment, ExperimentResult } from '@/lib/types'
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
  const scriptRunning = useScenes().index !== null
  const ctx = toCtx(session, { experiment })
  const { data, error, loading, retry } = useApi(`experiment:${JSON.stringify(ctx)}`, () => api.experiment(ctx))

  // Stopping early and keeping the change both end the mission and go back to daily advice.
  // Keeping the change also closes the case, which Today confirms.
  const end = () => {
    update({ experiment: null })
    navigate('/')
  }
  const closeCase = () => {
    update({ experiment: null, closed: [...session.closed, session.today] })
    navigate('/')
  }
  const restart = () => update({ experiment: { ...experiment, start: addDays(session.today, 1) } })
  // Demo only: jump to the verdict day, but never past the last day the synthetic data covers.
  const verdictDay = addDays(experiment.start, experiment.days)
  const lastDay = addDays(DEMO_DAY, LAST_ALLOWED_DAY)
  const skipTo = verdictDay < lastDay ? verdictDay : lastDay

  const checkedIn = !!session.checkins[session.today]
  let footer = null
  if (data?.status === 'running' && data.day > 0 && !checkedIn)
    footer = (
      <PrimaryButton onClick={() => navigate('/check-in')}>
        <Sunrise aria-hidden />
        Start today’s check-in
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
  // Before day 1 the map and the chart would be empty, so they appear once the mission starts.
  const started = !!data && !(data.status === 'running' && data.day === 0)
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
            <>
              <RunningCard result={data} checkedIn={checkedIn} />
              {!scriptRunning && session.today < skipTo && (
                <DemoSkip days={experiment.days} onClick={() => update({ today: skipTo })} />
              )}
              <WarningSigns />
            </>
          ) : (
            <Verdict result={data} />
          )}
          {started && <MissionMap result={data} experiment={experiment} />}
          {started && data.chart && data.chart.points.length > 1 && (
            <section className="space-y-2 rounded-3xl bg-card p-5 ring-1 ring-border">
              <MiniChart chart={data.chart} title="Your energy, before and during" caption="" />
              <ChartKey items={[{ mark: 'dashed', label: 'Before the mission' }]} />
            </section>
          )}
          {data.status === 'running' && (
            <Button variant="ghost" className="h-11 w-full" onClick={end}>
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

// For judges exploring on their own (hidden while the presenter's script runs): time travel to
// the verdict, the only way to reach it and the doctor summary without waiting a week. Dashed and
// labelled "Demo" so it never reads as part of the product.
function DemoSkip({ days, onClick }: { days: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-500 px-4 py-2 font-medium text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <FastForward aria-hidden className="size-5" />
      Demo: skip to day {days}
    </button>
  )
}

// While the mission runs: when not to wait out the 7 days. The same fixed card for everyone, so
// it never turns into a personal triage or diagnosis. Copy by Berken, also in Polish.
function WarningSigns() {
  return (
    <section aria-labelledby="warning-signs" className="rounded-3xl bg-card p-5 ring-1 ring-border">
      <h2 id="warning-signs" className="flex items-center gap-2 text-lg font-semibold">
        <TriangleAlert aria-hidden className="size-5 shrink-0 text-coral-700" />
        Warning signs
      </h2>
      <ul className="mt-2 space-y-2">
        <li>
          Chest pain, fainting or severe shortness of breath during training → <b>call 112 now.</b>
        </li>
        <li>
          Unexplained weight loss or fever → <b>don’t wait the 7 days, see a doctor.</b>
        </li>
      </ul>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-medium text-navy-700">Po polsku</summary>
        <p lang="pl" className="text-muted-foreground">
          Ból w klatce piersiowej, omdlenie lub silna duszność podczas treningu → natychmiast dzwoń pod 112.
          Niewyjaśniona utrata masy ciała lub gorączka → nie czekaj 7 dni, idź do lekarza.
        </p>
      </details>
    </section>
  )
}

// The engine's summary carries the numbers; the note only adds what to take from it.
const VERDICTS = {
  improved: {
    stamp: 'Case closed',
    title: 'Mystery solved',
    icon: Trophy,
    card: 'bg-green-50 ring-green-700/30',
    stampColor: 'border-green-700 text-green-700',
    note: null,
  },
  not_improved: {
    stamp: 'To your doctor',
    title: 'No clear improvement',
    icon: Stethoscope,
    card: 'bg-navy-50 ring-navy-900/20',
    stampColor: 'border-coral-700 text-coral-700',
    note: 'You did the right thing: you tried a safe change first.',
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
      {verdict.note && <p className="mt-4 font-medium">{verdict.note}</p>}
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
