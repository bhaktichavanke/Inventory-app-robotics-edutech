import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const configuredPassword = process.env.APP_PASSWORD
  if (!configuredPassword) {
    // Auth isn't configured on this deployment — nothing to log in to.
    return NextResponse.json({ error: 'Password protection is not configured on this deployment.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : ''

  if (password !== configuredPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const token = await createSessionToken()
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}
