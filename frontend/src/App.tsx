import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { PhoneFrame } from '@/components/PhoneFrame'
import { ErrorState, LoadingState } from '@/components/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Health } from '@/lib/types'

// M0 skeleton: proves frontend → /api → backend works locally and on the deployed URL.
// Replaced by the real screens from M2 on.
export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState(false)

  const fetchHealth = useCallback(() => {
    api.health().then(setHealth).catch(() => setError(true))
  }, [])

  useEffect(fetchHealth, [fetchHealth])

  const retry = () => {
    setError(false)
    setHealth(null)
    fetchHealth()
  }

  return (
    <PhoneFrame>
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <Logo />
      </header>
      <main className="space-y-4 p-5">
        <h1 className="text-2xl font-semibold tracking-tight">Find out why you're tired</h1>
        <p className="text-muted-foreground">
          A 15-second morning check-in, a detective that looks for causes in your own data, and one
          safe change to try.
        </p>
        {error && (
          <ErrorState
            title="Can't reach the WhyTired server"
            message="The server may be waking up. This takes up to a minute."
            onRetry={retry}
          />
        )}
        {!error && !health && <LoadingState label="Connecting to the server" />}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 aria-hidden className="size-5 text-green-700" />
                Server connected
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Personas loaded: {health.personas.length ? health.personas.join(', ') : 'none yet'} ·
              LLM: {health.llm_provider}
            </CardContent>
          </Card>
        )}
      </main>
    </PhoneFrame>
  )
}
