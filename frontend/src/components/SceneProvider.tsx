import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { SceneContext, type ScenesApi } from '@/lib/sceneContext'
import { SCENES } from '@/lib/scenes'
import { useSession } from '@/lib/session'

const HEADER_OFFSET = 88 // the phone's sticky header
const SCROLL_TIMEOUT_MS = 60_000 // the free API can take a minute to wake up

// Where the scene keys are left alone. Text fields need every key. Arrow keys also move between
// the options of a Radix toggle group and move a slider (sleep hours), so they are left alone
// there too; a clicker's PageDown/PageUp are not, since a control the presenter just clicked
// keeps the focus.
const TEXT_FIELDS = 'input, textarea, select, [contenteditable="true"]'
const ARROW_KEY_WIDGETS = `${TEXT_FIELDS}, [data-radix-collection-item], [role="slider"]`

// Runs the presenter's demo script (lib/scenes.ts). Lives above all routes, so the keys also
// work on the doctor page, which has no phone frame. Keys are only active while the script runs.
export function SceneProvider({ children }: { children: ReactNode }) {
  const { update } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [index, setIndex] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const scrollJob = useRef(0)

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= SCENES.length) return
      const scene = SCENES[next]
      update(scene.state)
      navigate(scene.route)
      setIndex(next)
      scrollPhoneTo(scene.scrollTo, ++scrollJob.current, scrollJob)
    },
    [update, navigate],
  )

  const api = useMemo<ScenesApi>(
    () => ({
      index,
      startedAt,
      start: () => {
        setStartedAt(Date.now())
        go(0)
      },
      go,
      stop: () => {
        setIndex(null)
        setStartedAt(null)
      },
    }),
    [index, startedAt, go],
  )

  // ?scene=N opens scene N directly, e.g. to recover mid-demo. Only once: `go` changes with
  // every session update, and re-running this would re-apply the scene forever.
  const initialSearch = useRef(location.search)
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current) return
    deepLinkHandled.current = true
    const n = Number(new URLSearchParams(initialSearch.current).get('scene'))
    if (Number.isInteger(n) && n >= 1 && n <= SCENES.length) {
      setStartedAt(Date.now())
      go(n - 1)
    }
  }, [go])

  // → / PageDown: next scene, ← / PageUp: previous. Presentation clickers send PageDown/PageUp.
  // Listens in the capture phase, before the focused element: a Radix toggle also takes
  // PageDown/PageUp (jump to its last/first option) and marks them handled, which would swallow
  // the clicker. Once this handler has taken a key, Radix skips it.
  useEffect(() => {
    if (index === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const clicker = event.key === 'PageDown' || event.key === 'PageUp'
      const target = event.target as HTMLElement | null
      if (target?.closest(clicker ? TEXT_FIELDS : ARROW_KEY_WIDGETS)) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        go(index + 1)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, go])

  return <SceneContext.Provider value={api}>{children}</SceneContext.Provider>
}

// Scrolls the phone to the element containing `text` (or to the top), waiting for the screen to
// load. A newer scene cancels an older scroll.
function scrollPhoneTo(text: string | undefined, job: number, current: { current: number }) {
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  const started = Date.now()
  const tick = () => {
    if (current.current !== job) return
    const scroller = document.querySelector<HTMLElement>('[data-phone-scroll]')
    if (!text) {
      if (scroller) scroller.scrollTo({ top: 0 })
      else window.scrollTo({ top: 0 })
      return
    }
    const target = scroller
      ? [...scroller.querySelectorAll<HTMLElement>('h1, h2, h3, p')].find((el) => el.textContent?.includes(text))
      : undefined
    if (scroller && target) {
      const top = scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - HEADER_OFFSET
      scroller.scrollTo({ top, behavior })
    } else if (Date.now() - started < SCROLL_TIMEOUT_MS) {
      window.setTimeout(tick, 200)
    }
  }
  window.setTimeout(tick, 50)
}
