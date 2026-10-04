import type { Observations } from './clues'
import type { Ctx, Experiment, Lang } from './types'

// The read-only share link encodes what the summary is computed from (docs/DECISIONS.md, D6):
// no database, and opening the link again gives the same summary. App check-ins are left out
// to keep the link (and its QR code) short; the synthetic data covers those days. What the user
// noticed (mission checks, clues) travels as a few counts, not as raw daily answers, plus up to
// 7 self-measured morning pulses.

interface SharePayload {
  p: string // persona
  t: string // today
  s: Ctx['scenario']
  d: Ctx['data_level']
  e: Experiment | null
  l: Lang
  o?: Observations
}

export function encodeShare(ctx: Ctx, observations: Observations | null = null): string {
  const payload: SharePayload = {
    p: ctx.persona_id,
    t: ctx.today,
    s: ctx.scenario,
    d: ctx.data_level,
    e: ctx.experiment,
    l: ctx.lang,
    ...(observations ? { o: observations } : {}),
  }
  const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShare(token: string): { ctx: Ctx; observations: Observations | null } | null {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload
    const ctx: Ctx = {
      persona_id: payload.p,
      today: payload.t,
      scenario: payload.s,
      data_level: payload.d,
      experiment: payload.e,
      checkins: {},
      lang: payload.l,
    }
    return { ctx, observations: payload.o ?? null }
  } catch {
    return null
  }
}

export const shareUrl = (ctx: Ctx, observations: Observations | null = null) =>
  `${window.location.origin}/s/${encodeShare(ctx, observations)}`
