import { FlaskConical, Search, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { DataLevelBadge } from '@/components/badges'
import { CauseCard } from '@/components/CauseCard'
import { ExcludedList } from '@/components/ExcludedList'
import { ExperimentPlanCard } from '@/components/ExperimentPlanCard'
import { LogoMark } from '@/components/Logo'
import { Screen } from '@/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { addDays, formatDay } from '@/lib/dates'
import { toCtx, useSession } from '@/lib/session'
import type { DetectiveResult } from '@/lib/types'
import { useApi } from '@/lib/useApi'

export function DetectiveScreen() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const ctx = toCtx(session)
  const { data, error, loading, retry } = useApi(`detective:${JSON.stringify(ctx)}`, () => api.detective(ctx))

  if (loading) {
    return (
      <Screen>
        <Intro />
        <LoadingState label="Looking through your data" />
      </Screen>
    )
  }
  if (error || !data) {
    return (
      <Screen>
        <Intro />
        <ErrorState
          title="We couldn't run the detective"
          message="The server may be waking up, which takes up to a minute."
          onRetry={retry}
        />
      </Screen>
    )
  }
  if (!data.triggered) return <NothingToInvestigate />
  if (data.causes.length === 0) return <NoClearCause result={data} />

  const plan = data.suggested_experiment
  const startExperiment = () => {
    if (!plan) return
    update({ experiment: { cause_id: plan.cause_id, start: addDays(session.today, 1), days: plan.days } })
    navigate('/experiment')
  }

  return (
    <Screen
      footer={
        plan && (
          <>
            <Button
              size="lg"
              onClick={startExperiment}
              className="h-12 w-full rounded-xl bg-coral-500 text-base font-semibold text-navy-900 hover:bg-coral-500/90"
            >
              <FlaskConical aria-hidden />
              Start the 7-day experiment
            </Button>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Starts tomorrow, {formatDay(addDays(session.today, 1))}. You can stop at any time.
            </p>
          </>
        )
      }
    >
      <Intro lowDays={data.low_energy_days} />
      <DataLevelBadge level={data.data_level} />

      {data.explanation && (
        <section className="rounded-2xl bg-navy-900 p-5 text-white">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-500">
            <Sparkles aria-hidden className="size-4" />
            In short
          </p>
          <p className="mt-2 text-lg leading-relaxed">{data.explanation.text}</p>
          <p className="mt-3 text-sm text-navy-100">
            {data.explanation.source === 'llm'
              ? 'Written by AI from the numbers below, then checked: it may only use numbers we calculated.'
              : 'Summary of the findings below.'}
          </p>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="causes">
        <h2 id="causes" className="text-xl font-semibold">
          Most likely {data.causes.length === 1 ? 'cause' : 'causes'}
        </h2>
        {data.causes.map((cause, i) => (
          <CauseCard key={cause.id} cause={cause} rank={i + 1} expanded={i === 0} />
        ))}
      </section>

      <ExcludedList points={data.excluded} />
      {plan && <ExperimentPlanCard plan={plan} />}
    </Screen>
  )
}

function Intro({ lowDays }: { lowDays?: number }) {
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-700">
        <Search aria-hidden className="size-4" />
        Detective mode
      </p>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">Let's find out why you're tired</h1>
      {lowDays !== undefined && (
        <p className="text-muted-foreground">
          Your energy has been low for {lowDays} days in a row. We compared your last 7 days with your usual weeks.
          Here's what stands out.
        </p>
      )}
    </section>
  )
}

function NothingToInvestigate() {
  return (
    <Screen>
      <div className="flex flex-col items-center pt-10 text-center">
        <LogoMark className="h-20 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold">Nothing to investigate right now</h1>
        <p className="mt-2 text-muted-foreground">
          Detective mode starts by itself after 3 low-energy mornings in a row. Your recent check-ins look fine.
        </p>
        <Button asChild size="lg" className="mt-6 h-12 rounded-xl px-6 text-base">
          <Link to="/">Back to today</Link>
        </Button>
      </div>
    </Screen>
  )
}

function NoClearCause({ result }: { result: DetectiveResult }) {
  return (
    <Screen>
      <Intro lowDays={result.low_energy_days} />
      <EmptyState
        title="No clear cause in your data"
        message="Your training, sleep, stress and heart rate all look close to your usual. Keep checking in. If you still feel tired after two weeks, talk to your family doctor."
      />
      <ExcludedList points={result.excluded} />
    </Screen>
  )
}
