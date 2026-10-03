import { FlaskConical } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Screen } from '@/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { toCtx, useSession } from '@/lib/session'
import type { Experiment } from '@/lib/types'
import { useApi } from '@/lib/useApi'

// M2: minimal experiment tracker so the flow works end to end. Polished in M4.
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
  const { session } = useSession()
  const ctx = toCtx(session, { experiment })
  const { data, error, loading, retry } = useApi(`experiment:${JSON.stringify(ctx)}`, () => api.experiment(ctx))

  return (
    <Screen>
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-700">
        <FlaskConical aria-hidden className="size-4" />
        Your 7-day experiment
      </p>
      {loading && <LoadingState label="Checking your experiment" />}
      {error ? <ErrorState onRetry={retry} /> : null}
      {data && (
        <section className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-border">
          <h1 className="text-2xl font-semibold">
            {data.status === 'running' ? (data.day === 0 ? 'Starts tomorrow' : `Day ${data.day} of ${data.days_total}`) : 'Result'}
          </h1>
          <Progress value={(data.day / data.days_total) * 100} aria-label="Experiment progress" />
          <p>{data.summary}</p>
        </section>
      )}
    </Screen>
  )
}
