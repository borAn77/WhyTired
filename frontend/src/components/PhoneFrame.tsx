import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import '@/components/stage/stage.css'
import { StageBackdrop } from '@/components/stage/StageBackdrop'
import { StoryPanel } from '@/components/stage/StoryPanel'
import { usePageVisible, usePrefersReducedMotion } from '@/components/stage/motion'

// On phones the app is full screen. On desktop (demo) it sits in a phone-sized frame on a
// "stage": the story panel with the animated logo on the left, the presenter-only demo
// controls on the right. On phones the same controls open from a small button, so the demo
// also works from a phone. The stage only reads the session; it never changes app state.
export function PhoneFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const [controlsOpen, setControlsOpen] = useState(false)
  const pageVisible = usePageVisible()
  const scrollRef = useScreenTransition()

  return (
    <div className={`stage min-h-dvh bg-navy-50${pageVisible ? '' : ' is-paused'}`}>
      <StageBackdrop />

      <div className="stage__story">
        <StoryPanel />
      </div>

      <div className="stage__device">
        <div
          data-phone-frame
          className="stage__screen relative flex h-dvh w-full flex-col overflow-hidden bg-app"
        >
          <div data-phone-scroll ref={scrollRef} className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>

      {aside && (
        <aside className="stage__controls hidden md:block">
          <div className="stage__story-compact">
            <StoryPanel compact />
          </div>
          <p className="stage__presenter">For the presenter</p>
          {aside}
        </aside>
      )}

      {aside && (
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

// Fades the phone content in on every route change. Uses the Web Animations API on the
// existing scroll container, so no wrapper element and no remount: screens keep their state.
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
    if (!el || reduce || typeof el.animate !== 'function') return
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
