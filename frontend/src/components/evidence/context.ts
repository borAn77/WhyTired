import { createContext, useContext } from 'react'

import type { CauseId } from '@/lib/types'

// The suspects an eye check can add evidence to, and how the result names them. Training load
// and resting heart rate have no check.
export const FINDING: Partial<Record<CauseId, string>> = {
  sleep_debt: 'sleep',
  stress_spike: 'stress',
}

export type EyeCheckResult = { text: string; detail: string }

export interface EyeCheckApi {
  results: Partial<Record<CauseId, EyeCheckResult>>
  last: CauseId | null // the suspect of the most recent check
  open: (causeId: CauseId, returnFocusTo: HTMLElement | null) => void
}

export const EyeCheckContext = createContext<EyeCheckApi | null>(null)

// null outside the Detective screen's EyeCheckProvider: then no eye check is offered.
export const useEyeCheck = () => useContext(EyeCheckContext)
