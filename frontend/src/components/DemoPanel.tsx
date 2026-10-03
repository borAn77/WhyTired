import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DEMO_DAY, FIRST_ALLOWED_DAY, LAST_ALLOWED_DAY, addDays, daysBetween, formatDay } from '@/lib/dates'
import { useSession } from '@/lib/session'
import type { DataLevel, Scenario } from '@/lib/types'

const JUMPS: [string, string][] = [
  ['Onboarding', '/onboarding'],
  ['Check-in', '/check-in'],
  ['Today', '/'],
  ['Detective', '/detective'],
  ['Experiment', '/experiment'],
  ['Summary', '/summary'],
]

// Presenter-only controls, shown next to the phone frame on desktop. Not part of the product.
export function DemoPanel() {
  const { session, update, reset } = useSession()
  const navigate = useNavigate()
  const offset = daysBetween(DEMO_DAY, session.today)

  const travel = (days: number) => {
    const target = Math.min(LAST_ALLOWED_DAY, Math.max(FIRST_ALLOWED_DAY, offset + days))
    update({ today: addDays(DEMO_DAY, target) })
  }

  return (
    <div className="space-y-5 rounded-2xl bg-card p-5 shadow-lg ring-1 ring-border">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-coral-700">Demo controls</p>
        <p className="text-sm text-muted-foreground">For the presenter only. Not part of the app.</p>
      </div>

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
              checkins: {},
              done: {},
              missions: [],
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
            <Button key={path} variant="outline" size="sm" onClick={() => navigate(path)}>
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
