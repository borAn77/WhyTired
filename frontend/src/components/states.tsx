import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, Hourglass, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Shared loading / error / empty states, so every screen handles them the same way.

const SLOW_AFTER_MS = 4000

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  // The free hosting puts the API to sleep when nobody uses it; the first request then takes
  // up to a minute. After a few seconds we say so instead of showing a silent skeleton.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {slow && (
        <p className="flex gap-2.5 rounded-xl bg-navy-50 p-4">
          <Hourglass aria-hidden className="mt-0.5 size-5 shrink-0 text-navy-500" />
          <span>Waking up the server. On the free plan this can take up to a minute, only the first time.</span>
        </p>
      )}
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Check your connection and try again.',
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="rounded-2xl border border-coral-500/40 bg-coral-50 p-5 text-center">
      <AlertCircle aria-hidden className="mx-auto mb-2 size-7 text-coral-700" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
      <Inbox aria-hidden className="mx-auto mb-2 size-7 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
