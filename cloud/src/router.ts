import type { Ctx, Result } from './ctx'
import {
  authenticate, churchInfo, createLinkCode, createUser, linkDevice, listUsers, login, loginMember,
  recover, rotateChurchCode, setupChurch, updateUser, type Session,
} from './auth'
import { pull, push } from './sync'
import { decide, listProposals, pendingCount, propose, withdraw } from './proposals'
import type { ProposalStatus } from '../../shared/types'

// The desktop app calls from file:// (Origin "null") and auth travels in a header,
// never a cookie, so allowing any origin exposes no session.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } })

const respond = (r: Result<object>) => (r.ok ? json(r) : json(r, r.status))
const err = (status: number, error: string) => json({ ok: false, error }, status)

type Handler = (args: { ctx: Ctx; body: any; session: Session; ip: string; params: string[]; url: URL }) => Promise<Response>
type PublicHandler = (args: { ctx: Ctx; body: any; ip: string }) => Promise<Response>

const PUBLIC: Record<string, PublicHandler> = {
  'POST /api/setup': async ({ ctx, body }) => respond(await setupChurch(ctx, body)),
  'POST /api/login': async ({ ctx, body, ip }) => respond(await login(ctx, ip, body)),
  'POST /api/login-member': async ({ ctx, body, ip }) => respond(await loginMember(ctx, ip, body)),
  'POST /api/link': async ({ ctx, body, ip }) => respond(await linkDevice(ctx, ip, body)),
  'POST /api/recover': async ({ ctx, body, ip }) => respond(await recover(ctx, ip, body)),
}

const PRIVATE: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/me$/, async ({ ctx, session }) => json({
    ok: true, role: session.role, name: session.name, actor: session.actor,
    church: await churchInfo(ctx, session), pending: await pendingCount(ctx, session),
  })],
  ['POST', /^\/api\/sync\/pull$/, async ({ ctx, body, session }) => json({ ok: true, ...(await pull(ctx, session, Number(body?.since) || 0)) })],
  ['POST', /^\/api\/sync\/push$/, async ({ ctx, body, session }) => json({ ok: true, ...(await push(ctx, session, body?.changes)) })],
  ['POST', /^\/api\/link-codes$/, async ({ ctx, session }) => respond(await createLinkCode(ctx, session))],
  ['POST', /^\/api\/church\/rotate-code$/, async ({ ctx, session }) => respond(await rotateChurchCode(ctx, session))],
  ['GET', /^\/api\/users$/, async ({ ctx, session }) => respond(await listUsers(ctx, session))],
  ['POST', /^\/api\/users$/, async ({ ctx, body, session }) => respond(await createUser(ctx, session, body))],
  ['PATCH', /^\/api\/users\/([\w-]+)$/, async ({ ctx, body, session, params }) => respond(await updateUser(ctx, session, params[0], body ?? {}))],
  ['GET', /^\/api\/proposals$/, async ({ ctx, session, url }) =>
    respond(await listProposals(ctx, session, { status: (url.searchParams.get('status') as ProposalStatus) || undefined }))],
  ['POST', /^\/api\/proposals$/, async ({ ctx, body, session }) => respond(await propose(ctx, session, body ?? {}))],
  ['POST', /^\/api\/proposals\/([\w-]+)\/decide$/, async ({ ctx, body, session, params }) => respond(await decide(ctx, session, params[0], body ?? {}))],
  ['POST', /^\/api\/proposals\/([\w-]+)\/withdraw$/, async ({ ctx, session, params }) => respond(await withdraw(ctx, session, params[0]))],
]

/** Every /api request: CORS, JSON parsing, bearer auth, dispatch. Errors never leak internals. */
export async function route(ctx: Ctx, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method.toUpperCase()
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (method === 'GET' && url.pathname === '/api/health') return json({ ok: true })

  let body: unknown = undefined
  if (method === 'POST' || method === 'PATCH') {
    const text = await request.text()
    if (text.length > 1_000_000) return err(413, 'Solicitud demasiado grande.')
    if (text) {
      try { body = JSON.parse(text) } catch { return err(400, 'JSON inválido.') }
    }
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'

  try {
    const pub = PUBLIC[`${method} ${url.pathname}`]
    if (pub) return await pub({ ctx, body: body ?? {}, ip })

    for (const [m, re, handler] of PRIVATE) {
      const match = url.pathname.match(re)
      if (!match || m !== method) continue
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
      const session = await authenticate(ctx, token)
      if (!session) return err(401, 'Tu sesión ya no es válida. Vuelve a entrar.')
      return await handler({ ctx, body, session, ip, params: match.slice(1), url })
    }
    return err(404, 'No existe esa ruta.')
  } catch (e) {
    console.error('api error', method, url.pathname, e)
    return err(500, 'Error interno.')
  }
}
