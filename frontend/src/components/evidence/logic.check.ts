// Self-check for logic.ts. Run from frontend/: node src/components/evidence/logic.check.ts
import { analyseEyes, demoResult, eyeAspectRatio, eyeText, type Point, type Sample } from './logic.ts'

const check = (label: string, pass: boolean) => {
  if (!pass) throw new Error(`FAIL: ${label}`)
}

// An eye 0.1 wide with lids 0.03 apart has a ratio of 0.3.
const face: Point[] = Array.from({ length: 468 }, () => ({ x: 0, y: 0 }))
for (const [p1, p2, p3, p4, p5, p6] of [
  [33, 160, 158, 133, 153, 144],
  [362, 385, 387, 263, 373, 380],
]) {
  face[p1] = { x: 0, y: 0 }
  face[p4] = { x: 0.1, y: 0 }
  face[p2] = { x: 0.03, y: -0.015 }
  face[p6] = { x: 0.03, y: 0.015 }
  face[p3] = { x: 0.07, y: -0.015 }
  face[p5] = { x: 0.07, y: 0.015 }
}
check('eye aspect ratio', Math.abs(eyeAspectRatio(face) - 0.3) < 1e-9)

// 30 s at 30 fps: open eyes (0.30), 6 blinks of 200 ms, one 1 s closure, and 1 s without a face.
const samples: Sample[] = []
const frame = 1000 / 30
const closedAt = (ms: number) =>
  [2000, 6000, 10000, 14000, 18000, 22000].some((start) => ms >= start && ms < start + 200) || (ms >= 25000 && ms < 26000)
for (let ms = 0; ms < 30000; ms += frame) {
  samples.push({ t: ms, ear: ms >= 27000 && ms < 28000 ? null : closedAt(ms) ? 0.04 : 0.3 })
}
const result = analyseEyes(samples)
check('6 blinks, the 1 s closure is not one', result.blinks === 6)
check('blink duration about 200 ms', result.blinkMs !== null && Math.abs(result.blinkMs - 200) <= frame)
check('PERCLOS counts blinks and the closure: 2.2 s of 29 s', result.perclos === 8)
check('no face: nothing measured', analyseEyes([{ t: 0, ear: null }, { t: 33, ear: null }]).blinkMs === null)

const usual = { blinkMs: 160, perclos: 5 }
check(
  'sleepy text',
  eyeText(demoResult(usual), usual, 'sleep') ===
    'Your blinks were 25% slower than usual and your eyes were closed 12% of the time. Signs of sleepiness, which supports the sleep finding.',
)
check('only eyes closed longer', eyeText({ blinks: 8, blinkMs: 150, perclos: 9 }, usual, 'stress').startsWith('Your eyes were closed 9%'))
check('within +10% is alert', eyeText({ blinks: 8, blinkMs: 176, perclos: 5 }, usual, 'sleep') === 'Your eyes look alert today.')

console.log('logic.check: all passed')
