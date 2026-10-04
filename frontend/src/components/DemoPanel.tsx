import { useState, type ReactNode } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { ScenePanel } from '@/components/ScenePanel'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PERSONAS } from '@/lib/profile'
import { DEMO_DAY, FIRST_ALLOWED_DAY, LAST_ALLOWED_DAY, addDays, daysBetween, formatDay } from '@/lib/dates'
import { useScenes } from '@/lib/sceneContext'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import type { DataLevel, Scenario } from '@/lib/types'

const JUMPS: [string, string][] = [
  ['Onboarding', '/onboarding'],
  ['Check-in', '/check-in'],
  ['Today', '/'],
  ['Detective', '/detective'],
  ['Eye check', '/detective?eye=1'], // opens the eye-check sheet (components/evidence/EyeCheckCard)
  ['Experiment', '/experiment'],
  ['Summary', '/summary'],
]

// Presenter-only controls, shown next to the phone frame on desktop. Not part of the product.
export function DemoPanel() {
  const { session, update, reset } = useSession()
  const navigate = useNavigate()
  const offset = daysBetween(DEMO_DAY, session.today)
  // While the demo script runs, the manual controls fold away to keep the projector view calm.
  const scriptRunning = useScenes().index !== null
  const [manualOpen, setManualOpen] = useState(false)
  const showManual = !scriptRunning || manualOpen

  // Jumping past onboarding (e.g. right after "Restart the demo") fills in the persona's own
  // onboarding answers, so no screen sends the presenter back to onboarding.
  const jump = (path: string) => {
    if (path !== '/onboarding' && !session.onboarded) {
      const persona = PERSONAS[session.personaId]
      update({
        onboarded: true,
        goal: session.goal ?? persona?.goal ?? null,
        sports: session.sports.length > 0 ? session.sports : (persona?.sports ?? []),
        profile: session.profile ?? persona?.profile ?? null,
      })
    }
    navigate(path)
  }

  const travel = (days: number) => {
    const target = Math.min(LAST_ALLOWED_DAY, Math.max(FIRST_ALLOWED_DAY, offset + days))
    const day = addDays(DEMO_DAY, target)
    update({ today: day })
    // A new morning starts with the check-in, as it would in real use. "+7 days" jumps straight
    // to the verdict instead (the skipped days use the persona's recorded data).
    if (days === 1 && session.onboarded && !session.checkins[day]) navigate('/check-in')
  }

  return (
    <div className="space-y-5 rounded-2xl bg-card p-5 shadow-lg ring-1 ring-border">
      <ScenePanel />

      {scriptRunning && (
        <button
          type="button"
          aria-expanded={showManual}
          onClick={() => setManualOpen(!manualOpen)}
          className="flex min-h-10 w-full items-center justify-between rounded-lg text-sm font-semibold text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Manual controls
          <ChevronDown aria-hidden className={cn('size-4 transition-transform', showManual && 'rotate-180')} />
        </button>
      )}

      {showManual && (
        <div className="space-y-5">
          <Field label="Persona">
            <ToggleGroup
              type="single"
              variant="outline"
              value={session.personaId}
              onValueChange={(personaId) =>
                personaId &&
                update({
                  personaId,
                  dataLevel: personaId === 'tomek' ? 'basic' : 'full',
                  ...PERSONAS[personaId],
                  checkins: {},
                  done: {},
                  clues: {},
                  closed: [],
                  experiment: null,
                  today: DEMO_DAY,
                })
              }
            >
              <ToggleGroupItem value="kasia">Kasia · watch</ToggleGroupItem>
              <ToggleGroupItem value="tomek">Tomek · no watch</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field label="Data level">
            <ToggleGroup
              type="single"
              variant="outline"
              value={session.dataLevel}
              onValueChange={(level) => level && update({ dataLevel: level as DataLevel })}
            >
              <ToggleGroupItem value="full">Full</ToggleGroupItem>
              <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
              <ToggleGroupItem value="basic">Basic</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field label="Time travel">
            <p className="font-semibold">
              {formatDay(session.today)}{' '}
              <span className="font-normal text-muted-foreground">
                ({offset === 0 ? 'demo day' : `${offset > 0 ? '+' : ''}${offset} days`})
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => travel(-1)}>
                −1 day
              </Button>
              <Button variant="outline" size="sm" onClick={() => travel(1)}>
                +1 day
              </Button>
              <Button variant="outline" size="sm" onClick={() => travel(7)}>
                +7 days
              </Button>
              <Button variant="ghost" size="sm" onClick={() => update({ today: DEMO_DAY })}>
                Demo day
              </Button>
            </div>
          </Field>

          <Field label="Experiment outcome">
            <ToggleGroup
              type="single"
              variant="outline"
              value={session.scenario}
              onValueChange={(scenario) => scenario && update({ scenario: scenario as Scenario })}
            >
              <ToggleGroupItem value="not_improved">Not improved</ToggleGroupItem>
              <ToggleGroupItem value="improved">Improved</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field label="Jump to">
            <div className="flex flex-wrap gap-2">
              {JUMPS.map(([label, path]) => (
                <Button key={path} variant="outline" size="sm" onClick={() => jump(path)}>
                  {label}
                </Button>
              ))}
            </div>
          </Field>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              reset()
              navigate('/onboarding')
            }}
          >
            <RotateCcw aria-hidden />
            Restart the demo
          </Button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-navy-900">{label}</p>
      {children}
    </div>
  )
}
