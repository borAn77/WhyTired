// Hand-mirrored from backend/app/models.py — keep the two in sync (change via PR).
// Dates are ISO strings ("2026-10-04").

export type ISODate = string
export type DataLevel = 'basic' | 'medium' | 'full'
export type Scenario = 'improved' | 'not_improved'
export type Confidence = 'high' | 'medium' | 'low'
export type Lang = 'pl' | 'en'
export type CauseId = 'load_spike' | 'sleep_debt' | 'stress_spike' | 'rhr_elevated'
export type Recommendation = 'hard' | 'easy' | 'rest'
export type ExperimentStatus = 'running' | 'improved' | 'not_improved' | 'not_enough_data'

export interface Profile {
  id: string
  name: string
  age: number
  goal: string
  sports: string[]
  has_watch: boolean
}

export interface CheckIn {
  energy: number // 1–5
  sleep_hours: number
  sleep_quality: number // 1–5
  stress: number // 1–5
  soreness: number // 1–5
}

export interface Experiment {
  cause_id: CauseId
  start: ISODate
  days: number
}

export interface PlannedSession {
  sport: string
  duration_min: number
}

/** Sent with every POST: the backend is stateless. */
export interface Ctx {
  persona_id: string
  today: ISODate
  scenario: Scenario
  data_level: DataLevel
  checkins: Record<ISODate, CheckIn>
  experiment: Experiment | null
  lang: Lang
}

export interface CoachRequest extends Ctx {
  planned_session: PlannedSession | null
}

export interface ChartPoint {
  date: ISODate
  value: number | null
  baseline: number | null
}

export interface Chart {
  metric: string
  unit: string
  points: ChartPoint[]
}

export interface Evidence {
  metric: string
  text: string
  value: number
  baseline: number | null
  unit: string
}

export interface HistoryCheck {
  supports: boolean
  text: string
  period_start: ISODate | null
  period_end: ISODate | null
  period_tag: string | null
  energy_delta: number | null
  rhr_delta: number | null
}

export interface Cause {
  id: CauseId
  title: string
  confidence: Confidence
  score: number
  strength: number
  evidence: Evidence[]
  history_check: HistoryCheck | null
  data_level_used: DataLevel
  chart: Chart | null
}

export interface ExcludedPoint {
  date: ISODate
  metric: string
  value: number | null
  reason: string
}

export interface ExperimentPlan {
  cause_id: CauseId
  title: string
  steps: string[]
  track: string[]
  days: number
}

export interface Explanation {
  text: string
  source: 'llm' | 'template'
}

export interface DetectiveResult {
  triggered: boolean
  low_energy_days: number
  data_level: DataLevel
  causes: Cause[]
  excluded: ExcludedPoint[]
  suggested_experiment: ExperimentPlan | null
  explanation: Explanation | null
}

export interface CoachResult {
  recommendation: Recommendation
  reasons: string[]
  injury_warning: string | null
  detective_triggered: boolean
  has_checkin: boolean
}

export interface ExperimentResult {
  status: ExperimentStatus
  day: number
  days_total: number
  checkins_logged: number
  energy_before: number | null
  energy_during: number | null
  rhr_baseline: number | null
  rhr_during: number | null
  summary: string
}

export interface TimelineEntry {
  date: ISODate
  text: string
}

export interface Trend {
  title: string
  note: string
  chart: Chart
}

export interface DoctorSummary {
  lang: Lang
  patient: string
  period_start: ISODate
  period_end: ISODate
  data_level: DataLevel
  complaint: string
  timeline: TimelineEntry[]
  trends: Trend[]
  tried: string
  result: string
  questions: string[]
  disclaimer: string
  explanation: Explanation | null
}

export interface Health {
  status: 'ok'
  personas: string[]
  llm_provider: string
}
