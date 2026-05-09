const BASE = '/api/v1'

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
