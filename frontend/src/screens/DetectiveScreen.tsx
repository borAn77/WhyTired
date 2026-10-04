import { Target } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { DetectiveNotes, FakeClues, MissionCard } from '@/components/case/CaseCards'
import { CaseHeader, CaseStat, InvestigatingState, MascotBadge, Reveal } from '@/components/case/CaseParts'
import { SuspectCard } from '@/components/case/SuspectCard'
import { EyeCheckCard } from '@/components/evidence/EyeCheckCard'
import { EyeCheckProvider } from '@/components/evidence/EyeCheckProvider'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { addDays } from '@/lib/dates'
import { toCtx, useSession } from '@/lib/session'
import type { DetectiveResult } from '@/lib/types'
import { useApi } from '@/lib/useApi'

const CASE_TITLE = 'The case of the missing energy'

export function DetectiveScreen() {
  const { session, update } = useSession()
  const navigate = useNavigate()
  const ctx = toCtx(session)
  const { data, error, loading, retry } = useApi(`detective:${JSON.stringify(ctx)}`, () => api.detective(ctx))

  if (loading) {
    return (
      <Screen>
        <InvestigatingState />
      </Screen>
    )
  }
  if (error || !data) {
    return (
      <Screen>
        <CaseHeader title={CASE_TITLE} step={0} />
        <ErrorState
          title="We couldn't open the case"
          message="The server may be waking up, which takes up to a minute."
          onRetry={retry}
        />
      </Screen>
    )
  }
  if (!data.triggered) return <NothingToInvestigate />
  if (data.causes.length === 0) return <NoSuspect result={data} />

  const plan = data.suggested_experiment
  const fakeNights = new Set(data.excluded.map((point) => point.date)).size
  const startMission = () => {
    if (!plan) return
    update({ experiment: { cause_id: plan.cause_id, start: addDays(session.today, 1), days: plan.days } })
    navigate('/experiment')
  }

  return (
    <EyeCheckProvider>
      <Screen
        footer={
          plan && (
            <>
              <PrimaryButton onClick={startMission}>
                <Target aria-hidden />
                Accept the mission
              </PrimaryButton>
              <p className="mt-2 text-center text-sm text-muted-foreground">Starts tomorrow · stop any time</p>
            </>
          )
        }
      >
        <Reveal index={0}>
          <CaseHeader
            title={CASE_TITLE}
            dataLevel={data.data_level}
            step={2}
            stats={
              <>
                <CaseStat value={data.low_energy_days} label="low days" />
                <CaseStat value={data.causes.length} label={data.causes.length === 1 ? 'suspect' : 'suspects'} />
                <CaseStat value={fakeNights} label={fakeNights === 1 ? 'fake clue' : 'fake clues'} />
              </>
            }
          />
        </Reveal>
        <EyeCheckCard causes={data.causes} />
        {data.explanation && (
          <Reveal index={1}>
            <DetectiveNotes explanation={data.explanation} />
          </Reveal>
        )}
        <Reveal index={2}>
          <section className="space-y-3" aria-labelledby="suspects">
            <h2 id="suspects" className="text-xl font-semibold">
              The suspects
            </h2>
            {data.causes.map((cause, i) => (
              <SuspectCard key={cause.id} cause={cause} rank={i + 1} />
            ))}
          </section>
        </Reveal>
        {data.excluded.length > 0 && (
          <Reveal index={3}>
            <FakeClues points={data.excluded} />
          </Reveal>
        )}
        {plan && (
          <Reveal index={4}>
            <MissionCard plan={plan} />
          </Reveal>
        )}
      </Screen>
    </EyeCheckProvider>
  )
}

function NothingToInvestigate() {
  return (
    <Screen>
      <div className="flex flex-col items-center pt-10 text-center">
        <MascotBadge className="size-24 ring-navy-100" />
        <h1 className="mt-6 text-2xl font-semibold">No case to open</h1>
        <p className="mt-2 text-muted-foreground">
          The detective steps in after 3 low-energy mornings in a row. Yours look fine.
        </p>
        <Button asChild size="lg" className="mt-6 h-12 rounded-xl px-6 text-base">
          <Link to="/">Back to today</Link>
        </Button>
      </div>
    </Screen>
  )
}

function NoSuspect({ result }: { result: DetectiveResult }) {
  return (
    <Screen>
      <CaseHeader
        title={CASE_TITLE}
        dataLevel={result.data_level}
        step={1}
        stats={
          <>
            <CaseStat value={result.low_energy_days} label="low days" />
            <CaseStat value={0} label="suspects" />
            <CaseStat value={new Set(result.excluded.map((p) => p.date)).size} label="fake clues" />
          </>
        }
      />
      <EmptyState
        title="No suspect found"
        message="Training, sleep, stress and heart rate all look like your usual. Keep checking in. Still tired in two weeks? Talk to your family doctor."
      />
      <FakeClues points={result.excluded} />
    </Screen>
  )
}
