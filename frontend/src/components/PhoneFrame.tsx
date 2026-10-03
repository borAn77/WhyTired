import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

// On phones the app is full screen. On desktop (demo) it sits in a phone-sized frame,
// with the presenter-only demo controls rendered next to it. On phones the same controls
// open from a small button, so the demo also works from a phone.
export function PhoneFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const [controlsOpen, setControlsOpen] = useState(false)
  // A new screen starts at the top, like a real app (the scroll container is shared by all screens).
  const { pathname } = useLocation()
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="min-h-dvh bg-navy-50 md:flex md:items-center md:justify-center md:gap-10 md:p-8">
      <div
        data-phone-frame
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-app md:h-[var(--wt-phone-height)] md:w-[var(--wt-phone-width)] md:rounded-[2.75rem] md:border-[10px] md:border-navy-900 md:shadow-2xl"
      >
        <div ref={scroller} data-phone-scroll className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
      {aside && <aside className="hidden max-h-[calc(100dvh-4rem)] w-72 overflow-y-auto md:block">{aside}</aside>}

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
