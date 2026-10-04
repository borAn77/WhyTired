import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

// A group of tap-to-pick buttons: role="radio" options, or role="checkbox" ones with `multiple`.
// Keyboard users move between the options with the arrow keys (Home and End jump to the ends)
// and pick with Space or Enter. The arrows only move focus, unlike native radios, because a pick
// on the check-in moves straight on to the next card. A single-choice group is one Tab stop, on
// the picked option or else the first one (the WAI-ARIA radio group pattern).
export function ChoiceGroup({
  label,
  multiple = false,
  className,
  children,
}: {
  label: string
  multiple?: boolean
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  // The options are plain buttons that each screen renders itself, so the Tab stop is set on
  // them here after every render, from their aria-checked state.
  useLayoutEffect(() => {
    if (multiple) return
    const options = optionsIn(ref.current)
    const stop = options.find((option) => option.getAttribute('aria-checked') === 'true') ?? options[0]
    for (const option of options) option.tabIndex = option === stop ? 0 : -1
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The demo script takes ← and → first and marks them handled (SceneProvider).
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    const options = optionsIn(ref.current)
    const at = options.indexOf(event.target as HTMLElement)
    const to = at === -1 ? null : nextIndex(event.key, at, options.length)
    if (to === null) return
    event.preventDefault() // the arrows would also scroll the screen
    options[to].focus()
  }

  return (
    <div
      ref={ref}
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className={className}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

const optionsIn = (group: HTMLElement | null) =>
  group ? [...group.querySelectorAll<HTMLElement>('[role="radio"], [role="checkbox"]')] : []

// Down/Right: next option, Up/Left: previous (both wrap around), Home/End: first/last.
function nextIndex(key: string, at: number, count: number): number | null {
  if (key === 'ArrowDown' || key === 'ArrowRight') return (at + 1) % count
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (at - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
