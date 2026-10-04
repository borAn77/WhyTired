// Tap-along pulse for users without a watch: they feel their pulse and tap on every beat.
// The tap times become one morning pulse in bpm. Shown to the user and on the doctor summary
// as self-measured; the rule engine never reads it (docs/DECISIONS.md, D18).

export const MEASURE_MS = 30_000
export const MANUAL_MIN = 30 // typed in from a monitor: a wider range than a resting pulse
export const MANUAL_MAX = 220

const MIN_INTERVAL_MS = 250 // shorter: a double tap
const MAX_INTERVAL_MS = 2000 // longer: a pause
const MIN_INTERVALS = 10
const UNEVEN_CV = 0.25
// Same range as the engine's implausible-value rule for resting HR (CLAUDE.md, sensor artifacts).
const RESTING_MIN = 30
const RESTING_MAX = 120

export type PulseResult =
  | { kind: 'ok'; bpm: number; uneven: boolean }
  | { kind: 'too_few' }
  | { kind: 'out_of_range'; bpm: number }

/** Gaps between taps, without double taps and pauses. */
export function validIntervals(times: number[]): number[] {
  const gaps = times.slice(1).map((time, i) => time - times[i])
  return gaps.filter((gap) => gap >= MIN_INTERVAL_MS && gap <= MAX_INTERVAL_MS)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// The median gap, not taps × 2: a missed beat makes one long gap, and the median ignores it.
const bpmOf = (intervals: number[]) => Math.round(60_000 / median(intervals))

/** Live estimate while tapping, from the 4th tap on. */
export function estimateBpm(times: number[]): number | null {
  const intervals = validIntervals(times)
  return times.length >= 4 && intervals.length > 0 ? bpmOf(intervals) : null
}

/** The result after 30 seconds. Uneven: the gaps vary by more than 25% (coefficient of variation). */
export function pulseFromTaps(times: number[]): PulseResult {
  const intervals = validIntervals(times)
  if (intervals.length < MIN_INTERVALS) return { kind: 'too_few' }
  const bpm = bpmOf(intervals)
  if (bpm < RESTING_MIN || bpm > RESTING_MAX) return { kind: 'out_of_range', bpm }
  const mean = intervals.reduce((sum, gap) => sum + gap, 0) / intervals.length
  const sd = Math.sqrt(intervals.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / intervals.length)
  return { kind: 'ok', bpm, uneven: sd / mean > UNEVEN_CV }
}
