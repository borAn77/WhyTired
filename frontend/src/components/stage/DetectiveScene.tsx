import { useEffect, useState } from 'react'

import { CharacterParts } from './LogoCharacter'
import { usePrefersReducedMotion } from './motion'
import { FINDING, type PersonaKey } from './story'

// Two bars: "usual" and "this week". The magnifier starts over "usual", slides to
// "this week" and finds it: that bar turns coral and gets its label.

const W = 240
const BASE = 150
const MAX_H = 100
const BARS = [{ x: 44 }, { x: 140 }]
const BAR_W = 56
const SCALE = 0.9 // magnifier size inside the scene
const LENS = 22 * SCALE // lens centre inside the character's own coordinates

export function DetectiveScene({ persona }: { persona: PersonaKey }) {
  const reduce = usePrefersReducedMotion()
  const [found, setFound] = useState(false)
  const f = FINDING[persona]

  useEffect(() => {
    if (reduce) return undefined
    const t = setTimeout(() => setFound(true), 1900)
    return () => clearTimeout(t)
  }, [reduce])

  const isFound = found || reduce
  const max = Math.max(f.usual, f.now)
  const heights = [f.usual, f.now].map((v) => (v / max) * MAX_H)
  const target = isFound ? 1 : 0
  const cx = BARS[target].x + BAR_W / 2
  const top = BASE - heights[target]
  // Lens rests just above the bar it is looking at.
  const lensX = cx - LENS
  const lensY = top - 18 - LENS

  return (
    <figure className="stage-scene">
      <svg
        viewBox={`0 0 ${W} 176`}
        role="img"
        aria-label={`${f.metric}: usual ${f.format(f.usual)}, this week ${f.format(f.now)} (${f.delta}, ${f.confidence} confidence).`}
      >
        <line x1="8" x2={W - 8} y1={BASE} y2={BASE} className="stage-scene__base" />
        {BARS.map((b, i) => {
          const value = i === 0 ? f.usual : f.now
          const h = heights[i]
          const hot = i === 1 && isFound
          return (
            <g key={i}>
              <rect
                x={b.x}
                y={BASE - h}
                width={BAR_W}
                height={h}
                rx="6"
                className={hot ? 'stage-scene__bar is-hot' : i === 0 ? 'stage-scene__bar is-usual' : 'stage-scene__bar'}
              />
              <text x={b.x + BAR_W / 2} y={BASE + 18} textAnchor="middle" className="stage-scene__label">
                {i === 0 ? 'usual' : 'this week'}
              </text>
              <text
                x={b.x + BAR_W / 2}
                y={BASE - h + 20}
                textAnchor="middle"
                className={hot ? 'stage-scene__value is-hot' : 'stage-scene__value'}
              >
                {f.format(value)}
              </text>
            </g>
          )
        })}
        <g
          className="stage-scene__lens"
          style={{ transform: `translate(${lensX}px, ${lensY}px) scale(${SCALE})` }}
        >
          <CharacterParts heartbeat={false} scanning={!isFound} />
        </g>
      </svg>
      <figcaption className={isFound ? 'stage-scene__caption is-found' : 'stage-scene__caption'}>
        <span className="stage-scene__metric">{f.metric}</span>
        <span className="stage-scene__delta">
          {isFound ? `${f.delta} · ${f.confidence} confidence` : 'Searching your own history…'}
        </span>
      </figcaption>
    </figure>
  )
}
