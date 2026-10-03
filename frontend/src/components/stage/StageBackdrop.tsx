// Faint heartbeat lines behind the stage: one coral, one slate, drifting slowly.
// Decorative only; paused with the rest of the stage when the tab is hidden.

const BEAT =
  'M0 60 H180 L200 60 L214 20 L232 104 L246 44 L258 72 L270 60 H520 L540 60 L554 20 L572 104 L586 44 L598 72 L610 60 H860 L880 60 L894 20 L912 104 L926 44 L938 72 L950 60 H1200'

export function StageBackdrop() {
  return (
    <div className="stage-backdrop" aria-hidden="true">
      <svg className="stage-backdrop__lines" viewBox="0 0 1200 140" preserveAspectRatio="none">
        <path className="stage-backdrop__line is-slate" d={BEAT} transform="translate(0 -26)" />
        <path className="stage-backdrop__line is-coral" d={BEAT} pathLength={1} />
      </svg>
    </div>
  )
}
