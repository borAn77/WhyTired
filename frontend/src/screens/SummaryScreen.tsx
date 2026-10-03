import { useState } from 'react'
import { Check, Copy, ExternalLink, Printer, Share2, Stethoscope } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api } from '@/lib/api'
import { toCtx, useSession } from '@/lib/session'
import { shareUrl } from '@/lib/share'
import type { Lang } from '@/lib/types'
import { useApi } from '@/lib/useApi'

// In-app view of the doctor summary: preview, print and a read-only share link with QR code.
export function SummaryScreen() {
  const { session } = useSession()
  const [lang, setLang] = useState<Lang>('pl')
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const ctx = toCtx(session, { lang })
  const { data, error, loading, retry } = useApi(`summary:${JSON.stringify(ctx)}`, () => api.summary(ctx))
  const url = shareUrl(ctx)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Screen
      footer={
        <PrimaryButton onClick={() => window.open(`${url}?print=1`, '_blank', 'noopener')}>
          <Printer aria-hidden />
          Open and print (PDF)
        </PrimaryButton>
      }
    >
      <section className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-coral-700">
          <Stethoscope aria-hidden className="size-4" />
          For your family doctor
        </p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Your doctor summary is ready</h1>
        <p className="text-muted-foreground">
          One page for your family doctor (POZ): what happened, what you tried, and questions to ask. No diagnoses.
        </p>
      </section>

      <ToggleGroup
        type="single"
        variant="outline"
        value={lang}
        onValueChange={(value) => value && setLang(value as Lang)}
        aria-label="Summary language"
      >
        <ToggleGroupItem value="pl">Polski</ToggleGroupItem>
        <ToggleGroupItem value="en">English</ToggleGroupItem>
      </ToggleGroup>

      {loading && <LoadingState label="Preparing your summary" />}
      {error ? <ErrorState onRetry={retry} /> : null}
      {data && (
        <section className="space-y-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border" lang={data.lang}>
          <p className="text-sm font-semibold text-muted-foreground">{data.title}</p>
          <p className="font-semibold">{data.patient}</p>
          <p>{data.complaint}</p>
          <p className="rounded-xl bg-navy-50 p-3 font-medium">{data.result}</p>
          <p className="text-sm font-semibold">{data.lang === 'pl' ? 'Pytania do lekarza' : 'Questions for the doctor'}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {data.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-1.5 font-medium text-navy-700 underline-offset-4 hover:underline"
          >
            <ExternalLink aria-hidden className="size-4" />
            See the full page with charts
          </a>
        </section>
      )}

      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <h2 className="flex items-center gap-2 font-semibold">
          <Share2 aria-hidden className="size-5 text-navy-500" />
          Share with your doctor, coach or family
        </h2>
        <p className="mt-1 text-muted-foreground">
          A read-only link. Anyone who has it can see the summary, so only share it with people you trust.
        </p>
        {sharing ? (
          <div className="mt-4 space-y-3">
            <div className="grid place-items-center rounded-xl bg-white p-4 ring-1 ring-border">
              <QRCodeSVG value={url} size={176} level="M" fgColor="#1b2a4e" bgColor="#ffffff" title="QR code for the summary link" />
            </div>
            <Button variant="outline" className="h-11 w-full" onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-4 h-11 w-full" onClick={() => setSharing(true)}>
            <Share2 aria-hidden />
            Show link and QR code
          </Button>
        )}
      </section>
    </Screen>
  )
}
