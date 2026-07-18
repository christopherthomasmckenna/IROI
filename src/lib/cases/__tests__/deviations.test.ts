import { describe, expect, it } from 'vitest'
import { buildCaseFieldRows } from '../seed'
import { computeDeviations } from '../deviations'

const CASE_ID = '00000000-0000-0000-0000-000000000001'

function rowsWith(
  edits: Array<{ fieldKey: string; currentValue: string; annotation?: string | null }>
) {
  const byKey = new Map(edits.map((e) => [e.fieldKey, e]))
  return buildCaseFieldRows(CASE_ID).map((r) => {
    const e = byKey.get(r.fieldKey)
    return e ? { ...r, currentValue: e.currentValue, annotation: e.annotation ?? null } : r
  })
}

describe('computeDeviations', () => {
  it('returns nothing for untouched defaults', () => {
    expect(computeDeviations(buildCaseFieldRows(CASE_ID))).toEqual([])
  })

  it('reports a changed HP field with formatted values and its note', () => {
    const devs = computeDeviations(
      rowsWith([{ fieldKey: 'tax_rate', currentValue: '0.25', annotation: 'State rate' }])
    )
    expect(devs).toHaveLength(1)
    expect(devs[0]).toMatchObject({
      fieldKey: 'tax_rate',
      section: 'HP / RP / Community',
      rowLabel: null,
      currentDisplay: '25%',
      annotation: 'State rate',
    })
    expect(devs[0].defaultDisplay).toMatch(/%$/)
    expect(devs[0].defaultDisplay).not.toBe('25%')
  })

  it('a grouped cost-line deviation picks up the shared note from its canonical sibling', () => {
    // updateFieldGroup stores the shared note on units_required and clears it on
    // the others — a deviating sibling must still display the group's note.
    const devs = computeDeviations(
      rowsWith([
        { fieldKey: 'cjs_row17.units_required', currentValue: '999', annotation: 'County FY25 budget' },
        { fieldKey: 'cjs_row17.cost_per_unit', currentValue: '150', annotation: null },
      ])
    )
    expect(devs).toHaveLength(2)
    const costPerUnit = devs.find((d) => d.fieldKey === 'cjs_row17.cost_per_unit')!
    expect(costPerUnit.annotation).toBe('County FY25 budget')
    expect(costPerUnit.rowLabel).toMatch(/post-sentencing incarceration/i)
    expect(costPerUnit.currentDisplay).toBe('$150')
  })

  it('orders deviations in case-page order: CJS, RJC, split, HP', () => {
    const devs = computeDeviations(
      rowsWith([
        { fieldKey: 'tax_rate', currentValue: '0.5' },
        { fieldKey: 'rjc_outcome_split.resolution_pct', currentValue: '0.9' },
        { fieldKey: 'rjc_row11.rate_per_unit', currentValue: '77' },
        { fieldKey: 'cjs_row13.cost_per_unit', currentValue: '42' },
      ])
    )
    expect(devs.map((d) => d.section)).toEqual([
      'CJS Program Costs',
      'RJC Program Costs',
      'Case Outcome Split',
      'HP / RP / Community',
    ])
  })
})
