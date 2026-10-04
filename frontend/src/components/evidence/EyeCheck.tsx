import { useEffect, useRef, useState } from 'react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
// Pinned to 0.10.21: from 1.0 on, the library sends usage logs to Google, which would break
// "nothing is sent". 0.10.21 doesn't export its Wasm files, so they are imported by path.
import wasmLoaderPath from '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryPath from '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'

import { LogoCharacter } from '@/components/stage/LogoCharacter'
import { Button } from '@/components/ui/button'

import { analyseEyes, eyeAspectRatio, type EyeResult, type Sample } from './logic'

const SECONDS = 30
const NO_FACE_MS = 5000
const PRIVACY = 'The video stays on your device. Nothing is recorded or sent.'

const FAILURES = {
  camera: 'No camera is available, or another app is using it.',
  denied: 'Camera access was not allowed.',
  face: 'No face found for 5 seconds. Face the screen in good light and try again.',
  model: "The eye check couldn't start on this device.",
}
type Failure = keyof typeof FAILURES

// Everything runs in the browser: the library is loaded only when a check starts, the model is
// served from public/models/ and the Wasm files are bundled by Vite, so nothing else is fetched.
async function createLandmarker() {
  const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`, delegate },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
  })
  const files = { wasmLoaderPath, wasmBinaryPath }
  // The GPU is faster; some laptops can't use it from the browser, so fall back to the CPU.
  return FaceLandmarker.createFromOptions(files, options('GPU')).catch(() =>
    FaceLandmarker.createFromOptions(files, options('CPU')),
  )
}

// 30 s of front-camera video: the eye aspect ratio of every frame, then blinks and PERCLOS
// (logic.ts). The camera stops the moment the check ends, fails or the sheet closes.
export function EyeCheck({ onDone, onDemo }: { onDone: (result: EyeResult) => void; onDemo: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'loading' | 'running' | 'failed'>('intro')
  const [failure, setFailure] = useState<Failure>('model')
  const [left, setLeft] = useState(SECONDS)
  const [attempt, setAttempt] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const character = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (attempt === 0) return
    let cancelled = false
    let stream: MediaStream | null = null
    let landmarker: FaceLandmarker | null = null
    let frame = 0
    // Stops the camera and frees the model. Safe to call more than once.
    const release = () => {
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      landmarker?.close()
      landmarker = null
    }
    const fail = (reason: Failure) => {
      release()
      setFailure(reason)
      setPhase('failed')
    }

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      } catch (error) {
        const name = (error as Error).name
        return fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'camera')
      }
      if (cancelled) return release()
      try {
        landmarker = await createLandmarker()
      } catch {
        return fail('model')
      }
      const el = video.current
      if (cancelled || !el) return release()
      el.srcObject = stream
      await el.play().catch(() => {})
      setPhase('running')

      const samples: Sample[] = []
      const start = performance.now()
      let lastFace = start
      let lastFrame = -1
      let open = 0 // running estimate of the open eye, only for the character's lids
      let shown = SECONDS
      const tick = () => {
        if (!landmarker) return
        const now = performance.now()
        if (el.currentTime !== lastFrame) {
          lastFrame = el.currentTime
          let face
          try {
            face = landmarker.detectForVideo(el, now).faceLandmarks[0]
          } catch {
            return fail('model')
          }
          const ear = face ? eyeAspectRatio(face) : null
          samples.push({ t: now, ear })
          if (ear !== null) {
            lastFace = now
            open = Math.max(ear, open * 0.995)
            const closed = Math.min(1, Math.max(0, 1 - ear / open))
            character.current?.style.setProperty('--lid', `${-3.8 + 8.2 * closed}px`) // wide open → shut
          }
        }
        if (now - lastFace > NO_FACE_MS) return fail('face')
        const remaining = Math.max(0, Math.ceil(SECONDS - (now - start) / 1000))
        if (remaining !== shown) {
          shown = remaining
          setLeft(remaining)
        }
        if (remaining === 0) {
          release()
          return onDone(analyseEyes(samples))
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    run()
    return () => {
      cancelled = true
      release()
    }
  }, [attempt, onDone])

  const start = () => {
    setLeft(SECONDS)
    setPhase('loading')
    setAttempt((n) => n + 1)
  }

  if (phase === 'intro')
    return (
      <div className="space-y-3">
        <div className="evidence-eyes grid h-36 place-items-center rounded-3xl bg-card ring-1 ring-border">
          <LogoCharacter mood="tired" className="w-32" />
        </div>
        <p>
          Look at the screen for 30 seconds and blink normally. WhyTired measures how long your blinks take and how
          much of the time your eyes are closed.
        </p>
        <p className="rounded-2xl bg-navy-50 p-3 text-sm">
          Best done at the same time each morning, at least 20 minutes after waking.
        </p>
        <p className="text-sm text-muted-foreground">{PRIVACY}</p>
        <Button className="h-12 w-full text-base" onClick={start}>
          Start the camera
        </Button>
      </div>
    )

  if (phase === 'failed')
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 font-medium text-amber-800">
          {FAILURES[failure]}
        </p>
        <Button className="h-12 w-full text-base" onClick={onDemo}>
          Show demo result
        </Button>
        <Button variant="ghost" className="h-11 w-full text-base" onClick={start}>
          Try again
        </Button>
      </div>
    )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-border">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Your camera, mirrored"
          className="size-28 -scale-x-100 rounded-2xl bg-navy-900 object-cover"
        />
        <div ref={character} className="evidence-eyes">
          <LogoCharacter mood="tired" className="w-28" />
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground">{PRIVACY}</p>
      <p aria-live="polite" className="text-center font-semibold">
        {phase === 'loading' ? 'Starting the camera…' : 'Look at the screen and blink normally.'}
      </p>
      {phase === 'running' && (
        <p role="timer" className="text-center text-3xl font-bold tabular-nums">
          {left} s
        </p>
      )}
    </div>
  )
}
