import type { ReactNode } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Shared loading / error / empty states, so every screen handles them the same way.

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
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
