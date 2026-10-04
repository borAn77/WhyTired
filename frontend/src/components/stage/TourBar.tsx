import { ChevronLeft, ChevronRight, Play, RotateCcw, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useScenes } from '@/lib/sceneContext'
import { SCENES } from '@/lib/scenes'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

// The guided tour where the stage's side panel is not visible: on top of the app on phones,
// and floating at the bottom of the doctor's page (a scene of the tour without a phone frame).
// `floating` only shows the tour itself, never the welcome or the end card.
export function TourBar({ floating = false, className }: { floating?: boolean; className?: string }) {
  const { index, done, start, go, stop, finish } = useScenes()
  const { session, reset } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const shell = cn(
    'bg-navy-900 text-white',
    floating
      ? 'fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl p-4 shadow-2xl print:hidden'
      : 'px-4 pb-3 pt-3',
    className,
  )
  const navButton =
    'grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

  if (index !== null) {
    const scene = SCENES[index]
    const last = index === SCENES.length - 1
    // The doctor's page sits outside the app, so leaving the tour there goes back to the app.
    const exit = () => {
      stop()
      if (pathname.startsWith('/s/')) navigate('/summary')
    }
    return (
      <section aria-label="Guided tour" className={shell}>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-bold uppercase tracking-[0.12em] text-coral-500">
            Step {index + 1} of {SCENES.length}
          </p>
          <button
            type="button"
            onClick={exit}
            className="flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm text-navy-100 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <X aria-hidden className="size-4" />
            Exit tour
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous step"
            className={cn(navButton, 'bg-white/10 hover:bg-white/20 disabled:opacity-40')}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <div aria-live="polite" className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{scene.headline}</p>
            <p className="leading-snug text-navy-100">{scene.caption}</p>
          </div>
          <button
            type="button"
            onClick={() => (last ? finish() : go(index + 1))}
            aria-label={last ? 'Finish the tour' : 'Next step'}
            className={cn(navButton, 'bg-coral-500 text-navy-900 hover:bg-coral-500/90')}
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </section>
    )
  }

  if (floating) return null

  if (done) {
    return (
      <section aria-label="Tour finished" className={cn(shell, 'flex flex-wrap items-center gap-2')}>
        <p className="flex-1 font-semibold">That’s WhyTired.</p>
        <button
          type="button"
          onClick={start}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3 font-medium hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
        >
          <RotateCcw aria-hidden className="size-4" />
          Again
        </button>
        <button
          type="button"
          onClick={() => {
            stop()
            reset()
            navigate('/onboarding')
          }}
          className="min-h-11 rounded-full bg-coral-500 px-4 font-semibold text-navy-900 hover:bg-coral-500/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Try it yourself
        </button>
      </section>
    )
  }

  if (!session.onboarded) {
    return (
      <button
        type="button"
        onClick={start}
        className={cn(shell, 'flex w-full items-center gap-3 text-left hover:bg-navy-800 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white')}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-coral-500 text-navy-900">
          <Play aria-hidden className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">New here? Take the 2-min tour</span>
          <span className="block text-sm text-navy-100">See every step with example data</span>
        </span>
        <ChevronRight aria-hidden className="size-5 text-navy-100" />
      </button>
    )
  }

  return null
}
