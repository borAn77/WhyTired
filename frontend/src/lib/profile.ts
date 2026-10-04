import type { DataLevel, Lang } from './types'

// The onboarding profile: what the user tells us once, beyond the daily check-in. It never goes
// to the rule engine (the synthetic data drives the numbers). It sets the data level, Today shows
// one habit tip from it, and the doctor summary repeats it as one self-reported line, so a GP
// sees the training and the week around the tiredness. Answers are stored as English labels; the
// summary translates known labels to Polish and shows the user's own "Other" text as typed.

export interface Option {
  label: string
  emoji: string
  pl: string
}

export const GOALS: (Option & { reply: string })[] = [
  { label: 'Feel less tired', emoji: '😴', pl: 'mniej zmęczenia', reply: 'Then let’s find out why.' },
  { label: 'Train for a race', emoji: '🏁', pl: 'start w zawodach', reply: 'A race! Let’s keep you fresh for it.' },
  { label: 'Get stronger', emoji: '💪', pl: 'więcej siły', reply: 'Strong goal. Recovery counts too.' },
  { label: 'Train consistently', emoji: '📅', pl: 'regularne treningi', reply: 'Consistency beats intensity.' },
  { label: 'Come back after a break', emoji: '🩹', pl: 'powrót po przerwie', reply: 'Welcome back. Step by step.' },
  { label: 'Balance sport and studies', emoji: '🎓', pl: 'sport i studia', reply: 'Sport plus studies: a classic case.' },
]

export const SPORTS: Option[] = [
  { label: 'Running', emoji: '🏃', pl: 'bieganie' },
  { label: 'Gym', emoji: '🏋️', pl: 'siłownia' },
  { label: 'Football', emoji: '⚽', pl: 'piłka nożna' },
  { label: 'Basketball', emoji: '🏀', pl: 'koszykówka' },
  { label: 'Volleyball', emoji: '🏐', pl: 'siatkówka' },
  { label: 'Cycling', emoji: '🚴', pl: 'kolarstwo' },
  { label: 'Swimming', emoji: '🏊', pl: 'pływanie' },
  { label: 'Climbing', emoji: '🧗', pl: 'wspinaczka' },
  { label: 'Martial arts', emoji: '🥊', pl: 'sztuki walki' },
  { label: 'Tennis or padel', emoji: '🎾', pl: 'tenis lub padel' },
  { label: 'Yoga', emoji: '🧘', pl: 'joga' },
  { label: 'Dance', emoji: '💃', pl: 'taniec' },
]

export type PerWeek = '1-2' | '3-4' | '5-6' | '7+'
export type Minutes = '<30' | '30-60' | '60-90' | '90+'
export type Level = 'fun' | 'regular' | 'competitive'
export type Device = 'watch' | 'phone' | 'none'

export const PER_WEEK: { id: PerWeek; label: string; en: string; pl: string }[] = [
  { id: '1-2', label: '1–2', en: '1–2 sessions a week', pl: '1–2 treningi/tydz.' },
  { id: '3-4', label: '3–4', en: '3–4 sessions a week', pl: '3–4 treningi/tydz.' },
  { id: '5-6', label: '5–6', en: '5–6 sessions a week', pl: '5–6 treningów/tydz.' },
  { id: '7+', label: '7+', en: '7+ sessions a week', pl: '7+ treningów/tydz.' },
]

export const MINUTES: { id: Minutes; label: string; en: string; pl: string }[] = [
  { id: '<30', label: '< 30 min', en: 'under 30 min each', pl: 'do 30 min' },
  { id: '30-60', label: '30–60 min', en: '30–60 min each', pl: '30–60 min' },
  { id: '60-90', label: '60–90 min', en: '60–90 min each', pl: '60–90 min' },
  { id: '90+', label: '90+ min', en: 'over 90 min each', pl: 'ponad 90 min' },
]

export const LEVELS: { id: Level; label: string; emoji: string; en: string; pl: string }[] = [
  { id: 'fun', label: 'For fun', emoji: '🌱', en: 'for fun', pl: 'rekreacyjnie' },
  { id: 'regular', label: 'Regularly', emoji: '🔁', en: 'regularly', pl: 'regularnie' },
  { id: 'competitive', label: 'I compete', emoji: '🏆', en: 'competes', pl: 'startuje w zawodach' },
]

export const CONTEXT: Option[] = [
  { label: 'Studies', emoji: '📚', pl: 'studia' },
  { label: 'Exams soon', emoji: '📝', pl: 'zbliżająca się sesja' },
  { label: 'Part-time job', emoji: '💼', pl: 'praca dorywcza' },
  { label: 'Night shifts', emoji: '🌙', pl: 'praca na noce' },
  { label: 'Long commute', emoji: '🚌', pl: 'długie dojazdy' },
  { label: 'Caring for someone', emoji: '🫶', pl: 'opieka nad bliską osobą' },
]

export const DEVICES: { id: Device; label: string; emoji: string; level: DataLevel; reply: string }[] = [
  { id: 'watch', label: 'Smartwatch or fitness tracker', emoji: '⌚', level: 'full', reply: 'Full data: I can read your heart and sleep.' },
  { id: 'phone', label: 'Just my phone', emoji: '📱', level: 'medium', reply: 'Your phone’s step count helps too.' },
  { id: 'none', label: 'Nothing, just me', emoji: '📝', level: 'basic', reply: 'Check-ins alone work, with honest confidence.' },
]

export const BRANDS = ['Garmin', 'Apple Watch', 'Fitbit', 'Polar', 'Samsung', 'Xiaomi or Amazfit', 'Whoop', 'Oura']

// What each data level adds, shown as a meter while choosing the device.
export const DATA_LEVELS: { level: DataLevel; label: string; adds: string }[] = [
  { level: 'basic', label: 'Basic', adds: 'Check-ins and the sessions you log' },
  { level: 'medium', label: 'Medium', adds: '+ step count from your phone' },
  { level: 'full', label: 'Full', adds: '+ resting heart rate, HRV and sleep' },
]

export interface Profile {
  perWeek: PerWeek | null
  minutes: Minutes | null
  level: Level | null
  sleep: number | null // usual hours on a normal night
  context: string[] // labels from CONTEXT, or the user's own text
  device: Device | null
  brand: string | null
}

// The part of the profile a doctor might find useful, short enough for the share link and QR.
export interface SharedProfile {
  s: string[] // sports
  w?: PerWeek
  m?: Minutes
  l?: Level
  h?: number
  c?: string[]
}

export function shareProfile(sports: string[], profile: Profile | null): SharedProfile | null {
  if (sports.length === 0 && !profile) return null
  return {
    s: sports,
    ...(profile?.perWeek ? { w: profile.perWeek } : {}),
    ...(profile?.minutes ? { m: profile.minutes } : {}),
    ...(profile?.level ? { l: profile.level } : {}),
    ...(profile?.sleep ? { h: profile.sleep } : {}),
    ...(profile?.context.length ? { c: profile.context } : {}),
  }
}

export interface HabitTip {
  because: string // the onboarding answer the tip comes from, shown with it
  tip: string
}

// One habit tip for Today from the onboarding answers, so what the user told us shows up in the
// app and not only on the doctor summary. Everyday habits only, never medical advice, and the
// rule engine never sees it (docs/DECISIONS.md, D19). The first match wins, most specific first.
export function habitTip(profile: Profile | null): HabitTip | null {
  if (!profile) return null
  const has = (label: string) => profile.context.includes(label)
  if (has('Night shifts')) return { because: 'Night shifts', tip: 'Plan hard sessions after a full sleep, not straight after a shift.' }
  if (has('Exams soon')) return { because: 'Exams soon', tip: 'Keep the same sleep window every night, even before an exam.' }
  if (profile.sleep !== null && profile.sleep < 7)
    return { because: `About ${profile.sleep} h of sleep`, tip: 'Try going to bed 30 minutes earlier this week.' }
  if (has('Caring for someone')) return { because: 'Caring for someone', tip: 'That is tiring too. On heavy days, an easy session still counts.' }
  if (has('Part-time job')) return { because: 'Part-time job', tip: 'Put your hard sessions on days you don’t work.' }
  if (profile.perWeek === '5-6' || profile.perWeek === '7+') {
    const sessions = PER_WEEK.find((o) => o.id === profile.perWeek)?.en ?? 'Lots of training'
    return { because: sessions, tip: 'Keep at least one full rest day every week.' }
  }
  if (has('Long commute')) return { because: 'Long commute', tip: 'Pack your kit the night before, so training doesn’t start in a rush.' }
  if (has('Studies')) return { because: 'Studies', tip: 'Put training in your calendar like a lecture: same days, same time.' }
  return null
}

const translate = (list: Option[], label: string, lang: Lang) =>
  lang === 'pl' ? (list.find((o) => o.label.toLowerCase() === label.toLowerCase())?.pl ?? label) : label.toLowerCase()

// One line for the doctor summary, e.g. "running, gym · 3–4 sessions a week, 30–60 min each ·
// usually 7 h sleep · studies, exams soon". Empty parts are left out.
export function profileLine(p: SharedProfile, lang: Lang): string {
  const sports = p.s.map((s) => translate(SPORTS, s, lang)).join(', ')
  const rhythm = [
    p.w && PER_WEEK.find((o) => o.id === p.w)?.[lang],
    p.m && MINUTES.find((o) => o.id === p.m)?.[lang],
    p.l && LEVELS.find((o) => o.id === p.l)?.[lang],
  ]
    .filter(Boolean)
    .join(', ')
  const hours = p.h ? (lang === 'pl' ? String(p.h).replace('.', ',') : String(p.h)) : null
  const sleep = hours ? (lang === 'pl' ? `zwykle ok. ${hours} h snu` : `usually ${hours} h sleep`) : ''
  const context = (p.c ?? []).map((c) => translate(CONTEXT, c, lang)).join(', ')
  return [sports, rhythm, sleep, context].filter(Boolean).join(' · ')
}

// The fictional personas' onboarding answers, matching their synthetic data (both train about
// 4 times a week: Kasia ~50 min runs, Tomek ~70 min gym and football; usual sleep ~7 h). Used by
// the demo script and the presenter's persona switch, so every path shows the same person.
export const PERSONAS: Record<string, { goal: string; sports: string[]; profile: Profile }> = {
  kasia: {
    goal: 'Run my first half marathon in spring',
    sports: ['Running'],
    profile: { perWeek: '3-4', minutes: '30-60', level: 'regular', sleep: 7, context: ['Studies'], device: 'watch', brand: 'Garmin' },
  },
  tomek: {
    goal: 'Get stronger and train consistently',
    sports: ['Gym', 'Football'],
    profile: {
      perWeek: '3-4',
      minutes: '60-90',
      level: 'regular',
      sleep: 7,
      context: ['Studies', 'Exams soon'],
      device: 'none',
      brand: null,
    },
  },
}
