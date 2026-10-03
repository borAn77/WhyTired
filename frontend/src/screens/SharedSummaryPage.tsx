import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { ErrorState, LoadingState } from '@/components/states'
import { SummaryDocument } from '@/components/SummaryDocument'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api } from '@/lib/api'
import { decodeShare } from '@/lib/share'
import type { Ctx, Lang } from '@/lib/types'
import { useApi } from '@/lib/useApi'

// What the doctor, coach or family member sees: the summary as a page, read-only.
// The link carries everything needed to recompute it (docs/DECISIONS.md, D6).
export function SharedSummaryPage() {
  const { token } = useParams()
  const ctx = token ? decodeShare(token) : null
  if (!ctx) {
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState title="This link doesn't work" message="The summary link seems to be incomplete. Ask for a new one." />
      </div>
    )
  }
  return <SharedSummary initial={ctx} />
}

function SharedSummary({ initial }: { initial: Ctx }) {
  const [searchParams] = useSearchParams()
  const [lang, setLang] = useState<Lang>(initial.lang)
  const ctx = { ...initial, lang }
  const { data, error, loading, retry } = useApi(`summary:${JSON.stringify(ctx)}`, () => api.summary(ctx))
  const autoPrint = searchParams.get('print') === '1'

  useEffect(() => {
    if (!data || !autoPrint) return
    const timer = window.setTimeout(() => window.print(), 600) // let the charts lay out first
    return () => window.clearTimeout(timer)
  }, [data, autoPrint])

  return (
    <div className="min-h-dvh bg-navy-50 px-4 py-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[760px] flex-wrap items-center justify-between gap-3">
        <Logo size="sm" />
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={lang}
            onValueChange={(value) => value && setLang(value as Lang)}
            aria-label="Language"
          >
            <ToggleGroupItem value="pl">Polski</ToggleGroupItem>
            <ToggleGroupItem value="en">English</ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => window.print()} disabled={!data}>
            <Printer aria-hidden />
            {lang === 'pl' ? 'Drukuj / zapisz PDF' : 'Print / save as PDF'}
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-[760px] rounded-2xl bg-white p-8 shadow-lg ring-1 ring-border print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        {loading && <LoadingState label="Loading the summary" />}
        {error ? <ErrorState onRetry={retry} /> : null}
        {data && <SummaryDocument summary={data} />}
      </div>
      <p className="no-print mx-auto mt-3 max-w-[760px] text-center text-sm text-muted-foreground">
        {lang === 'pl' ? 'Podgląd tylko do odczytu, udostępniony z aplikacji WhyTired.' : 'Read-only view shared from the WhyTired app.'}
      </p>
    </div>
  )
}
