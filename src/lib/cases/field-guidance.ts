// Structured per-variable guidance (GOV.UK-style help, 2026-07-18).
//
// Each model variable can carry four layers of admin-authored guidance:
//   shortHint      — one always-visible sentence under the label (plain text)
//   meaning        — what the input means (markdown; falls back to the
//                    JSON-derived explanation when unauthored)
//   howToLocalize  — how to find your jurisdiction's value (markdown)
//   provenance     — where the Philadelphia default comes from (markdown)
//
// This module supersedes field-explanations.ts (single-blob tooltips).

import { eq } from 'drizzle-orm'
import { db } from '../db'
import { fieldExplanations } from '../db/schema'
import { FIELD_VARIABLES, type FieldGuidance, type GuidanceMap } from './field-meta'

export { resolveGuidance, type FieldGuidance, type GuidanceMap } from './field-meta'

const VALID_KEYS = new Set(FIELD_VARIABLES.map((v) => v.variableKey))

/** All authored guidance rows as a variableKey → FieldGuidance map. */
export async function getFieldGuidance(): Promise<GuidanceMap> {
  const rows = await db
    .select({
      variableKey:   fieldExplanations.variableKey,
      shortHint:     fieldExplanations.shortHint,
      meaning:       fieldExplanations.meaning,
      howToLocalize: fieldExplanations.howToLocalize,
      provenance:    fieldExplanations.provenance,
    })
    .from(fieldExplanations)
  return new Map(
    rows.map((r) => [
      r.variableKey,
      {
        shortHint:     r.shortHint,
        meaning:       r.meaning,
        howToLocalize: r.howToLocalize,
        provenance:    r.provenance,
      },
    ])
  )
}

/**
 * Upsert the guidance for one variable. All-empty input deletes the row so
 * every layer reverts to its default (JSON fallback for meaning, hidden for
 * the rest).
 */
export async function upsertFieldGuidance(
  variableKey: string,
  input: FieldGuidance,
  adminUserId: string
): Promise<void> {
  if (!VALID_KEYS.has(variableKey)) {
    throw new Error(`Unknown field variable: ${variableKey}`)
  }

  const clean = (s: string | null): string | null => {
    const t = s?.trim() ?? ''
    return t === '' ? null : t
  }
  const values: FieldGuidance = {
    shortHint:     clean(input.shortHint),
    meaning:       clean(input.meaning),
    howToLocalize: clean(input.howToLocalize),
    provenance:    clean(input.provenance),
  }

  if (!values.shortHint && !values.meaning && !values.howToLocalize && !values.provenance) {
    await db.delete(fieldExplanations).where(eq(fieldExplanations.variableKey, variableKey))
    return
  }

  await db
    .insert(fieldExplanations)
    .values({ variableKey, ...values, updatedBy: adminUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: fieldExplanations.variableKey,
      set: { ...values, updatedBy: adminUserId, updatedAt: new Date() },
    })
}
