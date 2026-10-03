import type { ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { formatDay } from '@/lib/dates'
import { useSession } from '@/lib/session'

// Shared layout for every screen: header with logo and the (simulated) date, scrolling
// content, and an optional sticky footer that holds the screen's one primary action.
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { session } = useSession()
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-app/90 px-5 pb-3 pt-5 backdrop-blur">
        <Link to="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
          <Logo size="sm" />
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm font-medium text-muted-foreground ring-1 ring-border">
          <CalendarDays aria-hidden className="size-4" />
          {formatDay(session.today)}
        </span>
      </header>
      <main className="flex-1 space-y-5 px-5 pb-8 pt-2">{children}</main>
      {footer && (
        <div className="sticky bottom-0 border-t border-border bg-app/95 px-5 pb-5 pt-4 backdrop-blur">{footer}</div>
      )}
    </div>
  )
}
