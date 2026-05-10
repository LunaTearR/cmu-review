// In dev: VITE_API_BASE_URL is unset → Vite proxy handles /api/v1 → localhost:8080
// In prod (Vercel): set to the full Railway backend URL e.g. https://xxx.railway.app/api/v1
const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  const body = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? 'unknown error')
  }

  return body as T
}

export const get = <T>(path: string) => request<T>(path)

export const post = <T>(path: string, payload: unknown) =>
  request<T>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
