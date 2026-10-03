import { Check, CircleCheck, CircleDashed, CircleX, FileText, FlaskConical, PartyPopper, RotateCcw, Stethoscope } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { MiniChart } from '@/components/MiniChart'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { adherenceFor } from '@/lib/clues'
import { addDays, formatDay } from '@/lib/dates'
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
          title="No experiment running"
          message="Detective mode suggests one when your energy has been low for a few days."
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

  const finish = () => {
    update({ experiment: null })
    navigate('/')
  }
  const restart = () => update({ experiment: { ...experiment, start: addDays(session.today, 1) } })

  let footer = null
  if (data?.status === 'not_improved')
    footer = (
      <PrimaryButton onClick={() => navigate('/summary')}>
        <FileText aria-hidden />
        Prepare my doctor summary
      </PrimaryButton>
    )
  else if (data?.status === 'improved')
    footer = (
      <PrimaryButton onClick={finish}>
        <CircleCheck aria-hidden />
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

  return (
    <Screen footer={footer}>
      <section className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-700">
          <FlaskConical aria-hidden className="size-4" />
          Your 7-day experiment
        </p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{data?.title ?? 'Loading…'}</h1>
        <p className="text-muted-foreground">
          {formatDay(experiment.start)} – {formatDay(addDays(experiment.start, experiment.days - 1))}
        </p>
      </section>

      {loading && <LoadingState label="Checking your experiment" />}
      {error ? <ErrorState onRetry={retry} /> : null}
      {data && (
        <>
          <DayTracker result={data} experiment={experiment} />
          {data.status === 'running' ? <RunningCard result={data} /> : <ResultCard result={data} />}
          {data.chart && data.chart.points.length > 1 && (
            <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <MiniChart
                chart={data.chart}
                title="Your energy, before and during"
                caption="Dashed line = your energy in the 5 days before the experiment."
              />
            </section>
          )}
          {data.status === 'running' && (
            <Button variant="ghost" className="w-full" onClick={finish}>
              Stop the experiment
            </Button>
          )}
        </>
      )}
    </Screen>
  )
}

const ADHERENCE_LABEL = { yes: 'stuck to the plan', partly: 'partly stuck to the plan', no: 'did not stick to the plan' }

function DayTracker({ result, experiment }: { result: ExperimentResult; experiment: Experiment }) {
  const { session } = useSession()
  const answers = Array.from({ length: result.days_total }, (_, i) =>
    i < result.day ? adherenceFor(session, experiment.start, i + 1) : undefined,
  )
  const answered = answers.filter(Boolean)
  const stuck = answers.filter((a) => a === 'yes').length
  return (
    <section aria-label={`Day ${result.day} of ${result.days_total}`} className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          {result.status === 'running'
            ? result.day === 0
              ? 'Starts tomorrow'
              : `Day ${result.day} of ${result.days_total}`
            : 'Finished'}
        </p>
        <p className="text-sm text-muted-foreground">{result.checkins_logged} check-ins</p>
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1.5">
        {answers.map((answer, i) => {
          const done = i < result.day
          // A passed day nobody answered for is just "done" (plain check); "stuck to it" is green.
          const Icon = answer === 'no' ? CircleX : answer === 'partly' ? CircleDashed : answer === 'yes' ? CircleCheck : Check
          return (
            <li
              key={i}
              aria-label={`Day ${i + 1}${done ? (answer ? `, you ${ADHERENCE_LABEL[answer]}` : ', done') : ''}`}
              className={cn(
                'grid h-10 place-items-center rounded-lg text-sm font-semibold',
                !done && 'bg-navy-50 text-muted-foreground',
                done && !answer && 'bg-navy-900 text-white',
                answer === 'yes' && 'bg-green-700 text-white',
                answer === 'partly' && 'bg-amber-50 text-amber-800 ring-1 ring-amber-800/30',
                answer === 'no' && 'bg-coral-50 text-coral-700 ring-1 ring-coral-500/40',
              )}
            >
              {done ? <Icon aria-hidden className="size-4" /> : i + 1}
            </li>
          )
        })}
      </ol>
      {answered.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Mission check: stuck to the plan on {stuck} of {answered.length} {answered.length === 1 ? 'day' : 'days'} you told us about.
        </p>
      )}
    </section>
  )
}

function RunningCard({ result }: { result: ExperimentResult }) {
  return (
    <section className="rounded-2xl bg-coral-50 p-5 ring-1 ring-coral-500/40">
      <p className="font-semibold">{result.day === 0 ? 'Tomorrow is day 1' : 'Keep going'}</p>
      <p className="mt-1">{result.summary}</p>
    </section>
  )
}

function ResultCard({ result }: { result: ExperimentResult }) {
  const improved = result.status === 'improved'
  const notImproved = result.status === 'not_improved'
  const Icon = improved ? PartyPopper : notImproved ? Stethoscope : RotateCcw
  return (
    <section
      className={cn(
        'rounded-2xl p-5 ring-1',
        improved ? 'bg-green-50 ring-green-700/30' : 'bg-navy-50 ring-navy-900/20',
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon aria-hidden className={cn('size-4', improved ? 'text-green-700' : 'text-navy-900')} />
        Result
      </p>
      <h2 className="mt-1.5 text-2xl font-semibold leading-tight">
        {improved ? 'It worked' : notImproved ? 'No clear improvement' : 'Not enough check-ins'}
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
    </section>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-sm text-muted-foreground">{unit}</dd>
    </div>
  )
}
