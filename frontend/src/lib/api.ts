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

// Locally VITE_API_URL is empty and Vite proxies /api to FastAPI. On Render the frontend is a
// static site and calls the API service directly (https://whytired-api.onrender.com).
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, {
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

const KEEP_AWAKE_MS = 10 * 60 * 1000

// The free Render API sleeps when nobody uses it, and the first request after that can take up
// to a minute. Pinging it as soon as the app loads wakes it while the user is still on the first
// screens; pinging every 10 minutes (Render sleeps after 15) keeps it awake while the tab is open,
// also in the background while the presenter shows slides. A failed ping changes nothing.
export function keepApiAwake() {
  const ping = () => api.health().catch(() => undefined)
  ping()
  window.setInterval(ping, KEEP_AWAKE_MS)
}
