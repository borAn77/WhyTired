import { FlaskConical } from 'lucide-react'

import type { ExperimentPlan } from '@/lib/types'

export function ExperimentPlanCard({ plan }: { plan: ExperimentPlan }) {
  return (
    <section className="rounded-2xl border-2 border-coral-500 bg-coral-50 p-5" aria-labelledby="next-step">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-700">
        <FlaskConical aria-hidden className="size-4" />
        Your next step
      </p>
      <h2 id="next-step" className="mt-1.5 text-xl font-semibold leading-snug">
        {plan.title}
      </h2>
      <ol className="mt-4 space-y-3">
        {plan.steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full bg-coral-500 text-sm font-bold text-navy-900"
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm font-semibold">Each morning, we'll look at:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {plan.track.map((item) => (
          <li key={item} className="rounded-full bg-card px-3 py-1 text-sm ring-1 ring-border">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
