import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The one primary action per screen: coral fill with navy text (5.0:1 contrast).
export function PrimaryButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      size="lg"
      className={cn(
        'h-12 w-full rounded-xl bg-coral-500 text-base font-semibold text-navy-900 hover:bg-coral-500/90',
        'disabled:bg-navy-100 disabled:text-muted-foreground disabled:opacity-100',
        className,
      )}
      {...props}
    />
  )
}
