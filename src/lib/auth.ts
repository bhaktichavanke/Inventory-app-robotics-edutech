// Lightweight shared-password session, signed with HMAC-SHA256 via the Web
// Crypto API (works in both Next.js Edge middleware and normal API routes —
// unlike Node's `crypto` module, which Edge middleware can't use).
//
// This is intentionally simple: one shared password for the whole team
// (set via APP_PASSWORD), not per-user accounts. That's a reasonable fit for
// a small internal tool; it is NOT designed to withstand a sophisticated
// attacker and should not be used for anything more sensitive than "keep
// this off Google / keep randos who find the URL out."

const COOKIE_NAME = 'inventory_session'
const SESSION_DAYS = 30

function getSecret(): string {
  // Falls back to APP_PASSWORD itself if AUTH_SECRET isn't set, so the app
  // still works with just one env var configured — but setting a separate
  // AUTH_SECRET is recommended (see .env.example).
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'insecure-fallback-secret'
}

// Manual base64url (not Node's Buffer — that's unavailable in the Edge
// runtime that middleware.ts runs under). btoa/atob are Web APIs and work
// in both Edge and Node.
function bytesToBase64Url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bytesToBase64Url(signature)
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = String(expires)
  const signature = await hmac(payload)
  return `${payload}.${signature}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = await hmac(payload)
  if (expected !== signature) return false
  const expires = Number(payload)
  if (!Number.isFinite(expires) || Date.now() > expires) return false
  return true
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60

/** Whether password protection is configured at all. If APP_PASSWORD isn't
 * set, the app runs with no login gate (matches the previous behavior),
 * since requiring a password nobody set would just lock everyone out. */
export function authIsEnabled(): boolean {
  return !!process.env.APP_PASSWORD
}
