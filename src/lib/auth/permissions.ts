// Field-level permission enforcement for the ROI calculator.
//
// The source of truth for which fields a Creator can edit is docs/roi-model-fields.json.
// This module derives the editable set from that file at module load time so that
// the permission check is always consistent with the field definitions.

import type { Session } from 'next-auth'
import type { Role } from '@/lib/db/schema'
import fields from '../../../docs/roi-model-fields.json'

// ─── Derive creator-editable field keys from the JSON source of truth ─────────

type FieldSpec = { creator_editable: boolean }
type RowSpec = { id: string; [sub: string]: unknown }

function deriveCreatorEditableFields(): Set<string> {
  const keys = new Set<string>()

  // CJS rows: each has units_required, cost_per_unit, pct_low, pct_medium, pct_high
  for (const row of fields.cjs_program_costs as RowSpec[]) {
    const subfields = ['units_required', 'cost_per_unit', 'pct_low', 'pct_medium', 'pct_high']
    for (const sub of subfields) {
      const spec = row[sub] as FieldSpec | undefined
      if (spec?.creator_editable) keys.add(`${row.id}.${sub}`)
    }
  }

  // RJC rows: each has hours_or_units, rate_per_unit
  for (const row of fields.rjc_program_costs as RowSpec[]) {
    const subfields = ['hours_or_units', 'rate_per_unit']
    for (const sub of subfields) {
      const spec = row[sub] as FieldSpec | undefined
      if (spec?.creator_editable) keys.add(`${row.id}.${sub}`)
    }
  }

  // RJC preconferencing overhead
  const preconf = fields.rjc_preconferencing_overhead as Record<string, unknown>
  for (const sub of ['hours_or_units', 'rate_per_unit']) {
    const spec = preconf[sub] as FieldSpec | undefined
    if (spec?.creator_editable) keys.add(`rjc_preconferencing_overhead.${sub}`)
  }

  // RJC outcome split
  const split = fields.rjc_outcome_split as Record<string, unknown>
  for (const sub of ['resolution_pct', 'preconferencing_only_pct', 'conferenced_unresolved_pct']) {
    const spec = split[sub] as FieldSpec | undefined
    if (spec?.creator_editable) keys.add(`rjc_outcome_split.${sub}`)
  }

  // HP/RP/Community inputs (flat keys, no row prefix)
  // Exclude the _DUPLICATE_OF_ keys — those are JSON documentation artifacts,
  // not real stored fields (the engine references the originals twice).
  const hp = fields.hp_rp_community_inputs as Record<string, unknown>
  for (const [fieldName, spec] of Object.entries(hp)) {
    if (fieldName.includes('_DUPLICATE_OF_')) continue
    if ((spec as FieldSpec)?.creator_editable) keys.add(fieldName)
  }

  return keys
}

export const CREATOR_EDITABLE_FIELDS: ReadonlySet<string> = deriveCreatorEditableFields()

// ─── Permission predicate ─────────────────────────────────────────────────────

/**
 * Returns true if a user with the given role is permitted to edit the field.
 * This is the server-side gate for all field write operations.
 *
 * Note: this gates *user* edits only. The server may still write to locked
 * fields via privileged paths (e.g. admin overrides) without going through
 * this check. The RJC outcome split (all three values) is creator-editable;
 * its 100%-sum constraint is enforced separately at save time, not here.
 */
export function canEditField(fieldKey: string, role: Role): boolean {
  if (role === 'admin') return true
  return CREATOR_EDITABLE_FIELDS.has(fieldKey)
}

/**
 * Whether a field may be edited per-case AT ALL, by anyone (creator or admin).
 * The non-creator-editable fields are fixed model constants (CJS applicability
 * %s, RJC standard costs, research-based HP/RP constants) — they are read-only
 * on every case for every role. (Admins manage such global values elsewhere,
 * not per-case.) This is intentionally stricter than canEditField, which still
 * reports admins as able to edit any field.
 */
export function isFieldPerCaseEditable(fieldKey: string): boolean {
  return CREATOR_EDITABLE_FIELDS.has(fieldKey)
}

// ─── Authorization guards ─────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Throws 401 if not authenticated; throws 403 if authenticated but not creator or admin. */
export function assertCreator(session: Session | null): asserts session is Session & { user: { role: Role } } {
  if (!session?.user) throw new AuthError(401, 'Not authenticated')
}

/** Throws 401 if not authenticated; throws 403 if authenticated but not admin. */
export function assertAdmin(session: Session | null): asserts session is Session & { user: { role: 'admin' } } {
  if (!session?.user) throw new AuthError(401, 'Not authenticated')
  if (session.user.role !== 'admin') throw new AuthError(403, 'Admin access required')
}
