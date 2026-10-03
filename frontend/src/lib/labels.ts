import { ClipboardList, Smartphone, Watch, type LucideIcon } from 'lucide-react'

import type { Confidence, DataLevel } from './types'

// Plain-language labels shared by several components.

export const CONFIDENCE: Record<Confidence, { label: string; bars: number }> = {
  high: { label: 'High confidence', bars: 3 },
  medium: { label: 'Medium confidence', bars: 2 },
  low: { label: 'Low confidence', bars: 1 },
}

export const DATA_LEVELS: Record<DataLevel, { icon: LucideIcon; label: string; detail: string }> = {
  full: { icon: Watch, label: 'Full data', detail: 'watch + check-ins' },
  medium: { icon: Smartphone, label: 'Medium data', detail: 'phone steps + check-ins' },
  basic: { icon: ClipboardList, label: 'Basic data', detail: 'check-ins + logged sessions' },
}
