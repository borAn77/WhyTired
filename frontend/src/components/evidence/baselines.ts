import type { PersonaKey } from '@/components/stage/story'

import type { EyeBaseline } from './logic'

// Example eye-check baselines for the fictional demo personas, always labelled "example
// baseline (demo)". A real user would build their own from a few mornings of checks.
export const EYE_BASELINE: Record<PersonaKey, EyeBaseline> = {
  kasia: { blinkMs: 150, perclos: 4 },
  tomek: { blinkMs: 160, perclos: 5 },
}
