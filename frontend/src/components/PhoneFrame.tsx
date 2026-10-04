import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { AskWhyTired } from '@/components/helper/AskWhyTired'
import '@/components/stage/stage.css'
import { StageBackdrop } from '@/components/stage/StageBackdrop'
import { StagePanel } from '@/components/stage/StagePanel'
import { TourBar } from '@/components/stage/TourBar'
import { usePageVisible, usePrefersReducedMotion } from '@/components/stage/motion'

// On phones the app is full screen, with the guided tour as a bar on top. On desktop (demo) it
// sits in a phone-sized frame on a "stage": the welcome and the guided tour on the left (for
// someone opening the link cold, like a judge), the phone on the right. The presenter's demo
// controls stay out of the way until "Presenter tools" (or ?presenter=1) opens them as a third
// column; on phones they then open from a small button. The stage never changes app state
// itself, except through the tour and the presenter controls.
export function PhoneFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const [controlsOpen, setControlsOpen] = useState(false)
  const [presenter, setPresenter] = usePresenterMode()
  const pageVisible = usePageVisible()
  const scrollRef = useScreenTransition()
  const showControls = !!aside && presenter

  return (
    <div className={`stage min-h-dvh bg-navy-50${showControls ? ' has-presenter' : ''}${pageVisible ? '' : ' is-paused'}`}>
      <StageBackdrop />

      <div className="stage__story">
        <StagePanel />
      </div>

      <div className="stage__device">
        <div
          data-phone-frame
          className="stage__screen relative flex h-dvh w-full flex-col overflow-hidden bg-app"
        >
          <TourBar className="md:hidden" />
          <div data-phone-scroll ref={scrollRef} className="flex-1 overflow-y-auto">
            {children}
          </div>
          <AskWhyTired scrollRef={scrollRef} />
        </div>
      </div>

      {showControls && (
        <aside className="stage__controls hidden md:block">
          <div className="stage__story-compact">
            <StagePanel compact />
          </div>
          <div className="stage__presenter-row">
            <p className="stage__presenter">For the presenter</p>
            <button type="button" onClick={() => setPresenter(false)} className="stage__presenter-hide">
              <X aria-hidden className="size-4" />
              Hide
            </button>
          </div>
          {aside}
        </aside>
      )}

      {aside && !showControls && (
        <button
          type="button"
          onClick={() => setPresenter(true)}
          aria-label="Presenter tools"
          title="Presenter tools"
          className="stage__presenter-toggle hidden md:inline-flex"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
        </button>
      )}

      {showControls && (
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            aria-label="Open demo controls"
            className="fixed right-0 top-1/3 z-20 grid h-12 w-8 place-items-center rounded-l-xl bg-navy-900/80 text-white shadow-lg backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <SlidersHorizontal aria-hidden className="size-5" />
          </button>
          {controlsOpen && (
            <div role="dialog" aria-modal="true" aria-label="Demo controls" className="fixed inset-0 z-30 flex flex-col bg-navy-900/40">
              <div className="mt-auto max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-app p-4 pb-8">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setControlsOpen(false)}
                    aria-label="Close demo controls"
                    className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-border"
                  >
                    <X aria-hidden className="size-5" />
                  </button>
                </div>
                {aside}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Presenter mode shows the demo controls next to the phone. Off by default, so a judge opening
// the link sees the app and the tour, not 19 buttons. Remembered per browser; ?presenter=1 or
// ?presenter=0 in the URL switches it.
const PRESENTER_KEY = 'whytired.presenter.v1'

function usePresenterMode() {
  const [on, setOn] = useState(() => {
    const param = new URLSearchParams(window.location.search).get('presenter')
    if (param !== null) {
      writePresenter(param !== '0')
      return param !== '0'
    }
    try {
      return localStorage.getItem(PRESENTER_KEY) === '1'
    } catch {
      return false
    }
  })
  const set = (value: boolean) => {
    setOn(value)
    writePresenter(value)
  }
  return [on, set] as const
}

function writePresenter(on: boolean) {
  try {
    if (on) localStorage.setItem(PRESENTER_KEY, '1')
    else localStorage.removeItem(PRESENTER_KEY)
  } catch {
    // storage blocked: presenter mode just won't survive a reload
  }
}

// Fades the phone content in on every route change and starts the new screen at the top (the
// scroll container is shared by all screens). Uses the Web Animations API on the existing scroll
// container, so no wrapper element and no remount: screens keep their state.
function useScreenTransition() {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const reduce = usePrefersReducedMotion()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: 0 })
    if (reduce || typeof el.animate !== 'function') return
    const animation = el.animate(
      [
        { opacity: 0, transform: 'translateX(14px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    return () => animation.cancel()
  }, [pathname, reduce])

  return ref
}
