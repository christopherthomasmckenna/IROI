import { eq } from 'drizzle-orm'
import { db } from '../db'
import { fieldExplanations } from '../db/schema'
import { FIELD_VARIABLES } from './field-meta'

const VALID_KEYS = new Set(FIELD_VARIABLES.map((v) => v.variableKey))

/** All admin explanation overrides as a variableKey → explanation map. */
export async function getFieldExplanations(): Promise<Map<string, string>> {
  const rows = await db
    .select({
      variableKey: fieldExplanations.variableKey,
      explanation: fieldExplanations.explanation,
    })
    .from(fieldExplanations)
  return new Map(rows.map((r) => [r.variableKey, r.explanation]))
}

/**
 * Set (or clear) the admin override for one variable. An empty explanation
 * deletes the override so the tooltip reverts to the JSON default.
 */
export async function upsertFieldExplanation(
  variableKey: string,
  explanation: string | null,
  adminUserId: string
): Promise<void> {
  if (!VALID_KEYS.has(variableKey)) {
    throw new Error(`Unknown field variable: ${variableKey}`)
  }

  const trimmed = explanation?.trim() ?? ''

  if (trimmed === '') {
    await db.delete(fieldExplanations).where(eq(fieldExplanations.variableKey, variableKey))
    return
  }

  await db
    .insert(fieldExplanations)
    .values({ variableKey, explanation: trimmed, updatedBy: adminUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: fieldExplanations.variableKey,
      set: { explanation: trimmed, updatedBy: adminUserId, updatedAt: new Date() },
    })
}
