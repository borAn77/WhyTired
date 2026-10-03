import type {
  CoachRequest,
  CoachResult,
  Ctx,
  DetectiveResult,
  DoctorSummary,
  ExperimentResult,
  Health,
  Profile,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status, `${path} failed with ${response.status}`)
  }
  return (await response.json()) as T
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/health'),
  personas: () => request<Profile[]>('/personas'),
  coach: (body: CoachRequest) => post<CoachResult>('/coach', body),
  detective: (ctx: Ctx) => post<DetectiveResult>('/detective', ctx),
  experiment: (ctx: Ctx) => post<ExperimentResult>('/experiment', ctx),
  summary: (ctx: Ctx) => post<DoctorSummary>('/summary', ctx),
}
