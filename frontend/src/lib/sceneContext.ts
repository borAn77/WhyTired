import { createContext, useContext } from 'react'

export interface ScenesApi {
  index: number | null // null = script not running
  startedAt: number | null // for the presenter's timer
  start: () => void
  go: (index: number) => void
  stop: () => void
}

export const SceneContext = createContext<ScenesApi | null>(null)

export function useScenes(): ScenesApi {
  const api = useContext(SceneContext)
  if (!api) throw new Error('useScenes must be used inside <SceneProvider>')
  return api
}
