import { useEffect, useId, useRef } from 'react'
import { Eye } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Reveal } from '@/components/case/CaseParts'
import { LogoCharacter } from '@/components/stage/LogoCharacter'
import { Button } from '@/components/ui/button'
import type { Cause } from '@/lib/types'

import { FINDING, useEyeCheck } from './context'
import { EyeResultLine } from './EvidenceTest'

// "New clue" card under the case file, shown when a sleep or stress suspect exists. It runs the
// check for the highest-ranked of them; afterwards it shows the latest result instead of the
// button. "?eye=1" (Demo Controls → Jump to → Eye check) opens the check straight away.
export function EyeCheckCard({ causes }: { causes: Cause[] }) {
  const eyeCheck = useEyeCheck()
  const target = causes.find((cause) => FINDING[cause.id])?.id
  const [params, setParams] = useSearchParams()
  const wanted = params.get('eye') === '1'
  const card = useRef<HTMLElement>(null)
  const titleId = useId()
  const open = eyeCheck?.open

  useEffect(() => {
    if (!wanted) return
    setParams(
      (current) => {
        current.delete('eye')
        return current
      },
      { replace: true },
    )
    if (target && open) open(target, card.current)
  }, [wanted, target, open, setParams])

  if (!eyeCheck || !target) return null
  const result = eyeCheck.last ? eyeCheck.results[eyeCheck.last] : undefined

  return (
    <Reveal index={1}>
      <section
        ref={card}
        tabIndex={-1}
        aria-labelledby={titleId}
        className="rounded-3xl bg-card p-5 shadow-sm outline-none ring-2 ring-coral-500/40"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral-50 text-coral-700 ring-1 ring-coral-500/30">
            <Eye aria-hidden className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              New clue: check your eyes
            </h2>
            <p className="mt-0.5 text-muted-foreground">30 seconds with your camera. Nothing is recorded.</p>
          </div>
          <LogoCharacter mood="tired" className="w-14 shrink-0" />
        </div>
        <div className="mt-4">
          {result ? (
            <EyeResultLine result={result} />
          ) : (
            <Button
              aria-haspopup="dialog"
              className="h-12 w-full gap-2 text-base"
              onClick={() => eyeCheck.open(target, card.current)}
            >
              <Eye aria-hidden />
              Start the eye check
            </Button>
          )}
        </div>
      </section>
    </Reveal>
  )
}
