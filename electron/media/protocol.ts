import { protocol, net } from 'electron'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { MEDIA_SCHEME, mediaPathFromUrl } from './mediaUrl'

/** Must run before app 'ready'. `stream` lets <video> seek/loop through range requests. */
export function registerMediaSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
  ])
}

/** Serves local background videos to the main window (song preview) without disabling webSecurity. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const path = mediaPathFromUrl(request.url)
    if (!path || !existsSync(path)) return new Response('Not found', { status: 404 })
    const res = await net.fetch(pathToFileURL(path).toString(), { headers: request.headers })
    // CORS so the renderer can read a frame into a <canvas> (PowerPoint export) without tainting it.
    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  })
}
