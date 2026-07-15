import { eq } from 'drizzle-orm'
import { db } from '../db'
import { contentBlocks } from '../db/schema'
import { CONTENT_BLOCKS } from './content'

const VALID_KEYS = new Set(CONTENT_BLOCKS.map((b) => b.key))

/** All admin content overrides as a key → body map. */
export async function getContentBlocks(): Promise<Map<string, string>> {
  const rows = await db
    .select({ key: contentBlocks.key, body: contentBlocks.body })
    .from(contentBlocks)
  return new Map(rows.map((r) => [r.key, r.body]))
}

/**
 * Set (or clear) the admin override for one content block. An empty body deletes
 * the override so the block reverts to the spreadsheet/JSON default.
 */
export async function upsertContentBlock(
  key: string,
  body: string,
  adminUserId: string
): Promise<void> {
  if (!VALID_KEYS.has(key)) throw new Error(`Unknown content block: ${key}`)

  const trimmed = body.trim()
  if (trimmed === '') {
    await db.delete(contentBlocks).where(eq(contentBlocks.key, key))
    return
  }

  await db
    .insert(contentBlocks)
    .values({ key, body: trimmed, updatedBy: adminUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: contentBlocks.key,
      set: { body: trimmed, updatedBy: adminUserId, updatedAt: new Date() },
    })
}
