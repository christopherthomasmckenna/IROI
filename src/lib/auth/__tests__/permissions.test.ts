import { describe, it, expect } from 'vitest'
import fields from '../../../../docs/roi-model-fields.json'
import { KNOWN_FIELD_KEYS, canEditField, isFieldPerCaseEditable, assertCreator, assertAdmin, AuthError } from '../permissions'

// ─── Known totals from the JSON (change these if the model changes) ───────────

const EXPECTED_FIELD_COUNT = 81 // 35 CJS + 24 RJC rows + 2 preconf + 3 split + 17 HP/RP/Community

// ─── Derive all stored field keys so we can check completeness ────────────────

type RowSpec = { id: string; [sub: string]: unknown }

function allStoredFieldKeys(): string[] {
  const keys: string[] = []

  for (const row of fields.cjs_program_costs as RowSpec[]) {
    for (const sub of ['units_required', 'cost_per_unit', 'pct_low', 'pct_medium', 'pct_high']) {
      if (row[sub] !== undefined) keys.push(`${row.id}.${sub}`)
    }
  }
  for (const row of fields.rjc_program_costs as RowSpec[]) {
    for (const sub of ['hours_or_units', 'rate_per_unit']) {
      if (row[sub] !== undefined) keys.push(`${row.id}.${sub}`)
    }
  }
  const preconf = fields.rjc_preconferencing_overhead as Record<string, unknown>
  for (const sub of ['hours_or_units', 'rate_per_unit']) {
    if (preconf[sub]) keys.push(`rjc_preconferencing_overhead.${sub}`)
  }
  const split = fields.rjc_outcome_split as Record<string, unknown>
  for (const sub of ['resolution_pct', 'preconferencing_only_pct', 'conferenced_unresolved_pct']) {
    if (split[sub]) keys.push(`rjc_outcome_split.${sub}`)
  }
  const hp = fields.hp_rp_community_inputs as Record<string, unknown>
  for (const fieldName of Object.keys(hp)) {
    if (!fieldName.includes('_DUPLICATE_OF_')) keys.push(fieldName)
  }

  return keys
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KNOWN_FIELD_KEYS (all-fields-editable decision, 2026-07-18)', () => {
  it('contains every stored field key, and nothing else', () => {
    const expected = allStoredFieldKeys()
    expect(KNOWN_FIELD_KEYS.size).toBe(EXPECTED_FIELD_COUNT)
    for (const key of expected) {
      expect(KNOWN_FIELD_KEYS.has(key), key).toBe(true)
    }
  })

  it('excludes the _DUPLICATE_OF_ documentation artifacts', () => {
    for (const key of KNOWN_FIELD_KEYS) {
      expect(key.includes('_DUPLICATE_OF_'), key).toBe(false)
    }
  })
})

describe('canEditField / isFieldPerCaseEditable', () => {
  it('creator and admin can edit every stored field key — including formerly locked ones', () => {
    for (const key of allStoredFieldKeys()) {
      expect(canEditField(key, 'creator'), `creator: ${key}`).toBe(true)
      expect(canEditField(key, 'admin'), `admin: ${key}`).toBe(true)
      expect(isFieldPerCaseEditable(key), key).toBe(true)
    }
  })

  it('specifically: research constants and RJC standard rows are now editable', () => {
    for (const key of [
      'tax_rate',
      'pct_recidivism_reduction',
      'expungement_earnings_avoided',
      'rp_earnings_not_incarcerated',
      'rjc_row11.hours_or_units',
      'rjc_row11.rate_per_unit',
      'rjc_preconferencing_overhead.rate_per_unit',
    ]) {
      expect(canEditField(key, 'creator'), key).toBe(true)
    }
  })

  it('rejects unknown field keys for every role', () => {
    for (const bad of ['nonsense', 'cjs_row13.made_up', 'rjc_outcome_split.extra', '']) {
      expect(canEditField(bad, 'creator'), bad).toBe(false)
      expect(canEditField(bad, 'admin'), bad).toBe(false)
      expect(isFieldPerCaseEditable(bad), bad).toBe(false)
    }
  })
})

describe('assertCreator', () => {
  it('throws 401 when session is null', () => {
    expect(() => assertCreator(null)).toThrow(AuthError)
    try { assertCreator(null) } catch (e) {
      expect((e as AuthError).status).toBe(401)
    }
  })

  it('does not throw for a valid creator session', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'creator' as const }, expires: '' }
    expect(() => assertCreator(session)).not.toThrow()
  })

  it('does not throw for a valid admin session', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'admin' as const }, expires: '' }
    expect(() => assertCreator(session)).not.toThrow()
  })
})

describe('assertAdmin', () => {
  it('throws 401 when session is null', () => {
    expect(() => assertAdmin(null)).toThrow(AuthError)
    try { assertAdmin(null) } catch (e) {
      expect((e as AuthError).status).toBe(401)
    }
  })

  it('throws 403 when user is a creator', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'creator' as const }, expires: '' }
    expect(() => assertAdmin(session)).toThrow(AuthError)
    try { assertAdmin(session) } catch (e) {
      expect((e as AuthError).status).toBe(403)
    }
  })

  it('does not throw for a valid admin session', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'admin' as const }, expires: '' }
    expect(() => assertAdmin(session)).not.toThrow()
  })
})
