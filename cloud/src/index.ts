import { d1Db } from './db'
import { route } from './router'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return route({ db: d1Db(env.DB), now: () => Date.now() }, request)
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
