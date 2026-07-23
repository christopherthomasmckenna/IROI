import { DrizzleAdapter } from '@auth/drizzle-adapter'
import type { NextAuthOptions } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'

import { db } from '@/lib/db'
import { accounts, sessions, users, verificationTokens } from '@/lib/db/schema'
import type { Role } from '@/lib/db/schema'
import { checkAndRecord, type RateRule } from '@/lib/rate-limit'

const HOUR = 60 * 60 * 1000

// Magic-link send limits. Per-email kills victim-bombing; the global cap is a
// generous circuit-breaker against using us as a spam-cannon to many addresses
// (it can throttle legit users under active attack — that's the point, set high);
// per-IP applies only when we can read a forwarded client IP (i.e. behind a proxy
// in prod — it's a no-op in local dev, which has no X-Forwarded-For).
const RATE_LIMITS = {
  perEmailPerHour: 5,
  perIpPerHour:    20,
  globalPerHour:   300,
}

/** Best-effort client IP from the request headers (only available in a request
 *  server context; null otherwise, e.g. local dev with no proxy). */
async function getClientIp(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    const xff = h.get('x-forwarded-for')
    if (xff) return xff.split(',')[0]!.trim()
    return h.get('x-real-ip')
  } catch {
    return null
  }
}

/** Send the magic-link email over SMTP (AUTH_EMAIL_SERVER). */
async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const { createTransport } = await import('nodemailer')
  const transport = createTransport(process.env.AUTH_EMAIL_SERVER)
  const from = process.env.AUTH_EMAIL_FROM ?? 'noreply@iroi.app'
  const host = new URL(url).host

  const result = await transport.sendMail({
    to,
    from,
    subject: `Sign in to ${host}`,
    text: `Sign in to ${host}\n\nUse the link below to sign in. It expires in 24 hours and can only be used once.\n\n${url}\n\nIf you did not request this email, you can safely ignore it.\n`,
    html: `
<div style="font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 16px; color: #18181b;">
  <h2 style="font-size: 18px; margin: 0 0 12px;">Sign in to ${host}</h2>
  <p style="font-size: 14px; color: #52525b; margin: 0 0 20px;">
    Use the button below to sign in. The link expires in 24 hours and can only be used once.
  </p>
  <p style="margin: 0 0 20px;">
    <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;">Sign in</a>
  </p>
  <p style="font-size: 12px; color: #a1a1aa; margin: 0;">
    If you did not request this email, you can safely ignore it.
  </p>
</div>`,
  })

  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean)
  if (failed.length > 0) {
    throw new Error(`Magic-link email could not be sent to: ${failed.join(', ')}`)
  }
}

/** Throws if the magic-link send for this email should be rate-limited. */
async function enforceSendRateLimit(identifier: string): Promise<void> {
  const email = identifier.trim().toLowerCase()
  const rules: RateRule[] = [
    { bucket: `email:${email}`,         limit: RATE_LIMITS.perEmailPerHour, windowMs: HOUR },
    { bucket: 'global:signin-email',    limit: RATE_LIMITS.globalPerHour,   windowMs: HOUR },
  ]

  const ip = await getClientIp()
  if (ip) {
    rules.push({ bucket: `ip:${ip}`, limit: RATE_LIMITS.perIpPerHour, windowMs: HOUR })
  }

  const { ok, exceeded } = await checkAndRecord(rules)
  if (!ok) {
    console.warn(`[rate-limit] sign-in email blocked (bucket=${exceeded}) for ${email} ip=${ip ?? 'n/a'}`)
    throw new Error('Too many sign-in requests. Please wait a while and try again.')
  }
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    EmailProvider({
      from: process.env.AUTH_EMAIL_FROM ?? 'noreply@iroi.app',
      sendVerificationRequest: async ({ identifier, url, expires }) => {
        // Rate-limit BEFORE any send (dev console or prod email). Throwing here
        // aborts the magic-link send entirely.
        await enforceSendRateLimit(identifier)

        if (!process.env.AUTH_EMAIL_SERVER) {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('  MAGIC LINK (dev — email not sent)')
          console.log(`  To: ${identifier}`)
          console.log(`  ${url}`)
          console.log(`  Expires: ${expires.toISOString()}`)
          console.log('  Shortcut: visit /go to follow this link')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
          // Dev convenience: stash the latest link so /go can redirect to it.
          // (Lets you sign in by typing a short URL instead of copy-pasting the
          // long callback URL out of a terminal.) Never runs in production.
          try {
            const { writeFileSync } = await import('fs')
            writeFileSync('/tmp/iroi-magic-link.txt', url)
          } catch {
            // best-effort only — never block sign-in on this
          }
          return
        }
        // Real send: AUTH_EMAIL_SERVER is an SMTP URL (e.g. Brevo:
        // smtp://LOGIN:SMTP_KEY@smtp-relay.brevo.com:587).
        await sendMagicLinkEmail(identifier, url)
      },
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      // user is the full row from our users table (via getSessionAndUser in the adapter).
      // id and role are not in the Auth.js AdapterUser type but ARE in the returned DB row.
      const dbUser = user as unknown as { id: string; role: Role }
      session.user.id   = dbUser.id
      session.user.role = dbUser.role
      return session
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
  },
}
