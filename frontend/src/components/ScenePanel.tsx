import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Timer, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useScenes } from '@/lib/sceneContext'
import { SCENES } from '@/lib/scenes'
import { cn } from '@/lib/utils'

const TIMED = SCENES.filter((scene) => !scene.bonus)
const TOTAL_SECONDS = TIMED.reduce((sum, scene) => sum + scene.seconds, 0)
const SLACK_SECONDS = 10

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// The presenter's script card: what to say and tap in each scene, and whether we are on time.
export function ScenePanel() {
  const { index, startedAt, start, go, stop } = useScenes()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (index === null) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [index])

  // Idle: one compact row, so the presenter column stays shorter than the phone.
  if (index === null) {
    return (
      <Button className="h-11 w-full gap-2 bg-navy-900 font-semibold text-white hover:bg-navy-800" onClick={start}>
        <Play aria-hidden className="text-coral-500" />
        Demo script
        <span className="ml-auto font-normal text-navy-100">
          {TIMED.length} scenes · {clock(TOTAL_SECONDS)}
        </span>
      </Button>
    )
  }

  const scene = SCENES[index]
  const elapsed = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0
  const target = SCENES.slice(0, index + 1).reduce((sum, s) => sum + (s.bonus ? 0 : s.seconds), 0)
  const behind = !scene.bonus && elapsed > target + SLACK_SECONDS

  return (
    <section aria-label="Demo script" className="space-y-3 rounded-xl bg-navy-900 p-4 text-white">
      <div className="flex items-center justify-between gap-2">
        <p className="whitespace-nowrap text-sm font-bold uppercase tracking-[0.12em] text-coral-500">
          {scene.bonus ? 'Bonus' : `Scene ${index + 1}/${TIMED.length}`}
        </p>
        <p
          className={cn(
            'flex items-center gap-1 whitespace-nowrap text-sm tabular-nums',
            behind ? 'font-semibold text-coral-500' : 'text-navy-100',
          )}
        >
          <Timer aria-hidden className="size-4" />
          {clock(elapsed)} / {clock(target)}
          {behind && <span className="sr-only"> (behind schedule)</span>}
        </p>
      </div>
      <div aria-live="polite">
        <p className="font-semibold leading-snug">{scene.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-navy-100">{scene.say}</p>
        {scene.tap && (
          <p className="mt-2 text-sm leading-relaxed">
            <span className="font-semibold text-coral-500">Tap: </span>
            {scene.tap}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          className="h-10 flex-1 bg-white/10 text-white hover:bg-white/20"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          aria-label="Previous scene"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          className="h-10 flex-[3] bg-coral-500 font-semibold text-navy-900 hover:bg-coral-500/90"
          disabled={index === SCENES.length - 1}
          onClick={() => go(index + 1)}
        >
          Next scene
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <ol className="flex flex-wrap gap-1.5" aria-label="All scenes">
        {SCENES.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-label={`Scene ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'grid size-7 place-items-center rounded-md text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                i === index ? 'bg-coral-500 text-navy-900' : 'bg-white/10 text-white hover:bg-white/20',
              )}
            >
              {s.bonus ? '★' : i + 1}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={stop}
        className="flex items-center gap-1.5 rounded text-sm text-navy-100 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
      >
        <X aria-hidden className="size-4" />
        Stop the script
      </button>
    </section>
  )
}
