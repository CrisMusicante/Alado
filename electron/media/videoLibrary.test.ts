import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { listVideos, importVideo } from './videoLibrary'

let dir: string
let outside: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alado-videos-'))
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'alado-src-'))
})

const write = (d: string, name: string, content: string) => {
  fs.writeFileSync(path.join(d, name), content)
  return path.join(d, name)
}

describe('listVideos', () => {
  it('lists only video files, sorted', () => {
    for (const n of ['b.mp4', 'A.MOV', 'notas.txt', 'c.webm']) write(dir, n, 'x')
    expect(listVideos(dir).map(v => v.name)).toEqual(['A.MOV', 'b.mp4', 'c.webm'])
  })

  it('returns [] when the folder does not exist', () => {
    expect(listVideos(path.join(dir, 'nope'))).toEqual([])
  })
})

describe('importVideo', () => {
  it('copies a new video into the folder without blocking', async () => {
    const src = write(outside, 'fondo.mp4', 'AAA')
    const target = path.join(dir, 'sub')
    const pending = importVideo(src, target)
    expect(pending).toBeInstanceOf(Promise)
    const entry = await pending
    expect(entry).toEqual({ name: 'fondo.mp4', path: path.join(target, 'fondo.mp4'), size: 3 })
    expect(fs.readFileSync(entry.path, 'utf8')).toBe('AAA')
  })

  it('reuses an identical file with the same name', async () => {
    write(dir, 'fondo.mp4', 'AAA')
    const entry = await importVideo(write(outside, 'fondo.mp4', 'AAA'), dir)
    expect(entry.path).toBe(path.join(dir, 'fondo.mp4'))
    expect(fs.readdirSync(dir)).toEqual(['fondo.mp4'])
  })

  it('suffixes a different file with the same name', async () => {
    write(dir, 'fondo.mp4', 'AAA')
    write(dir, 'fondo (2).mp4', 'BBB')
    const entry = await importVideo(write(outside, 'fondo.mp4', 'CCC'), dir)
    expect(entry.name).toBe('fondo (3).mp4')
    expect(fs.readFileSync(path.join(dir, 'fondo.mp4'), 'utf8')).toBe('AAA')
  })

  it('reuses an identical earlier suffixed copy', async () => {
    write(dir, 'fondo.mp4', 'AAA')
    write(dir, 'fondo (2).mp4', 'BBB')
    expect((await importVideo(write(outside, 'fondo.mp4', 'BBB'), dir)).name).toBe('fondo (2).mp4')
  })

  it('returns the file itself when it is already in the folder', async () => {
    const inside = write(dir, 'fondo.mp4', 'AAA')
    expect((await importVideo(inside, dir)).path).toBe(inside)
  })
})
