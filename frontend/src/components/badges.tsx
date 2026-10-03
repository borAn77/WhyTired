import { cn } from '@/lib/utils'
import { CONFIDENCE, DATA_LEVELS } from '@/lib/labels'
import type { Confidence, DataLevel } from '@/lib/types'

// Confidence is never shown by color alone: bars + a text label.
export function ConfidenceBadge({ level, className }: { level: Confidence; className?: string }) {
  const { label, bars } = CONFIDENCE[level]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-sm font-semibold text-navy-900',
        className,
      )}
    >
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              'w-1.5 rounded-sm',
              bar <= bars ? 'bg-navy-900' : 'bg-navy-100',
              ['h-2', 'h-3', 'h-4'][bar - 1],
            )}
          />
        ))}
      </span>
      {label}
    </span>
  )
}

export function DataLevelBadge({ level, className }: { level: DataLevel; className?: string }) {
  const { icon: Icon, label, detail } = DATA_LEVELS[level]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}>
      <Icon aria-hidden className="size-4 shrink-0 text-navy-500" />
      <span>
        <span className="font-semibold text-navy-900">{label}</span> · {detail}
      </span>
    </span>
  )
}
