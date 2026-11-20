import type { Api } from './core/sync'

/** Calls the API on this same origin with the session token. Throws when offline. */
export function makeApi(token: string | null): Api {
  return async (method, path, body) => {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    let parsed: unknown = null
    try { parsed = await res.json() } catch { /* not JSON */ }
    return { status: res.status, body: parsed }
  }
}

/** A call that needs the network now (login, approvals, users): readable error when it fails. */
export async function call<T = any>(token: string | null, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown):
  Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const r = await makeApi(token)(method, path, body)
    if (r.status >= 200 && r.status < 300) return { ok: true, data: r.body as T }
    return { ok: false, error: r.body?.error ?? `Error ${r.status}`, status: r.status }
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta cuando tengas señal.', status: 0 }
  }
}
