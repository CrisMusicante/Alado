// WebCrypto only: runs the same in Workers and in Node (tests).

const enc = new TextEncoder()
const PBKDF2_ITERATIONS = 100_000 // Workers' maximum
/** No 0/O/1/I/L: codes are read aloud and typed on phones. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export const randomToken = () => b64url(randomBytes(32))
export const randomId = () => crypto.randomUUID()

export function randomCode(length: number, alphabet = CODE_ALPHABET): string {
  // Rejection sampling keeps every symbol equally likely.
  const limit = 256 - (256 % alphabet.length)
  let out = ''
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length]
    }
  }
  return out
}

export async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

async function pbkdf2(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return hex(bits)
}

/** `pbkdf2$<iterations>$<salt hex>$<hash hex>`: the count travels with the hash so it can change later. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${hex(salt.buffer as ArrayBuffer)}$${await pbkdf2(secret, salt, PBKDF2_ITERATIONS)}`
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  const [iterations, saltHex, hash] = parts.length === 4 ? [Number(parts[1]), parts[2], parts[3]] : [100_000, parts[1], parts[2]]
  if (!saltHex || !hash || !Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) return false
  const salt = new Uint8Array(saltHex.match(/../g)!.map(h => parseInt(h, 16)))
  const candidate = await pbkdf2(secret, salt, iterations)
  // Constant-time compare.
  let diff = candidate.length ^ hash.length
  for (let i = 0; i < Math.min(candidate.length, hash.length); i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}
