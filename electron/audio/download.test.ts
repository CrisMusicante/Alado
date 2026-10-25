import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { downloadWithResume, sha256File } from './download'

const body = Buffer.alloc(200_000, 7)
const hash = crypto.createHash('sha256').update(body).digest('hex')
let server: http.Server
let url: string
let rangeRequests = 0

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const range = req.headers.range
    if (range) {
      rangeRequests++
      const start = Number(range.replace('bytes=', '').split('-')[0])
      res.writeHead(206, { 'Content-Length': body.length - start, 'Content-Range': `bytes ${start}-${body.length - 1}/${body.length}` })
      return res.end(body.subarray(start))
    }
    res.writeHead(200, { 'Content-Length': body.length })
    res.end(body)
  })
  await new Promise<void>(r => server.listen(0, r))
  url = `http://127.0.0.1:${(server.address() as any).port}/python.tar.gz`
})
afterAll(() => server.close())

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wf-dl-')), 'python.tar.gz')

describe('download', () => {
  it('downloads and verifies sha256', async () => {
    const dest = tmp()
    await downloadWithResume(url, dest, hash, () => {}, new AbortController().signal)
    expect(await sha256File(dest)).toBe(hash)
  })
  it('resumes from a partial file with a Range request', async () => {
    const dest = tmp()
    fs.writeFileSync(dest + '.part', body.subarray(0, 50_000))
    await downloadWithResume(url, dest, hash, () => {}, new AbortController().signal)
    expect(rangeRequests).toBeGreaterThan(0)
    expect(await sha256File(dest)).toBe(hash)
  })
  it('rejects and deletes the file on checksum mismatch', async () => {
    const dest = tmp()
    await expect(downloadWithResume(url, dest, 'deadbeef', () => {}, new AbortController().signal)).rejects.toThrow(/checksum/i)
    expect(fs.existsSync(dest)).toBe(false)
    expect(fs.existsSync(dest + '.part')).toBe(false)
  })
})
