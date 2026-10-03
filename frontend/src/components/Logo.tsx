import { cn } from '@/lib/utils'

// The WhyTired logo, redrawn as SVG from the team's logo image: a magnifying glass with a
// tired face and a coral heartbeat line. Colors come from the design tokens.
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 52"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="22" cy="22" r="16" fill="var(--wt-navy-500)" stroke="var(--wt-navy-900)" strokeWidth="4.5" />
      <path d="M33.8 33.8 L43 43" stroke="var(--wt-navy-900)" strokeWidth="6.5" strokeLinecap="round" />
      {/* sleepy eyes: half-closed lids */}
      <path d="M11.4 20 A4.1 4.1 0 0 0 19.6 20 Z" fill="#fff" />
      <path d="M24.4 20 A4.1 4.1 0 0 0 32.6 20 Z" fill="#fff" />
      <circle cx="15.5" cy="21.6" r="1.7" fill="var(--wt-navy-900)" />
      <circle cx="28.5" cy="21.6" r="1.7" fill="var(--wt-navy-900)" />
      <path d="M10.8 20 H20.2 M23.8 20 H33.2" stroke="var(--wt-navy-900)" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M18.6 29 C20.2 27.9 21.6 29.6 23.2 28.7 S25.4 28.1 26.2 28.8"
        fill="none"
        stroke="var(--wt-navy-900)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* heartbeat */}
      <polyline
        points="29,30.5 37.5,30.5 41,16 45,40.5 48.2,26.5 50.8,32.5 53.4,30.5 63,30.5"
        fill="none"
        stroke="var(--wt-coral-500)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const mark = { sm: 'h-8', md: 'h-10', lg: 'h-16' }[size]
  const word = { sm: 'text-lg', md: 'text-xl', lg: 'text-4xl' }[size]
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label="WhyTired" role="img">
      <LogoMark className={cn(mark, 'w-auto shrink-0')} />
      <span aria-hidden className={cn('tracking-tight text-navy-900', word)}>
        <span className="font-bold">Why</span>
        <span className="font-medium">Tired</span>
      </span>
    </span>
  )
}
