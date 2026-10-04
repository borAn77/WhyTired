import { useRef } from 'react'
import { ChevronLeft, ChevronRight, FlaskConical, Play, RotateCcw, Search, Stethoscope, Sunrise, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useScenes } from '@/lib/sceneContext'
import { SCENES } from '@/lib/scenes'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

import { DetectiveScene } from './DetectiveScene'
import { LogoCharacter } from './LogoCharacter'
import { PERSONA_LABEL } from './story'
import { StoryPanel } from './StoryPanel'
import { useStageState } from './useStageState'

// The side of the stage, written for someone who opens the demo link cold (a judge): a welcome
// with one action, the guided tour's captions while it runs, and what to do once it ends.
// Someone exploring the app on their own sees the story of the current screen instead.
// The tour is the presenter's demo script (lib/scenes.ts), so the same keys and clicker work.

const JOURNEY = [
  { icon: Sunrise, label: 'Check-in' },
  { icon: Search, label: 'Detective' },
  { icon: FlaskConical, label: '7-day test' },
  { icon: Stethoscope, label: 'Doctor' },
]

export function StagePanel({ compact = false }: { compact?: boolean }) {
  const { session } = useSession()
  const { index, done, start } = useScenes()

  if (index !== null) return <TourStep index={index} compact={compact} />
  if (done) return <TourDone compact={compact} />
  if (!session.onboarded) return <Welcome compact={compact} />
  return (
    <div className="stage-tour">
      <StoryPanel compact={compact} />
      <Button variant="outline" className="stage-tour__secondary" onClick={start}>
        <Play aria-hidden className="text-coral-600" />
        Take the 2-min tour
      </Button>
    </div>
  )
}

function Welcome({ compact }: { compact: boolean }) {
  const { start } = useScenes()
  return (
    <section className={cn('stage-story stage-tour', compact && 'is-compact')} aria-labelledby="stage-welcome">
      <div className="stage-story__inner">
        <div className="stage-story__character">
          <LogoCharacter mood="tired" className="stage-story__mark" title="WhyTired logo" />
        </div>
        <h2 id="stage-welcome" className="stage-story__title">
          A detective for your tiredness.
        </h2>
        <p className="stage-story__body">For students who train, with or without a smartwatch.</p>
        <Journey />
        <Button className="stage-tour__primary" onClick={start}>
          <Play aria-hidden />
          Take the 2-min tour
        </Button>
        <p className="stage-tour__hint">
          Or try it yourself: tap <b>Get started</b> in the phone.
        </p>
      </div>
    </section>
  )
}

function TourStep({ index, compact }: { index: number; compact: boolean }) {
  const { go, stop, finish } = useScenes()
  const { pathname, persona, mood } = useStageState()
  const nextRef = useRef<HTMLButtonElement>(null)
  const scene = SCENES[index]
  const last = index === SCENES.length - 1

  const back = () => {
    go(index - 1)
    if (index === 1) nextRef.current?.focus() // "Back" is about to be disabled
  }

  return (
    <section className={cn('stage-story stage-tour is-step', compact && 'is-compact')} aria-label="Guided tour">
      {/* Keyed like the story panel, so the picture only replays when the screen or persona changes.
          The picture and the text keep a fixed height, so "Next" stays under the mouse. */}
      <div key={`${pathname}-${persona}-${mood}`} className="stage-tour__visual">
        {pathname === '/detective' ? (
          <DetectiveScene persona={persona} />
        ) : (
          <LogoCharacter mood={mood} className="stage-story__mark" title={`WhyTired logo, ${mood}`} />
        )}
      </div>

      <div key={index} className="stage-story__inner stage-tour__text" aria-live="polite">
        <p className="stage-story__persona">{PERSONA_LABEL[persona]}</p>
        <p className="stage-story__step">
          Step {index + 1} of {SCENES.length}
        </p>
        <div aria-hidden className="stage-tour__progress">
          {SCENES.map((s, i) => (
            <span key={s.title} className={i <= index ? 'is-done' : undefined} />
          ))}
        </div>
        <h2 className="stage-story__title">{scene.headline}</h2>
        <p className="stage-story__body">{scene.caption}</p>
      </div>

      <div className="stage-tour__nav">
        <Button
          variant="outline"
          className="stage-tour__back"
          disabled={index === 0}
          onClick={back}
          aria-label="Previous step"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button ref={nextRef} autoFocus className="stage-tour__primary" onClick={() => (last ? finish() : go(index + 1))}>
          {last ? 'Finish' : 'Next'}
          <ChevronRight aria-hidden />
        </Button>
        <button type="button" className="stage-tour__exit" onClick={stop}>
          <X aria-hidden className="size-4" />
          Exit tour
        </button>
      </div>
    </section>
  )
}

function TourDone({ compact }: { compact: boolean }) {
  const { start, stop } = useScenes()
  const { reset } = useSession()
  const { mood } = useStageState()
  const navigate = useNavigate()

  const tryIt = () => {
    stop()
    reset()
    navigate('/onboarding')
  }

  return (
    <section className={cn('stage-story stage-tour', compact && 'is-compact')} aria-labelledby="stage-done">
      <div className="stage-story__inner">
        <div className="stage-story__character">
          <LogoCharacter mood={mood} className="stage-story__mark" title={`WhyTired logo, ${mood}`} />
        </div>
        <h2 id="stage-done" className="stage-story__title">
          That’s WhyTired.
        </h2>
        <Journey />
        <div className="stage-tour__nav">
          <Button autoFocus className="stage-tour__primary" onClick={tryIt}>
            Try it yourself
            <ChevronRight aria-hidden />
          </Button>
          <Button variant="outline" className="stage-tour__secondary" onClick={start}>
            <RotateCcw aria-hidden />
            Watch again
          </Button>
        </div>
        <p className="stage-tour__hint">It runs on Kasia’s example data. No account needed.</p>
      </div>
    </section>
  )
}

// The four steps of the product, as icons: the whole idea before reading a word of the app.
function Journey() {
  return (
    <ol className="stage-tour__journey" aria-label="How WhyTired works">
      {JOURNEY.map(({ icon: Icon, label }, i) => (
        <li key={label}>
          <span className="stage-tour__journey-icon">
            <Icon aria-hidden />
          </span>
          <span>
            <span className="sr-only">{i + 1}. </span>
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}
