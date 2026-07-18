import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { SummaryPdf } from '../summary-pdf'
import { buildCaseFieldRows } from '@/lib/cases/seed'
import { convertFieldsToInputs } from '@/lib/cases/convert'
import { computeDeviations } from '@/lib/cases/deviations'
import { calculateRoi } from '@/lib/calculator/engine'

const CASE_ID = '00000000-0000-0000-0000-000000000001'

function renderProps(edits: Array<{ fieldKey: string; currentValue: string; annotation?: string }>) {
  const byKey = new Map(edits.map((e) => [e.fieldKey, e]))
  const fields = buildCaseFieldRows(CASE_ID).map((r) => {
    const e = byKey.get(r.fieldKey)
    return e ? { ...r, currentValue: e.currentValue, annotation: e.annotation ?? null } : r
  })
  return {
    title: 'Test Case',
    summary: 'A test summary.',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    publishedAt: new Date('2026-07-02T00:00:00Z'),
    outputs: calculateRoi(convertFieldsToInputs(fields)),
    deviations: computeDeviations(fields),
    shareUrl: 'https://example.com/s/abc',
  }
}

describe('SummaryPdf', () => {
  it('renders a defaults-only case to a valid PDF', async () => {
    const buf = await renderToBuffer(createElement(SummaryPdf, renderProps([])))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(1000)
  })

  it('renders a case with deviations (provenance table branch) to a valid PDF', async () => {
    const buf = await renderToBuffer(
      createElement(
        SummaryPdf,
        renderProps([
          { fieldKey: 'tax_rate', currentValue: '0.25', annotation: 'State rate' },
          { fieldKey: 'cjs_row17.cost_per_unit', currentValue: '150', annotation: 'County FY25 budget' },
          { fieldKey: 'rjc_row11.rate_per_unit', currentValue: '80' },
        ])
      )
    )
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(1000)
  })
})
