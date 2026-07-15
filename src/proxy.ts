// Route protection for authenticated areas.
//
// We use DATABASE sessions (see src/auth.ts), so the session cookie is an
// opaque token, NOT a JWT. next-auth's withAuth/getToken can only validate JWT
// cookies — against a database session it fails to decode the cookie and treats
// every request as unauthenticated, redirecting even logged-in users to /login.
//
// So this middleware does a cookie-PRESENCE check only: a fast gate that bounces
// visitors with no session cookie to /login. Real authentication and role
// enforcement happen server-side via getServerSession() in the pages/layouts,
// which can do the DB lookup the edge can't.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// next-auth names the session cookie differently depending on whether secure
// cookies are in use (https). Check both.
const SESSION_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

export default function proxy(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    req.cookies.has(name)
  )

  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
