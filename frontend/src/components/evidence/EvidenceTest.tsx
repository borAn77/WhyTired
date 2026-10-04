import { useRef } from 'react'
import { Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { CauseId } from '@/lib/types'

import { FINDING, useEyeCheck, type EyeCheckResult } from './context'

// "Check it yourself" on a sleep or stress suspect card, plus that suspect's eye-check result.
// The check itself runs in EyeCheckProvider's sheet.
export function EvidenceTest({ causeId }: { causeId: CauseId }) {
  const eyeCheck = useEyeCheck()
  const buttonRef = useRef<HTMLButtonElement>(null)
  if (!eyeCheck || !FINDING[causeId]) return null
  const result = eyeCheck.results[causeId]

  return (
    <>
      {result && <EyeResultLine result={result} />}
      <Button
        ref={buttonRef}
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => eyeCheck.open(causeId, buttonRef.current)}
        className="h-auto min-h-12 w-full justify-start gap-3 whitespace-normal rounded-xl py-2.5 text-left"
      >
        <Eye aria-hidden className="size-5 text-coral-600" />
        <span>
          <span className="block text-base font-semibold">{result ? 'Test again' : 'Check it yourself'}</span>
          <span className="block text-sm font-normal text-muted-foreground">Eye check · 30 s</span>
        </span>
      </Button>
    </>
  )
}

export function EyeResultLine({ result }: { result: EyeCheckResult }) {
  return (
    <div className="rounded-2xl bg-navy-50 p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-navy-700">
        <Eye aria-hidden className="size-4" />
        Eye check
      </p>
      <p className="mt-2">{result.text}</p>
      <p className="mt-1 text-sm text-muted-foreground">{result.detail} A signal, not a diagnosis.</p>
    </div>
  )
}
