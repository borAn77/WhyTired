// Stage copy for the left story panel. Facts come from DESIGN_RULES.md ("Content rules")
// and describe the fictional personas on demo day (Sun 4 Oct 2026). Stage only:
// nothing here is shown inside the phone.

export type PersonaKey = 'kasia' | 'tomek'

export interface Story {
  step: string
  title: string
  body: string
  note?: string
}

export const PERSONA_LABEL: Record<PersonaKey, string> = {
  kasia: 'Example: Kasia, 23, runner (fictional)',
  tomek: 'Example: Tomek, 21, gym + football, no watch (fictional)',
}

// What the magnifier finds on the Detective screen: usual vs this week.
export const FINDING: Record<
  PersonaKey,
  { metric: string; usual: number; now: number; format: (v: number) => string; delta: string; confidence: string }
> = {
  kasia: {
    metric: 'Training load',
    usual: 1050,
    now: 2700,
    format: (v) => v.toLocaleString('en-US'),
    delta: '2.6× usual',
    confidence: 'high',
  },
  tomek: {
    metric: 'Sleep (h)',
    usual: 7.0,
    now: 5.3,
    format: (v) => v.toFixed(1),
    delta: '−1.7 h',
    confidence: 'medium',
  },
}

const STORIES: Record<string, Record<PersonaKey, Story>> = {
  '/onboarding': {
    kasia: {
      step: 'Start',
      title: 'Meet WhyTired.',
      body: 'A detective for tiredness. It compares your mornings with your own history, not with an average person.',
    },
    tomek: {
      step: 'Start',
      title: 'Meet WhyTired.',
      body: 'A detective for tiredness. No watch needed: Tomek uses the morning check-in only.',
    },
  },
  '/check-in': {
    kasia: {
      step: 'Step 1 · Check-in',
      title: 'A 15-second check-in.',
      body: 'Every morning Kasia says how she feels. Her watch adds sleep, resting heart rate and training load.',
    },
    tomek: {
      step: 'Step 1 · Check-in',
      title: 'A 15-second check-in.',
      body: 'Every morning Tomek says how he slept and how stressed he is. That is all the data he gives.',
    },
  },
  '/': {
    kasia: {
      step: 'Step 2 · Today',
      title: 'Coach says: rest.',
      body: 'Training load is 2,700 against her usual 1,050, and resting heart rate is 61 against 54 bpm.',
    },
    tomek: {
      step: 'Step 2 · Today',
      title: 'Coach says: rest.',
      body: 'Sleep is 5.3 h against his usual 7.0 h, and stress is 4.3 against 2.7 of 5. No heart data.',
    },
  },
  '/detective': {
    kasia: {
      step: 'Step 3 · Detective',
      title: 'The magnifier found it: training load 2.6× usual.',
      body: 'High confidence. Resting HR 61 vs 54 bpm and sleep 6.6 vs 7.3 h are medium.',
      note: 'Excluded: the night of 24 Sept (resting HR 88, the watch recorded only 35% of the night).',
    },
    tomek: {
      step: 'Step 3 · Detective',
      title: 'The magnifier found it: sleep 5.3 h vs usual 7.0 h.',
      body: 'Medium confidence. Without a watch, findings are capped at medium. Stress 4.3 vs 2.7 of 5 is medium too.',
    },
  },
  '/experiment': {
    kasia: {
      step: 'Step 4 · Experiment',
      title: 'One change, seven days.',
      body: 'Cut training load by 40%: stay under 1,620 load points, effort 5/10 or lower, at least 2 rest days.',
      note: 'Why it might work: in her holiday week, energy was +1.1 and resting HR 6 bpm lower.',
    },
    tomek: {
      step: 'Step 4 · Experiment',
      title: 'One change, seven days.',
      body: 'Tomek tries one safe change for a week. Then WhyTired checks whether his mornings got better.',
      note: 'Why it might work: in his holiday week, energy was +1.0.',
    },
  },
  '/summary': {
    kasia: {
      step: 'Step 5 · For the GP',
      title: 'A one-page summary for the doctor.',
      body: 'Facts, trends and what was excluded, ready to show a GP.',
      note: 'This is not a diagnosis.',
    },
    tomek: {
      step: 'Step 5 · For the GP',
      title: 'A one-page summary for the doctor.',
      body: 'Facts and trends from his check-ins, ready to show a GP. No heart data.',
      note: 'This is not a diagnosis.',
    },
  },
}

// Shown on the experiment screen once the 7 days are over.
export const AFTER: Record<'improved' | 'not_improved', Story> = {
  improved: {
    step: 'After 7 days',
    title: 'It helped. The face shows it.',
    body: 'The experiment worked, so WhyTired closes the case. Same check-in tomorrow.',
  },
  not_improved: {
    step: 'After 7 days',
    title: 'No change after a week.',
    body: 'The experiment did not help. Next step: a short summary to take to the GP.',
    note: 'This is not a diagnosis.',
  },
}

export function storyFor(path: string, persona: PersonaKey): Story {
  return (STORIES[path] ?? STORIES['/'])[persona]
}
