import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from './db'
import { rateLimitEvents } from './db/schema'

export interface RateRule {
  /** Bucket key, e.g. "email:foo@bar.com", "ip:1.2.3.4", "global:signin-email" */
  bucket: string
  /** Max allowed events within the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateResult {
  ok: boolean
  /** The first bucket found over its limit, if any. */
  exceeded: string | null
}

/**
 * Sliding-window rate check across multiple rules. Counts existing events per
 * bucket within each rule's window; if any bucket is at/over its limit the
 * result is not ok. Records the attempt against every bucket regardless (so an
 * over-limit attempt extends the lockout), then prunes rows older than the
 * longest window. The count-then-insert is mildly racy under burst (can
 * over-allow by a little) — acceptable for this endpoint.
 */
export async function checkAndRecord(rules: RateRule[]): Promise<RateResult> {
  if (rules.length === 0) return { ok: true, exceeded: null }

  let exceeded: string | null = null
  for (const rule of rules) {
    const since = new Date(Date.now() - rule.windowMs)
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(rateLimitEvents)
      .where(and(eq(rateLimitEvents.bucket, rule.bucket), gte(rateLimitEvents.createdAt, since)))
    if ((row?.c ?? 0) >= rule.limit) {
      exceeded = rule.bucket
      break
    }
  }

  await db.insert(rateLimitEvents).values(rules.map((r) => ({ bucket: r.bucket })))

  const maxWindow = Math.max(...rules.map((r) => r.windowMs))
  await db
    .delete(rateLimitEvents)
    .where(lt(rateLimitEvents.createdAt, new Date(Date.now() - maxWindow)))

  return { ok: exceeded === null, exceeded }
}
