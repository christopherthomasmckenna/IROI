import { describe, it, expect } from 'vitest'
import fields from '../../../../docs/roi-model-fields.json'
import { CREATOR_EDITABLE_FIELDS, canEditField, assertCreator, assertAdmin, AuthError } from '../permissions'

// ─── Known totals from the JSON (change these if the model changes) ───────────

const EXPECTED_CREATOR_EDITABLE_COUNT = 48  // 14 CJS units/cost + 21 CJS pct + 3 split + 10 HP/RP/Community

// ─── Derive all stored field keys so we can check completeness ────────────────

type FieldSpec = { creator_editable: boolean }
type RowSpec = { id: string; [sub: string]: unknown }

function allStoredFieldKeys(): string[] {
  const keys: string[] = []

  for (const row of fields.cjs_program_costs as RowSpec[]) {
    for (const sub of ['units_required', 'cost_per_unit', 'pct_low', 'pct_medium', 'pct_high']) {
      if ((row[sub] as FieldSpec | undefined) !== undefined) keys.push(`${row.id}.${sub}`)
    }
  }
  for (const row of fields.rjc_program_costs as RowSpec[]) {
    for (const sub of ['hours_or_units', 'rate_per_unit']) {
      if ((row[sub] as FieldSpec | undefined) !== undefined) keys.push(`${row.id}.${sub}`)
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

describe('CREATOR_EDITABLE_FIELDS', () => {
  it('contains exactly the expected number of creator-editable fields', () => {
    expect(CREATOR_EDITABLE_FIELDS.size).toBe(EXPECTED_CREATOR_EDITABLE_COUNT)
  })

  it('includes the 14 CJS units/cost fields', () => {
    const rows = ['cjs_row13', 'cjs_row14', 'cjs_row15', 'cjs_row16', 'cjs_row17', 'cjs_row18', 'cjs_row19']
    for (const row of rows) {
      expect(CREATOR_EDITABLE_FIELDS.has(`${row}.units_required`), `${row}.units_required`).toBe(true)
      expect(CREATOR_EDITABLE_FIELDS.has(`${row}.cost_per_unit`), `${row}.cost_per_unit`).toBe(true)
    }
  })

  it('includes CJS pct_low/pct_medium/pct_high (% applicability) for all CJS rows', () => {
    const rows = ['cjs_row13', 'cjs_row14', 'cjs_row15', 'cjs_row16', 'cjs_row17', 'cjs_row18', 'cjs_row19']
    for (const row of rows) {
      for (const pct of ['pct_low', 'pct_medium', 'pct_high']) {
        expect(CREATOR_EDITABLE_FIELDS.has(`${row}.${pct}`), `${row}.${pct}`).toBe(true)
      }
    }
  })

  it('includes all 3 RJC outcome split fields (100% enforced at save time)', () => {
    expect(CREATOR_EDITABLE_FIELDS.has('rjc_outcome_split.resolution_pct')).toBe(true)
    expect(CREATOR_EDITABLE_FIELDS.has('rjc_outcome_split.preconferencing_only_pct')).toBe(true)
    expect(CREATOR_EDITABLE_FIELDS.has('rjc_outcome_split.conferenced_unresolved_pct')).toBe(true)
  })

  it('includes the 10 creator-editable HP/RP/Community fields', () => {
    const expected = [
      'avg_harmed_parties_per_case',
      'avg_restitution_per_hp',
      'avoided_transportation_expense',
      'avoided_loss_of_income',
      'pct_time_expense_difference',
      'ged_earnings_increase',
      'pct_obtaining_ged',
      'community_service_hours',
      'community_service_dollar_per_hour',
      'pct_completing_community_service',
    ]
    for (const key of expected) {
      expect(CREATOR_EDITABLE_FIELDS.has(key), key).toBe(true)
    }
  })

  it('excludes locked HP/RP/Community fields', () => {
    const locked = [
      'pct_restitution_increase_rjc',
      'expungement_earnings_avoided',
      'pct_expungement_rate_increase',
      'rp_earnings_not_incarcerated',
      'tax_avoided_earnings',
      'tax_rate',
      'pct_recidivism_reduction',
    ]
    for (const key of locked) {
      expect(CREATOR_EDITABLE_FIELDS.has(key), key).toBe(false)
    }
  })

  it('excludes all RJC row costs (all creator_editable: false)', () => {
    expect(CREATOR_EDITABLE_FIELDS.has('rjc_row11.hours_or_units')).toBe(false)
    expect(CREATOR_EDITABLE_FIELDS.has('rjc_row11.rate_per_unit')).toBe(false)
  })
})

describe('canEditField', () => {
  it('admin can edit every stored field key', () => {
    for (const key of allStoredFieldKeys()) {
      expect(canEditField(key, 'admin'), key).toBe(true)
    }
  })

  it('creator can edit creator-editable fields', () => {
    expect(canEditField('cjs_row13.units_required', 'creator')).toBe(true)
    expect(canEditField('avg_harmed_parties_per_case', 'creator')).toBe(true)
  })

  it('creator cannot edit locked fields', () => {
    expect(canEditField('rjc_row11.hours_or_units', 'creator')).toBe(false)
    expect(canEditField('rjc_row11.rate_per_unit', 'creator')).toBe(false)
    expect(canEditField('tax_rate', 'creator')).toBe(false)
  })

  it('creator can edit all three outcome split fields', () => {
    expect(canEditField('rjc_outcome_split.resolution_pct', 'creator')).toBe(true)
    expect(canEditField('rjc_outcome_split.preconferencing_only_pct', 'creator')).toBe(true)
    expect(canEditField('rjc_outcome_split.conferenced_unresolved_pct', 'creator')).toBe(true)
  })

  it('every stored field key resolves to a definite answer for each role', () => {
    for (const key of allStoredFieldKeys()) {
      const creatorResult = canEditField(key, 'creator')
      const adminResult = canEditField(key, 'admin')
      expect(typeof creatorResult, `creator result for ${key}`).toBe('boolean')
      expect(typeof adminResult, `admin result for ${key}`).toBe('boolean')
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
    const session = { user: { email: 'a@b.com', role: 'creator' as const }, expires: '' }
    expect(() => assertCreator(session)).not.toThrow()
  })

  it('does not throw for a valid admin session', () => {
    const session = { user: { email: 'a@b.com', role: 'admin' as const }, expires: '' }
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
    const session = { user: { email: 'a@b.com', role: 'creator' as const }, expires: '' }
    expect(() => assertAdmin(session)).toThrow(AuthError)
    try { assertAdmin(session) } catch (e) {
      expect((e as AuthError).status).toBe(403)
    }
  })

  it('does not throw for a valid admin session', () => {
    const session = { user: { email: 'a@b.com', role: 'admin' as const }, expires: '' }
    expect(() => assertAdmin(session)).not.toThrow()
  })
})
