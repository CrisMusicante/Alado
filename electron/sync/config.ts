/** ALADO in the cloud (Cloudflare Worker). Override with ALADO_CLOUD_URL for local tests (wrangler dev). */
export const CLOUD_URL = process.env.ALADO_CLOUD_URL || 'https://alado.mj-cristhian.workers.dev'
