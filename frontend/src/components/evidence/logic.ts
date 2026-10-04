// Pure logic for the eye check. No imports, so logic.check.ts can run it with plain Node.
// The result is shown as extra evidence only: it never changes a cause's rank or confidence.

export type Point = { x: number; y: number }
export type Sample = { t: number; ear: number | null } // time in ms; null when no face was found
export type EyeResult = { blinks: number; blinkMs: number | null; perclos: number }
export type EyeBaseline = { blinkMs: number; perclos: number }

// Six face-mesh landmarks per eye (MediaPipe): corner, two upper lid, other corner, two lower lid.
const EYES = [
  [33, 160, 158, 133, 153, 144],
  [362, 385, 387, 263, 373, 380],
]

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

// Eye aspect ratio (Soukupová & Čech, CVWW 2016): lid opening divided by eye width, averaged
// over both eyes. It drops towards 0 as the eyes close.
export function eyeAspectRatio(face: Point[]) {
  const [a, b] = EYES.map(
    ([p1, p2, p3, p4, p5, p6]) => (dist(face[p2], face[p6]) + dist(face[p3], face[p5])) / (2 * dist(face[p1], face[p4])),
  )
  return (a + b) / 2
}

const BLINK = 0.5 // a blink: the eye more than half closed, compared with the person's own open eye
const PERCLOS_CLOSED = 0.8 // PERCLOS counts time with the eyes more than 80% closed (Dinges & Grace, 1998)
const MIN_BLINK_MS = 50
const MAX_BLINK_MS = 500 // longer closures are not blinks; they still count for PERCLOS

// Blink count, average blink duration and PERCLOS from 30 s of samples. Longer blinks are a
// sign of sleepiness (Caffier et al., Eur J Appl Physiol 2003). Frames without a face are skipped.
export function analyseEyes(samples: Sample[]): EyeResult {
  const ears = samples.flatMap((s) => (s.ear === null ? [] : [s.ear])).sort((a, b) => a - b)
  if (ears.length < 2) return { blinks: 0, blinkMs: null, perclos: 0 }
  const open = ears[Math.floor(0.9 * (ears.length - 1))] // the person's open eye, robust to a few wide frames

  const blinks: number[] = []
  let closedMs = 0
  let totalMs = 0
  let blinkStart: number | null = null
  for (let i = 1; i < samples.length; i++) {
    const { t, ear } = samples[i - 1]
    if (ear === null) {
      blinkStart = null
      continue
    }
    const closed = 1 - ear / open
    const dt = samples[i].t - t
    totalMs += dt
    if (closed > PERCLOS_CLOSED) closedMs += dt
    if (closed > BLINK) blinkStart ??= t
    else if (blinkStart !== null) {
      const ms = t - blinkStart
      if (ms >= MIN_BLINK_MS && ms <= MAX_BLINK_MS) blinks.push(ms)
      blinkStart = null
    }
  }
  return {
    blinks: blinks.length,
    blinkMs: blinks.length ? Math.round(blinks.reduce((sum, ms) => sum + ms, 0) / blinks.length) : null,
    perclos: totalMs ? Math.round((closedMs / totalMs) * 100) : 0,
  }
}

// The example sleepy result for "Show demo result": blinks 25% slower, eyes closed 12% of the time.
export const demoResult = (usual: EyeBaseline): EyeResult => ({
  blinks: 9,
  blinkMs: Math.round(usual.blinkMs * 1.25),
  perclos: 12,
})

// More than 10% above the usual blink duration or eyes-closed time counts as sleepy.
export function eyeText(result: EyeResult, usual: EyeBaseline, finding: string) {
  const blinkMs = result.blinkMs ?? 0
  const parts = [
    blinkMs > usual.blinkMs * 1.1 && `your blinks were ${Math.round((blinkMs / usual.blinkMs - 1) * 100)}% slower than usual`,
    result.perclos > usual.perclos * 1.1 && `your eyes were closed ${result.perclos}% of the time`,
  ].filter((part): part is string => Boolean(part))
  if (parts.length === 0) return 'Your eyes look alert today.'
  const text = parts.join(' and ')
  return `${text[0].toUpperCase()}${text.slice(1)}. Signs of sleepiness, which supports the ${finding} finding.`
}

export function eyeDetail(result: EyeResult, usual: EyeBaseline) {
  const blink = result.blinkMs === null ? 'none measured' : `${result.blinkMs} ms each on average`
  return `Today: ${result.blinks} blinks, ${blink}, eyes closed ${result.perclos}% of the time. Usual: ${usual.blinkMs} ms, ${usual.perclos}% (example baseline, demo).`
}
