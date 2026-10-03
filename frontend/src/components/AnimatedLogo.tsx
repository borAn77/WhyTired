import '@/components/stage/stage.css'

import { LogoCharacter } from '@/components/stage/LogoCharacter'
import { cn } from '@/lib/utils'

// Drop-in for <Logo size="lg" /> on the welcome screen: same name, same wordmark,
// but the heartbeat draws itself and the eyes blink.
export function AnimatedLogo({ className }: { className?: string }) {
  return (
    <span className={cn('wt-animated-logo inline-flex items-center gap-1', className)} aria-label="WhyTired" role="img">
      <LogoCharacter className="h-16 w-auto shrink-0" />
      <span aria-hidden className="text-4xl tracking-tight text-navy-900">
        <span className="font-bold">Why</span>
        <span className="font-medium">Tired</span>
      </span>
    </span>
  )
}
