import { readFileSync } from 'fs'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Dev-only sign-in shortcut.
 *
 * When email isn't configured (dev), the auth handler writes the latest magic
 * link to a temp file. This route redirects to it, so you can sign in by typing
 * a short URL (/go) instead of copy-pasting the long callback URL out of a
 * terminal. Disabled entirely in production.
 */
export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const url = readFileSync('/tmp/iroi-magic-link.txt', 'utf8').trim()
    return NextResponse.redirect(url)
  } catch {
    return new NextResponse(
      'No pending magic link. Request one at /login first, then visit /go.',
      { status: 404, headers: { 'content-type': 'text/plain' } }
    )
  }
}
