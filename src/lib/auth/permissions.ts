// Field-level permission enforcement for the ROI calculator.
//
// DECISION (2026-07-18, punch-list item 4): every stored field is editable
// per-case by the case's owner and by admins — including the research-derived
// constants and the RJC standard cost rows that were previously locked. The
// integrity control is no longer "locked fields"; it is the frozen
// default_value baseline (snapshotted at case creation), the changed-from-
// default flag, and the creator's annotation on every deviation.
//
// The `creator_editable` flags in docs/roi-model-fields.json are retained as
// documentation of the source spreadsheet's own locks, but no longer gate
// anything. This module now derives the set of KNOWN field keys from that
// file, so writes are still validated against the model's real shape.

import type { Session } from 'next-auth'
import type { Role } from '@/lib/db/schema'
import fields from '../../../docs/roi-model-fields.json'

// ─── Derive every stored field key from the JSON source of truth ──────────────

type RowSpec = { id: string; [sub: string]: unknown }

function deriveKnownFieldKeys(): Set<string> {
  const keys = new Set<string>()

  // CJS rows: units_required, cost_per_unit, pct_low, pct_medium, pct_high
  for (const row of fields.cjs_program_costs as RowSpec[]) {
    for (const sub of ['units_required', 'cost_per_unit', 'pct_low', 'pct_medium', 'pct_high']) {
      if (row[sub] !== undefined) keys.add(`${row.id}.${sub}`)
    }
  }

  // RJC rows: hours_or_units, rate_per_unit
  for (const row of fields.rjc_program_costs as RowSpec[]) {
    for (const sub of ['hours_or_units', 'rate_per_unit']) {
      if (row[sub] !== undefined) keys.add(`${row.id}.${sub}`)
    }
  }

  // RJC preconferencing overhead
  const preconf = fields.rjc_preconferencing_overhead as Record<string, unknown>
  for (const sub of ['hours_or_units', 'rate_per_unit']) {
    if (preconf[sub] !== undefined) keys.add(`rjc_preconferencing_overhead.${sub}`)
  }

  // RJC outcome split
  const split = fields.rjc_outcome_split as Record<string, unknown>
  for (const sub of ['resolution_pct', 'preconferencing_only_pct', 'conferenced_unresolved_pct']) {
    if (split[sub] !== undefined) keys.add(`rjc_outcome_split.${sub}`)
  }

  // HP/RP/Community inputs (flat keys, no row prefix)
  // Exclude the _DUPLICATE_OF_ keys — those are JSON documentation artifacts,
  // not real stored fields (the engine references the originals twice).
  const hp = fields.hp_rp_community_inputs as Record<string, unknown>
  for (const fieldName of Object.keys(hp)) {
    if (fieldName.includes('_DUPLICATE_OF_')) continue
    keys.add(fieldName)
  }

  return keys
}

/** Every stored field key the model defines (81 as of the Philadelphia model). */
export const KNOWN_FIELD_KEYS: ReadonlySet<string> = deriveKnownFieldKeys()

// ─── Permission predicate ─────────────────────────────────────────────────────

/**
 * Returns true if a user with the given role may edit the field on a case they
 * can edit. All roles may edit all known fields; unknown keys are rejected.
 * (Whether the user may edit the CASE at all is checked separately by
 * canEditCase/assertCanEdit.)
 */
export function canEditField(fieldKey: string, role: Role): boolean {
  void role // kept in the signature for future role-scoped rules
  return KNOWN_FIELD_KEYS.has(fieldKey)
}

/**
 * Whether a field key is a real, per-case-editable model field. Since the
 * all-fields-editable decision this is a validity check (does the key exist in
 * the model), not a lock: every known field is editable; unknown keys never are.
 */
export function isFieldPerCaseEditable(fieldKey: string): boolean {
  return KNOWN_FIELD_KEYS.has(fieldKey)
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

/** Throws 401 if not authenticated. (Every authenticated user is at least a creator.) */
export function assertCreator(session: Session | null): asserts session is Session & { user: { role: Role } } {
  if (!session?.user) throw new AuthError(401, 'Not authenticated')
}

/** Throws 401 if not authenticated; throws 403 if authenticated but not admin. */
export function assertAdmin(session: Session | null): asserts session is Session & { user: { role: 'admin' } } {
  if (!session?.user) throw new AuthError(401, 'Not authenticated')
  if (session.user.role !== 'admin') throw new AuthError(403, 'Admin access required')
}
