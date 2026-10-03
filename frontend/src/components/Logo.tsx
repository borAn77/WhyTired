import { cn } from '@/lib/utils'

// Placeholder wordmark until the real logo is dropped into public/logo.svg.
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const mark = size === 'lg' ? 'size-12 text-2xl' : 'size-8 text-base'
  const word = size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className={cn(
          'grid place-items-center rounded-xl bg-coral-500 font-bold text-navy-900',
          mark,
        )}
      >
        ?
      </span>
      <span className={cn('font-semibold tracking-tight text-navy-900', word)}>
        Why<span className="text-coral-700">Tired</span>
      </span>
    </span>
  )
}
