import { and, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { roiCases, roleEnum, users, type Role } from './db/schema'

export interface AdminUserRow {
  id: string
  email: string
  role: Role
  createdAt: Date
  caseCount: number
}

/** All users with their owned-case count, for the admin user-management screen. */
export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id:        users.id,
      email:     users.email,
      role:      users.role,
      createdAt: users.createdAt,
      caseCount: sql<number>`count(${roiCases.id})`,
    })
    .from(users)
    .leftJoin(roiCases, eq(roiCases.ownerId, users.id))
    .groupBy(users.id)
    .orderBy(users.createdAt)

  return rows.map((r) => ({ ...r, caseCount: Number(r.caseCount) }))
}

/**
 * Set a user's role.
 *
 * Promotion is always safe. Demotion to 'creator' is gated by a last-admin check
 * done atomically in the WHERE clause: it only applies if some OTHER admin still
 * exists. If no row is updated, the target was the last admin — rejected. This
 * holds even if two admins demote each other concurrently.
 */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  if (!roleEnum.enumValues.includes(role)) {
    throw new Error(`Invalid role: ${role}`)
  }

  if (role === 'admin') {
    await db.update(users).set({ role }).where(eq(users.id, userId))
    return
  }

  const updated = await db
    .update(users)
    .set({ role })
    .where(
      and(
        eq(users.id, userId),
        sql`EXISTS (SELECT 1 FROM users u2 WHERE u2.role = 'admin' AND u2.id <> ${userId})`
      )
    )
    .returning({ id: users.id })

  if (updated.length === 0) {
    throw new Error('Cannot remove the last admin')
  }
}
