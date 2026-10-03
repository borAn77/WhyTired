import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react'

import { LogoCharacter, type Mood } from '@/components/stage/LogoCharacter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { TOUR } from './content'

const PAD = 6 // spotlight margin around the target

// What each step points at, found in what Today already renders, so the screens need no tour
// hooks: the check-in link (or the "Start my check-in" footer, which Screen renders right after
// <main>), today's advice card (or the detective radar), and the Ask WhyTired button.
function findTarget(step: number, scroll: HTMLElement, button: HTMLElement | null) {
  if (step === 0) return scroll.querySelector<HTMLElement>('a[href="/check-in"]') ?? scroll.querySelector<HTMLElement>('main + div')
  if (step === 1)
    return (
      scroll.querySelector<HTMLElement>('[aria-labelledby="advice"]') ??
      scroll.querySelector<HTMLElement>('[aria-label="Detective radar"]')
    )
  return button
}

type Spot = { top: number; left: number; width: number; height: number; frameHeight: number }

export function Tour({
  step,
  scrollRef,
  buttonRef,
  mood,
  onNext,
  onClose,
}: {
  step: number
  scrollRef: RefObject<HTMLDivElement | null>
  buttonRef: RefObject<HTMLButtonElement | null>
  mood: Mood
  onNext: () => void
  onClose: () => void
}) {
  const [spot, setSpot] = useState<Spot | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const last = step === TOUR.length - 1

  // Measures the target relative to the phone screen, again whenever the screen changes
  // (today's advice loads late), scrolls or resizes.
  useEffect(() => {
    const scroll = scrollRef.current
    const frame = scroll?.parentElement // the phone screen ([data-phone-frame])
    if (!scroll || !frame) return
    let shown: HTMLElement | null = null
    const measure = () => {
      const target = findTarget(step, scroll, buttonRef.current)
      if (!target) return setSpot(null)
      if (target !== shown) {
        shown = target
        target.scrollIntoView({ block: 'nearest' })
      }
      const t = target.getBoundingClientRect()
      const f = frame.getBoundingClientRect()
      setSpot({ top: t.top - f.top, left: t.left - f.left, width: t.width, height: t.height, frameHeight: f.height })
    }
    measure()
    const settled = window.setTimeout(measure, 400) // after the screen's slide-in
    const observer = new MutationObserver(measure)
    observer.observe(scroll, { childList: true, subtree: true })
    scroll.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(settled)
      observer.disconnect()
      scroll.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [step, scrollRef, buttonRef])

  useEffect(() => nextRef.current?.focus(), [step])

  // The card goes on the side of the target with more room; centered when there is no target.
  let cardStyle: CSSProperties | undefined
  if (spot)
    cardStyle =
      spot.top + spot.height / 2 < spot.frameHeight / 2
        ? { top: spot.top + spot.height + PAD + 12 }
        : { bottom: spot.frameHeight - spot.top + PAD + 12 }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      className={cn('absolute inset-0 z-40', !spot && 'bg-navy-900/55')}
    >
      {spot && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-coral-500 motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: spot.top - PAD,
            left: spot.left - PAD,
            width: spot.width + PAD * 2,
            height: spot.height + PAD * 2,
            boxShadow: '0 0 0 9999px color-mix(in srgb, var(--wt-navy-900) 55%, transparent)',
          }}
        />
      )}
      <div
        key={step}
        className={cn(
          'absolute inset-x-4 rounded-3xl bg-card p-5 shadow-2xl motion-safe:animate-in motion-safe:fade-in',
          !spot && 'top-1/2 -translate-y-1/2',
        )}
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <LogoCharacter mood={mood} className="mt-1 w-12 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-coral-700">
              Step {step + 1} of {TOUR.length}
            </p>
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              {TOUR[step].title}
            </h2>
            <p id={bodyId} className="mt-1 text-muted-foreground">
              {TOUR[step].body}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" className="h-11 px-4 text-base" onClick={onClose}>
            Skip
          </Button>
          <Button ref={nextRef} className="h-11 px-5 text-base" onClick={last ? onClose : onNext}>
            {last ? 'Got it' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
