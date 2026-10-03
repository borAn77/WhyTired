import type { ISODate, Lang } from './types'

// The synthetic personas' "today" when the demo starts (see backend/scripts/generate_personas.py).
export const DEMO_DAY: ISODate = '2026-10-04'
export const FIRST_ALLOWED_DAY = -55 // the engine needs 35 days of history (history starts at -89)
export const LAST_ALLOWED_DAY = 14 // future days exist up to +14

const toDate = (iso: ISODate) => new Date(`${iso}T12:00:00Z`)

export function addDays(iso: ISODate, days: number): ISODate {
  const date = toDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000)
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "Sun 4 Oct" */
export const formatDay = (iso: ISODate) => dayFormat.format(toDate(iso))
/** "4 Oct" */
export const formatShort = (iso: ISODate) => shortFormat.format(toDate(iso))

const formats: Record<Lang, Intl.DateTimeFormat> = {
  en: shortFormat,
  pl: new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
}
const longFormats: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  pl: new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
}

/** "4 Oct" / "4 paź" */
export const formatShortIn = (iso: ISODate, lang: Lang) => formats[lang].format(toDate(iso))
/** "4 October 2026" / "4 października 2026" */
export const formatLongIn = (iso: ISODate, lang: Lang) => longFormats[lang].format(toDate(iso))
