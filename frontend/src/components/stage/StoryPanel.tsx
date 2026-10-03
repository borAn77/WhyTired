import { DetectiveScene } from './DetectiveScene'
import { LogoCharacter } from './LogoCharacter'
import { AFTER, PERSONA_LABEL, storyFor } from './story'
import { useStageState } from './useStageState'

export function StoryPanel({ compact = false }: { compact?: boolean }) {
  const { pathname, persona, finished, scenario, mood } = useStageState()
  const after = pathname === '/experiment' && finished
  const story = after ? AFTER[scenario] : storyFor(pathname, persona)
  const detective = pathname === '/detective'

  return (
    <section className={compact ? 'stage-story is-compact' : 'stage-story'} aria-label="What is happening in the demo">
      {/* Keyed so the copy fades in again on every screen or persona change. */}
      <div key={`${pathname}-${persona}-${after ? scenario : ''}`} className="stage-story__inner">
        {detective ? (
          <DetectiveScene persona={persona} />
        ) : (
          <div className={`stage-story__character is-${mood}`}>
            <LogoCharacter mood={mood} className="stage-story__mark" title={`WhyTired logo, ${mood}`} />
            {mood === 'energised' && <span className="stage-story__badge">Energised · after the experiment</span>}
          </div>
        )}

        <p className="stage-story__persona">{PERSONA_LABEL[persona]}</p>
        <p className="stage-story__step">{story.step}</p>
        <h2 className="stage-story__title">{story.title}</h2>
        {!compact && <p className="stage-story__body">{story.body}</p>}
        {story.note && <p className="stage-story__note">{story.note}</p>}
      </div>
    </section>
  )
}
