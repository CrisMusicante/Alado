import { d1Db } from './db'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    void d1Db(env.DB)
    return Response.json({ ok: true })
  },
} satisfies ExportedHandler<Env>
