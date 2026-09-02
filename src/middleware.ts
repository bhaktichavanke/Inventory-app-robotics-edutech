import { NextRequest, NextResponse } from 'next/server'
import { authIsEnabled, SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  // No APP_PASSWORD configured → auth is off, behave exactly as before.
  if (!authIsEnabled()) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Always allow the login page and its API, and static assets, through.
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const valid = await verifySessionToken(token)

  if (valid) return NextResponse.next()

  // API requests get a plain 401 (a redirect would return an HTML login
  // page body to a fetch() call expecting JSON, which just breaks silently).
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on everything except static files Next.js serves directly.
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
