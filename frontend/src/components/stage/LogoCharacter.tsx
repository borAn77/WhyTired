import { useId } from 'react'

import { cn } from '@/lib/utils'

export type Mood = 'tired' | 'energised'

// Same geometry as LogoMark (viewBox 0 0 64 52), split into parts that can move:
// magnifier (lens + handle + face), eyelids, mouth and the heartbeat line.
// All motion lives in stage.css and switches off under prefers-reduced-motion.

const HEARTBEAT = 'M29 30.5 H37.5 L41 16 L45 40.5 L48.2 26.5 L50.8 32.5 L53.4 30.5 H63'

export function CharacterParts({
  mood = 'tired',
  heartbeat = true,
  scanning = false,
}: {
  mood?: Mood
  heartbeat?: boolean
  scanning?: boolean
}) {
  const id = useId().replace(/:/g, '')
  return (
    <g className={cn('wt-char', `wt-char--${mood}`, scanning && 'wt-char--scan')}>
      <defs>
        <clipPath id={`${id}-l`}>
          <circle cx="15.5" cy="20" r="4.1" />
        </clipPath>
        <clipPath id={`${id}-r`}>
          <circle cx="28.5" cy="20" r="4.1" />
        </clipPath>
      </defs>

      <g className="wt-char__magnifier">
        <circle cx="22" cy="22" r="16" fill="var(--wt-navy-500)" stroke="var(--wt-navy-900)" strokeWidth="4.5" />
        <path d="M33.8 33.8 L43 43" stroke="var(--wt-navy-900)" strokeWidth="6.5" strokeLinecap="round" />

        {[
          { cx: 15.5, clip: `${id}-l` },
          { cx: 28.5, clip: `${id}-r` },
        ].map(({ cx, clip }) => (
          <g key={cx}>
            <circle cx={cx} cy="20" r="4.1" fill="#fff" />
            <circle className="wt-char__pupil" cx={cx} cy="21.4" r="1.7" fill="var(--wt-navy-900)" />
            <g clipPath={`url(#${clip})`}>
              {/* Eyelid: the mood sets how far it hangs, the inner group blinks. */}
              <g className="wt-char__lid">
                <g className="wt-char__blink">
                  <rect x={cx - 5} y="10" width="10" height="10" fill="var(--wt-navy-500)" />
                  <path d={`M${cx - 5} 20 H${cx + 5}`} stroke="var(--wt-navy-900)" strokeWidth="1.6" />
                </g>
              </g>
            </g>
          </g>
        ))}

        <path
          className="wt-char__mouth wt-char__mouth--tired"
          d="M18.6 29 C20.2 27.9 21.6 29.6 23.2 28.7 S25.4 28.1 26.2 28.8"
          fill="none"
          stroke="var(--wt-navy-900)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          className="wt-char__mouth wt-char__mouth--happy"
          d="M18.4 27.8 Q22.4 31.6 26.4 27.8"
          fill="none"
          stroke="var(--wt-navy-900)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>

      {heartbeat && (
        <g className="wt-char__heartbeat">
          <path
            className="wt-char__beat"
            d={HEARTBEAT}
            pathLength={1}
            fill="none"
            stroke="var(--wt-coral-500)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* a short bright blip that runs along the line: the "pulse" */}
          <path
            className="wt-char__blip"
            d={HEARTBEAT}
            pathLength={1}
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  )
}

/** The animated logo character as a standalone SVG. */
export function LogoCharacter({
  mood = 'tired',
  scanning = false,
  className,
  title,
}: {
  mood?: Mood
  scanning?: boolean
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 64 52"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      overflow="visible"
    >
      <CharacterParts mood={mood} scanning={scanning} />
    </svg>
  )
}
