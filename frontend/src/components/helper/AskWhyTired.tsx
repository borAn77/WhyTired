import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { LogoCharacter } from '@/components/stage/LogoCharacter'
import { useStageState } from '@/components/stage/useStageState'
import { Button } from '@/components/ui/button'
import { useScenes } from '@/lib/sceneContext'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

import { helpFor, type HelpItem } from './content'
import { Tour } from './Tour'

// "Ask WhyTired": a floating button inside the phone that opens fixed questions with fixed
// answers (no free text, no LLM, no API calls), plus a 3-step tour the first time Today opens.
// Reads the session; never changes it. Hidden on onboarding, where its corner would cover the
// "Get started" button, and while the presenter's demo script runs, where on a 720p projector
// it would cover text the scenes point at.

const TOUR_KEY = 'whytired.tour.v1'

function readTourSeen() {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return false
  }
}

function writeTourSeen(seen: boolean) {
  try {
    if (seen) localStorage.setItem(TOUR_KEY, '1')
    else localStorage.removeItem(TOUR_KEY)
  } catch {
    // storage blocked: the tour state just won't survive a reload
  }
}

export function AskWhyTired({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const { session } = useSession()
  const { pathname, persona, finished, scenario, mood } = useStageState()
  const scriptRunning = useScenes().index !== null
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const footerHeight = useFooterHeight(scrollRef)

  // Tied to the screen it was opened on, so a route change (e.g. Demo Controls) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const open = openOn === pathname

  // The tour shows on Today until it is skipped or finished. "Restart the demo" sends the user
  // back to onboarding, which resets it; the presenter's demo script never shows it.
  const [tourSeen, setTourSeen] = useState(readTourSeen)
  const [tourStep, setTourStep] = useState(0)
  if (!session.onboarded && (tourSeen || tourStep > 0)) {
    setTourSeen(false)
    setTourStep(0)
  }
  if (scriptRunning && session.onboarded && !tourSeen) setTourSeen(true)
  useEffect(() => writeTourSeen(tourSeen), [tourSeen])
  const touring = !tourSeen && session.onboarded && pathname === '/'

  // While the sheet or the tour is open, the screen behind it can't be tabbed to or clicked.
  useEffect(() => {
    const screen = scrollRef.current
    if (!screen) return
    screen.inert = open || touring
    return () => {
      screen.inert = false
    }
  }, [scrollRef, open, touring])

  if (pathname === '/onboarding' || scriptRunning) return null

  const close = () => {
    setOpenOn(null)
    setSelected(null)
    buttonRef.current?.focus()
  }
  const endTour = () => {
    setTourSeen(true)
    setTourStep(0)
    buttonRef.current?.focus()
  }

  // "Take me there" only for screens that show something in the current session state.
  const reachable = (to: string) =>
    to === '/experiment' ? session.experiment !== null : to === '/summary' ? finished && scenario === 'not_improved' : true
  const action = (item: HelpItem) =>
    item.to &&
    item.to !== pathname &&
    reachable(item.to) && (
      <Button
        className="mt-3 h-11 px-4 text-base"
        onClick={() => {
          navigate(item.to!) // same as the Demo Controls "Jump to" buttons
          close()
        }}
      >
        Take me there
        <ArrowRight aria-hidden />
      </Button>
    )

  const { guide, why } = helpFor(pathname, persona, session.experiment !== null)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenOn(pathname)}
        aria-label="Ask WhyTired"
        aria-haspopup="dialog"
        title="Ask WhyTired"
        style={{ bottom: footerHeight ? footerHeight + 12 : 16 }}
        className="absolute right-4 z-20 grid size-14 place-items-center rounded-full bg-card shadow-lg ring-1 ring-border hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-[bottom]"
      >
        <LogoCharacter mood={mood} className="w-10" />
      </button>

      {open && (
        <div
          className="absolute inset-0 z-30 flex flex-col bg-navy-900/40 motion-safe:animate-in motion-safe:fade-in"
          onClick={(event) => event.target === event.currentTarget && close()}
          onKeyDown={(event) => event.key === 'Escape' && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="mt-auto max-h-[85%] overflow-y-auto rounded-t-3xl bg-app px-5 pb-6 pt-4 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom"
          >
            <div className="flex items-center gap-3">
              <LogoCharacter mood={mood} className="w-11 shrink-0" />
              <h2 id={titleId} className="flex-1 text-xl font-semibold">
                Ask WhyTired
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

            <Questions title="How do I…?" items={guide} selected={selected} onSelect={setSelected} action={action} />
            <Questions title="Why…?" items={why} selected={selected} onSelect={setSelected} action={action} />

            {session.onboarded && (
              <button
                type="button"
                onClick={() => {
                  setOpenOn(null)
                  setSelected(null)
                  if (pathname !== '/') navigate('/')
                  setTourStep(0)
                  setTourSeen(false)
                }}
                className="mt-5 min-h-11 rounded-lg font-medium text-navy-700 underline-offset-4 hover:underline focus-visible:outline-2"
              >
                Show the tour again
              </button>
            )}
          </div>
        </div>
      )}

      {touring && (
        <Tour
          step={tourStep}
          scrollRef={scrollRef}
          buttonRef={buttonRef}
          mood={mood}
          onNext={() => setTourStep(tourStep + 1)}
          onClose={endTour}
        />
      )}
    </>
  )
}

// A group of question chips; the chosen one's answer opens right below the group.
function Questions({
  title,
  items,
  selected,
  onSelect,
  action,
}: {
  title: string
  items: HelpItem[]
  selected: string | null
  onSelect: (id: string | null) => void
  action: (item: HelpItem) => ReactNode
}) {
  const current = items.find((item) => item.id === selected)
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-expanded={item.id === selected}
            aria-controls={`help-${item.id}`}
            onClick={() => onSelect(item.id === selected ? null : item.id)}
            className={cn(
              'min-h-11 rounded-2xl px-4 py-2 text-left font-medium ring-1 focus-visible:outline-2 focus-visible:outline-offset-2',
              item.id === selected ? 'bg-navy-900 text-white ring-navy-900' : 'bg-card ring-border hover:bg-navy-50',
            )}
          >
            {item.question}
          </button>
        ))}
      </div>
      {current && (
        <div id={`help-${current.id}`} className="mt-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <p>{current.answer}</p>
          {action(current)}
        </div>
      )}
    </section>
  )
}

// Screen renders its sticky footer (the screen's one primary action) right after <main>. The
// button sits above it, so it never covers that action.
function useFooterHeight(scrollRef: RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const measure = () => setHeight(scroll.querySelector<HTMLElement>('main + div')?.offsetHeight ?? 0)
    measure()
    const observer = new MutationObserver(measure)
    observer.observe(scroll, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [scrollRef])
  return height
}
