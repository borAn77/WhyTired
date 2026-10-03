import type { PersonaKey } from '@/components/stage/story'

// Copy for "Ask WhyTired". Every fact comes from stage/story.ts or from text the screens
// already show. No diagnoses, medication or tests. Tomek has no watch, so his answers never
// mention heart data.

export interface HelpItem {
  id: string
  question: string
  answer: string
  to?: string // "Take me there": shown only when that screen is reachable right now
}

// Which questions each screen offers, most relevant first.
const BY_SCREEN: Record<string, { guide: string[]; why: string[] }> = {
  '/': { guide: ['checkin', 'detective', 'experiment', 'summary'], why: ['advice', 'diagnosis', 'data'] },
  '/check-in': { guide: ['checkin', 'detective'], why: ['feel', 'data', 'diagnosis'] },
  '/detective': { guide: ['experiment', 'summary'], why: ['confidence', 'excluded', 'diagnosis'] },
  '/experiment': { guide: ['experiment', 'summary', 'checkin'], why: ['after', 'diagnosis'] },
  '/summary': { guide: ['summary'], why: ['contents', 'diagnosis', 'data'] },
}

export function helpFor(path: string, persona: PersonaKey, hasExperiment: boolean) {
  const watch = persona === 'kasia'
  const items: Record<string, Omit<HelpItem, 'id'> | undefined> = {
    checkin: {
      question: 'How do I do my morning check-in?',
      answer:
        "On Today, tap 'Start my check-in'. It's 5 taps and 15 seconds, then you get today's advice. To change an answer later, tap 'Change my check-in answers'.",
      to: '/check-in',
    },
    detective: {
      question: "Where do I see why I'm tired?",
      answer:
        "In detective mode. After 3 low-energy mornings in a row, the detective opens a case and Today shows 'Find out why'. The case lists the suspects and how sure WhyTired is about each one.",
      to: '/detective',
    },
    experiment: hasExperiment
      ? {
          question: 'How do I start the 7-day experiment?',
          answer:
            'Your mission is already running. Keep checking in each morning. After 7 days, WhyTired checks whether your mornings got better.',
          to: '/experiment',
        }
      : {
          question: 'How do I start the 7-day experiment?',
          answer:
            "Open the detective's case and tap 'Accept the mission'. It starts tomorrow and you can stop any time. Your morning check-ins show whether it helps.",
          to: '/detective',
        },
    summary: {
      question: 'How do I share a summary with my doctor?',
      answer:
        "If the experiment doesn't help, WhyTired prepares a one-page summary for your family doctor (POZ). There, tap 'Show link and QR code' to share a read-only link, or 'Open and print (PDF)'.",
      to: '/summary',
    },
    advice: {
      question: 'Why this advice today?',
      answer: watch
        ? "The coach compares this morning with your own usual, not with an average person: your check-in, sleep, resting heart rate and training load. Its reasons are listed under 'Why:' on the advice card."
        : "The coach compares this morning with your own usual, not with an average person. Without a watch, it uses your check-ins and logged sessions. Its reasons are listed under 'Why:' on the advice card.",
    },
    feel: {
      question: 'Why does it ask how I feel?',
      answer: watch
        ? 'How you feel each morning is part of the evidence. Your watch adds sleep, resting heart rate and training load, and WhyTired compares it all with your own usual.'
        : 'How you feel each morning is part of the evidence. Without a watch, your check-in answers are the main data, and WhyTired compares them with your own usual.',
    },
    confidence: {
      question: 'What does high confidence mean?',
      answer: watch
        ? "It shows how sure WhyTired is about a suspect. Each suspect gets 4 checks: 4 = high, 2–3 = medium, 0–1 = low. Tap 'How sure are we?' on a suspect to see them."
        : 'It shows how sure WhyTired is about a suspect. Each suspect gets 4 checks: 4 = high, 2–3 = medium, 0–1 = low. Without a watch, no finding goes above medium confidence.',
    },
    excluded: watch
      ? {
          question: 'Why was a night left out?',
          answer:
            "On the night of 24 Sept the watch recorded only 35% of the night, and resting heart rate read 88. Readings like that aren't reliable, so the detective leaves them out and says why under 'Fake clue'.",
        }
      : undefined,
    after: {
      question: 'What happens after 7 days?',
      answer:
        "WhyTired checks whether your mornings got better. If they did, you keep the change and the case is closed. If not, it prepares a short summary to take to your family doctor.",
    },
    contents: {
      question: "What's in the summary?",
      answer:
        'What happened, what you tried, and questions to ask your doctor, on one page in Polish or English. It contains no diagnoses.',
    },
    diagnosis: {
      question: 'Is this a diagnosis?',
      answer:
        'No. WhyTired gives no diagnoses. It finds patterns in your own data and helps you prepare for a visit to your family doctor.',
    },
    data: {
      question: 'Is my data shared?',
      answer:
        'Your answers are saved in this browser, not in an account. The doctor summary is only shared if you share its link yourself, and anyone with the link can see it, so only share it with people you trust.',
    },
  }

  const pick = (ids: string[]) => ids.flatMap((id) => (items[id] ? [{ id, ...items[id] }] : []))
  const screen = BY_SCREEN[path] ?? BY_SCREEN['/']
  return { guide: pick(screen.guide), why: pick(screen.why) }
}

// The first-run tour on Today. Tour.tsx finds what each step points at.
export const TOUR = [
  { title: 'Start with the check-in', body: '5 taps, 15 seconds, every morning. Start it or change your answers here.' },
  {
    title: "Today's advice",
    body: "Rest, easy or hard, with the reasons. After 3 low-energy mornings in a row, the detective opens a case: tap 'Find out why'.",
  },
  { title: 'Stuck? Ask me.', body: 'Tap me any time for how-tos and plain answers.' },
]
