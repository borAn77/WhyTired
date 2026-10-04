import { LogoMark } from '@/components/Logo'
import { MiniChart } from '@/components/MiniChart'
import { clueById, type Observations } from '@/lib/clues'
import { formatLongIn, formatShortIn } from '@/lib/dates'
import { profileLine } from '@/lib/profile'
import type { DoctorSummary, Lang } from '@/lib/types'

// Section headings (Polish from Berken's doctor-brief texts).
const HEADINGS: Record<Lang, Record<string, string>> = {
  pl: {
    person: 'Osoba',
    period: 'Okres',
    summary: 'Podsumowanie',
    timeline: 'Przebieg',
    charts: 'Wykresy',
    tried: 'Co zostało wypróbowane',
    result: 'Wynik',
    questions: 'Pytania do lekarza',
    bring: 'Co zabrać na wizytę',
    inShort: 'W skrócie',
    noticed: 'Zgłoszone przez osobę (nie zmierzone)',
    profile: 'Profil',
    plan: 'Plan',
    fully: 'dni w pełni',
    partly: 'częściowo',
    not: 'wcale',
    inShortAi: 'W skrócie (tekst napisany przez AI wyłącznie na podstawie liczb z tego podsumowania)',
  },
  en: {
    person: 'Person',
    period: 'Period',
    summary: 'Summary',
    timeline: 'Timeline',
    charts: 'Charts',
    tried: 'What was tried',
    result: 'Result',
    questions: 'Questions for the doctor',
    bring: 'What to bring',
    inShort: 'In short',
    noticed: 'Self-reported (not measured)',
    profile: 'Profile',
    plan: 'Plan',
    fully: 'days fully',
    partly: 'partly',
    not: 'not at all',
    inShortAi: 'In short (written by AI, using only the numbers in this summary)',
  },
}

// The one-page summary for the family doctor. Used on the share page (/s/<token>) and in print.
export function SummaryDocument({
  summary,
  observations = null,
}: {
  summary: DoctorSummary
  observations?: Observations | null
}) {
  const h = HEADINGS[summary.lang]
  return (
    <article id="doctor-summary" lang={summary.lang} className="doc space-y-6 bg-white text-navy-900">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-navy-900 pb-3">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-auto shrink-0" title="WhyTired" />
          <h1 className="text-lg font-semibold leading-snug">{summary.title}</h1>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          <dt className="text-muted-foreground">{h.person}</dt>
          <dd className="font-semibold">{summary.patient}</dd>
          <dt className="text-muted-foreground">{h.period}</dt>
          <dd className="font-semibold">
            {formatShortIn(summary.period_start, summary.lang)} – {formatLongIn(summary.period_end, summary.lang)}
          </dd>
        </dl>
      </header>
      <p className="text-sm text-muted-foreground">{summary.sources}</p>

      <div className="doc-columns grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="doc-heading">{h.summary}</h2>
          <p>{summary.complaint}</p>
          <h2 className="doc-heading pt-2">{h.timeline}</h2>
          <ol className="space-y-2">
            {summary.timeline.map((entry) => (
              <li key={`${entry.date}-${entry.text}`} className="grid grid-cols-[4rem_1fr] gap-2">
                <span className="font-semibold tabular-nums">{formatShortIn(entry.date, summary.lang)}</span>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
          {/* Left column: it is the shorter one, so this never adds a second printed page. */}
          {observations && <Noticed observations={observations} lang={summary.lang} />}
        </section>
        <section className="space-y-2">
          <h2 className="doc-heading">{h.tried}</h2>
          <p>{summary.tried}</p>
          <h2 className="doc-heading pt-2">{h.result}</h2>
          <p className="font-semibold">{summary.result}</p>
          {summary.explanation && (
            // On screen only: the printed page stays rule-based, deterministic and one A4 page.
            <div className="rounded-xl bg-navy-50 p-3 print:hidden">
              <p className="text-sm font-semibold">
                {summary.explanation.source === 'llm' ? h.inShortAi : h.inShort}
              </p>
              <p className="mt-1">{summary.explanation.text}</p>
            </div>
          )}
          <h2 className="doc-heading pt-2">{h.questions}</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            {summary.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="doc-heading">{h.charts}</h2>
        <div className="doc-charts grid gap-4 sm:grid-cols-3">
          {summary.trends.map((trend) => (
            <MiniChart key={trend.title} chart={trend.chart} title={trend.title} caption="" height="h-24" lang={summary.lang} />
          ))}
        </div>
        {summary.trends[0] && <p className="text-sm text-muted-foreground">{summary.trends[0].note}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="doc-heading">{h.bring}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {summary.bring.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-border pt-3 text-sm text-muted-foreground">{summary.disclaimer}</footer>
    </article>
  )
}

// What the person reported in the app (onboarding profile, mission checks, clue cards). Short
// lines so the printed summary stays one A4 page; the heading says it is self-reported, not
// measured.
function Noticed({ observations, lang }: { observations: Observations; lang: Lang }) {
  const h = HEADINGS[lang]
  const { yes, partly, no } = observations.plan
  const answered = yes + partly + no
  const plan =
    answered > 0
      ? `${h.plan}: ${yes}/${answered} ${h.fully}${partly ? `, ${h.partly} ${partly}` : ''}${no ? `, ${h.not} ${no}` : ''}.`
      : ''
  const clues = Object.entries(observations.clues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, count]) => {
      const clue = clueById(id)
      return clue ? `${(lang === 'pl' && clue.pl) || clue.label} ×${count}` : null
    })
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <h2 className="doc-heading pt-2">{h.noticed}</h2>
      {observations.profile && (
        <p>
          {h.profile}: {profileLine(observations.profile, lang)}.
        </p>
      )}
      {(plan || clues) && (
        <p>
          {plan} {clues}
        </p>
      )}
    </>
  )
}
