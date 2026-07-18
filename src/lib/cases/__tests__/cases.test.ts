import { describe, expect, it } from 'vitest'
import { buildCaseFieldRows } from '../seed'
import { convertFieldsToInputs } from '../convert'
import { canEditCase, canViewCase } from '../access'
import { buildSnapshot, snapshotToFieldRows, draftDiffersFromSnapshot } from '../snapshot'
import { calculateRoi } from '../../calculator/engine'
import type { RoiCase } from '../../db/schema'

const FAKE_CASE_ID = '00000000-0000-0000-0000-000000000001'

// ─── Seed structural tests ────────────────────────────────────────────────────

describe('buildCaseFieldRows', () => {
  const rows = buildCaseFieldRows(FAKE_CASE_ID)

  it('produces exactly 81 rows', () => {
    expect(rows).toHaveLength(81)
  })

  it('all fieldKeys are unique', () => {
    const keys = rows.map((r) => r.fieldKey)
    expect(new Set(keys).size).toBe(81)
  })

  it('all caseIds match the provided caseId', () => {
    expect(rows.every((r) => r.caseId === FAKE_CASE_ID)).toBe(true)
  })

  it('all values are finite numbers when parsed', () => {
    expect(rows.every((r) => isFinite(Number(r.currentValue)))).toBe(true)
  })

  it('defaultValue equals currentValue on seed', () => {
    expect(rows.every((r) => r.defaultValue === r.currentValue)).toBe(true)
  })

  it('section keys are in expected enum values', () => {
    const valid = new Set(['cjs_program_costs', 'rjc_program_costs', 'hp_rp_community_inputs'])
    expect(rows.every((r) => valid.has(r.sectionKey))).toBe(true)
  })
})

// ─── Round-trip engine test ───────────────────────────────────────────────────

describe('seed → convert → calculateRoi round-trip', () => {
  it('reproduces reference IROI values from defaults', () => {
    const rows = buildCaseFieldRows(FAKE_CASE_ID)
    const inputs = convertFieldsToInputs(rows)
    const outputs = calculateRoi(inputs)

    expect(outputs.iroi.low).toBeCloseTo(6.141271825755723, 6)
    expect(outputs.iroi.medium).toBeCloseTo(11.031652710241923, 6)
    expect(outputs.iroi.high).toBeCloseTo(15.336432120702682, 6)
  })
})

// ─── convertFieldsToInputs ────────────────────────────────────────────────────

describe('convertFieldsToInputs', () => {
  it('throws on a missing field key', () => {
    const rows = buildCaseFieldRows(FAKE_CASE_ID).filter(
      (r) => r.fieldKey !== 'avg_harmed_parties_per_case'
    )
    expect(() => convertFieldsToInputs(rows)).toThrow('Missing case field')
  })
})

// ─── Access control ───────────────────────────────────────────────────────────

const OWNER_ID  = 'user-owner-id'
const OTHER_ID  = 'user-other-id'

function makeCase(overrides: Partial<RoiCase> = {}): RoiCase {
  return {
    id:            'case-id',
    ownerId:       OWNER_ID,
    title:         'Test Case',
    summary:       null,
    isPrivate:     false,
    shareSlug:     'abc123',
    liveVersionId: null,
    createdAt:     new Date(),
    updatedAt:     new Date(),
    ...overrides,
  }
}

const LIVE = 'version-id-1'

describe('canViewCase', () => {
  it('admin can always view', () => {
    expect(canViewCase(makeCase({ isPrivate: true, liveVersionId: null }), OTHER_ID, 'admin')).toBe(true)
  })

  it('owner can always view their own case', () => {
    expect(canViewCase(makeCase({ isPrivate: true, liveVersionId: null }), OWNER_ID, 'creator')).toBe(true)
  })

  it('non-owner can view public case with a live version', () => {
    expect(canViewCase(makeCase({ isPrivate: false, liveVersionId: LIVE }), OTHER_ID, 'creator')).toBe(true)
  })

  it('non-owner cannot view public case with no live version', () => {
    expect(canViewCase(makeCase({ isPrivate: false, liveVersionId: null }), OTHER_ID, 'creator')).toBe(false)
  })

  it('non-owner cannot view private case even with a live version', () => {
    expect(canViewCase(makeCase({ isPrivate: true, liveVersionId: LIVE }), OTHER_ID, 'creator')).toBe(false)
  })

  it('anonymous cannot view public case with no live version', () => {
    expect(canViewCase(makeCase({ isPrivate: false, liveVersionId: null }), null, null)).toBe(false)
  })

  it('anonymous cannot view private case', () => {
    expect(canViewCase(makeCase({ isPrivate: true, liveVersionId: LIVE }), null, null)).toBe(false)
  })
})

describe('snapshot round-trip (publish → view)', () => {
  it('a snapshot of default fields reproduces the reference IROI', () => {
    // A published snapshot stores the same field-row shape as the draft, so the
    // viewer/version-view path (snapshot → fields → convert → calculate) must
    // reproduce the engine's reference values.
    const rows = buildCaseFieldRows(FAKE_CASE_ID)
    const snapshot = buildSnapshot('Snap', rows)
    const restored = snapshotToFieldRows(snapshot, FAKE_CASE_ID)

    expect(restored).toHaveLength(81)
    const outputs = calculateRoi(convertFieldsToInputs(restored))
    expect(outputs.iroi.low).toBeCloseTo(6.141271825755723, 6)
    expect(outputs.iroi.medium).toBeCloseTo(11.031652710241923, 6)
    expect(outputs.iroi.high).toBeCloseTo(15.336432120702682, 6)
  })

  it('frozen defaults survive edit → publish → restore (the comparison baseline)', () => {
    // Punch-list item 5: default_value is the permanent yardstick every case is
    // compared against. Editing values, snapshotting (publish), and restoring
    // must never disturb it.
    const rows = buildCaseFieldRows(FAKE_CASE_ID)
    const originalDefaults = new Map(rows.map((r) => [r.fieldKey, r.defaultValue]))

    const edited = rows.map((r) =>
      r.fieldKey === 'tax_rate' || r.fieldKey === 'rjc_row11.rate_per_unit'
        ? { ...r, currentValue: '123.45', annotation: 'local override' }
        : r
    )

    const snapshot = buildSnapshot('Edited', edited)
    const restored = snapshotToFieldRows(snapshot, FAKE_CASE_ID)

    for (const r of restored) {
      expect(r.defaultValue, r.fieldKey).toBe(originalDefaults.get(r.fieldKey))
    }
    // The edits themselves round-trip too — current diverges, default doesn't.
    const restoredTax = restored.find((r) => r.fieldKey === 'tax_rate')!
    expect(restoredTax.currentValue).toBe('123.45')
    expect(restoredTax.annotation).toBe('local override')
    expect(Number(restoredTax.defaultValue)).not.toBe(123.45)
  })

  it('detects a draft that diverges from its snapshot', () => {
    const rows = buildCaseFieldRows(FAKE_CASE_ID)
    const snapshot = buildSnapshot('Snap', rows)
    expect(draftDiffersFromSnapshot(rows, snapshot)).toBe(false)

    const edited = rows.map((r) =>
      r.fieldKey === 'avg_harmed_parties_per_case'
        ? { ...r, currentValue: '99' }
        : r
    )
    expect(draftDiffersFromSnapshot(edited, snapshot)).toBe(true)
  })
})

describe('canEditCase', () => {
  it('owner can edit', () => {
    expect(canEditCase(makeCase(), OWNER_ID, 'creator')).toBe(true)
  })

  it('admin can edit any case', () => {
    expect(canEditCase(makeCase(), OTHER_ID, 'admin')).toBe(true)
  })

  it('non-owner creator cannot edit', () => {
    expect(canEditCase(makeCase(), OTHER_ID, 'creator')).toBe(false)
  })

  it('unauthenticated cannot edit', () => {
    expect(canEditCase(makeCase(), null, null)).toBe(false)
  })
})
