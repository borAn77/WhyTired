import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_SESSION, SessionContext, loadSession, saveSession, type SessionApi, type SessionState } from '@/lib/session'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(loadSession)

  useEffect(() => saveSession(session), [session])

  const api = useMemo<SessionApi>(
    () => ({
      session,
      update: (patch) => setSession((current) => ({ ...current, ...patch })),
      reset: () => setSession(DEFAULT_SESSION),
    }),
    [session],
  )

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
}
