import type { ReactNode } from 'react'

// On phones the app is full screen. On desktop (demo) it sits in a phone-sized frame,
// with the presenter-only demo controls rendered next to it.
export function PhoneFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-navy-50 md:flex md:items-center md:justify-center md:gap-10 md:p-8">
      <div
        className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-app md:min-h-0 md:h-[var(--wt-phone-height)] md:w-[var(--wt-phone-width)] md:rounded-[2.75rem] md:border-[10px] md:border-navy-900 md:shadow-2xl"
      >
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      {aside && <aside className="hidden w-72 md:block">{aside}</aside>}
    </div>
  )
}
