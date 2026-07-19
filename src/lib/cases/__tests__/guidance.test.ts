import { describe, expect, it } from 'vitest'
import {
  type FieldGuidance,
  FIELD_META,
  resolveGuidance,
  variableKeyOf,
} from '../field-meta'

const authored: FieldGuidance = {
  shortHint: 'Daily jail cost for one person',
  meaning: 'What your county pays per person per day of incarceration.',
  howToLocalize: 'Ask your county corrections budget office.',
  provenance: 'Philadelphia FY19 corrections budget.',
}

describe('resolveGuidance', () => {
  it('falls back to the JSON-derived explanation when nothing is authored', () => {
    const g = resolveGuidance('tax_rate', new Map())
    expect(g.meaning).toBe(FIELD_META.get('tax_rate')?.note)
    expect(g.shortHint).toBeNull()
    expect(g.howToLocalize).toBeNull()
    expect(g.provenance).toBeNull()
  })

  it('returns authored layers keyed by the variable, for any subfield of the row', () => {
    const map = new Map([['cjs_row17', authored]])
    // Both subfields of the row resolve to the same row-level guidance.
    for (const key of ['cjs_row17.cost_per_unit', 'cjs_row17.pct_medium']) {
      const g = resolveGuidance(key, map)
      expect(g.shortHint).toBe(authored.shortHint)
      expect(g.meaning).toBe(authored.meaning)
      expect(g.howToLocalize).toBe(authored.howToLocalize)
      expect(g.provenance).toBe(authored.provenance)
    }
  })

  it('a partially authored row keeps the JSON fallback for meaning only', () => {
    const map = new Map([
      ['tax_rate', { ...authored, meaning: null }],
    ])
    const g = resolveGuidance('tax_rate', map)
    expect(g.meaning).toBe(FIELD_META.get('tax_rate')?.note) // fallback
    expect(g.shortHint).toBe(authored.shortHint)             // authored, no fallback
  })

  it('split fields are their own variables; CJS/RJC subfields collapse to rows', () => {
    expect(variableKeyOf('rjc_outcome_split.resolution_pct')).toBe('rjc_outcome_split.resolution_pct')
    expect(variableKeyOf('cjs_row13.pct_low')).toBe('cjs_row13')
    expect(variableKeyOf('avg_restitution_per_hp')).toBe('avg_restitution_per_hp')
  })
})
