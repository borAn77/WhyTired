import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Eye, X } from 'lucide-react'

import { useStageState } from '@/components/stage/useStageState'
import { Button } from '@/components/ui/button'
import type { CauseId } from '@/lib/types'

import './evidence.css'
import { EYE_BASELINE } from './baselines'
import { EyeCheckContext, FINDING, type EyeCheckApi, type EyeCheckResult } from './context'
import { EyeCheck } from './EyeCheck'
import { demoResult, eyeDetail, eyeText, type EyeResult } from './logic'

// Wraps the Detective screen: the eye-check results per suspect and the one sheet that runs the
// check, opened from the "New clue" card or a suspect's "Check it yourself". Results never change
// a suspect's rank or confidence. React state only, so they are gone after "Restart the demo"
// (or after leaving the case).
export function EyeCheckProvider({ children }: { children: ReactNode }) {
  const { persona } = useStageState()
  const [results, setResults] = useState<Partial<Record<CauseId, EyeCheckResult>>>({})
  const [last, setLast] = useState<CauseId | null>(null)
  const [causeId, setCauseId] = useState<CauseId | null>(null) // the sheet is open for this suspect
  const [finished, setFinished] = useState(false) // this run is over: the sheet shows the result
  const returnFocusTo = useRef<HTMLElement | null>(null)
  const titleId = useId()
  // The sheet goes into the phone screen, so it covers the phone and not the whole page.
  const host = causeId ? document.querySelector<HTMLElement>('[data-phone-frame]') : null

  const open = useCallback((id: CauseId, focusAfter: HTMLElement | null) => {
    returnFocusTo.current = focusAfter
    setFinished(false)
    setCauseId(id)
  }, [])
  const close = useCallback(() => {
    setCauseId(null)
    requestAnimationFrame(() => returnFocusTo.current?.focus()) // once the screen is no longer inert
  }, [])

  const usual = EYE_BASELINE[persona]
  const finish = useCallback(
    (eyes: EyeResult) => {
      const finding = causeId && FINDING[causeId]
      if (!causeId || !finding) return
      setResults((current) => ({ ...current, [causeId]: { text: eyeText(eyes, usual, finding), detail: eyeDetail(eyes, usual) } }))
      setLast(causeId)
      setFinished(true)
    },
    [causeId, usual],
  )
  const showDemo = useCallback(() => finish(demoResult(usual)), [finish, usual])

  // While the sheet is open, the screen behind it can't be tabbed to or clicked, and Escape
  // closes it wherever focus is (a finished check removes the element that had focus).
  useEffect(() => {
    if (!host) return
    const screen = host.querySelector<HTMLElement>('[data-phone-scroll]')
    if (screen) screen.inert = true
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      if (screen) screen.inert = false
      window.removeEventListener('keydown', onKey)
    }
  }, [host, close])

  const api = useMemo<EyeCheckApi>(() => ({ results, last, open }), [results, last, open])
  const result = causeId ? results[causeId] : undefined

  return (
    <EyeCheckContext.Provider value={api}>
      {children}
      {host &&
        createPortal(
          <div
            className="absolute inset-0 z-30 flex flex-col bg-navy-900/40 motion-safe:animate-in motion-safe:fade-in"
            onClick={(event) => event.target === event.currentTarget && close()}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="mt-auto max-h-[85%] overflow-y-auto rounded-t-3xl bg-app px-5 pb-6 pt-4 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom"
            >
              <div className="flex items-center gap-3">
                <Eye aria-hidden className="size-6 text-coral-600" />
                <h2 id={titleId} className="flex-1 text-xl font-semibold">
                  Eye check
                </h2>
                <button
                  type="button"
                  autoFocus
                  onClick={close}
                  aria-label="Close"
                  className="grid size-11 place-items-center rounded-full bg-card ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>

              <div className="mt-4">
                {finished && result ? (
                  <div className="space-y-4">
                    <div aria-live="polite" className="rounded-2xl bg-card p-4 ring-1 ring-border">
                      <p className="text-lg font-semibold leading-snug">{result.text}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{result.detail}</p>
                    </div>
                    <Button autoFocus className="h-12 w-full text-base" onClick={close}>
                      Back to the case
                    </Button>
                  </div>
                ) : (
                  <EyeCheck onDone={finish} onDemo={showDemo} />
                )}
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">A signal, not a diagnosis.</p>
            </div>
          </div>,
          host,
        )}
    </EyeCheckContext.Provider>
  )
}
