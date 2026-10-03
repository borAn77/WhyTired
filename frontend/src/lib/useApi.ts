import { useEffect, useState } from 'react'

/**
 * Fetch data for a screen. `key` identifies the request (e.g. the JSON of the context):
 * whenever it changes, the data is loaded again. Results for an old key are ignored, so a
 * fast click through time travel never shows stale data.
 */
export function useApi<T>(key: string, load: () => Promise<T>) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${key}#${attempt}`

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => !cancelled && setResult({ key: requestKey, data }),
      (error) => !cancelled && setResult({ key: requestKey, error }),
    )
    return () => {
      cancelled = true
    }
    // `load` is a new closure every render; `requestKey` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const current = result?.key === requestKey ? result : null
  return {
    data: current?.data,
    error: current?.error,
    loading: current === null,
    retry: () => setAttempt((n) => n + 1),
  }
}
