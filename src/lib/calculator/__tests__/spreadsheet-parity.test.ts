import { describe, it, expect, beforeAll } from 'vitest'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { calculateRoi } from '../engine'
import { DEFAULT_INPUTS } from '../defaults'

/**
 * Spreadsheet parity: the engine must reproduce the numbers in the source
 * spreadsheet (docs/IROI_IMPACT_MODEL.xlsx) for the default inputs — which is
 * the state the spreadsheet ships in. This reads the spreadsheet's OWN cached
 * output cells (the "Impact ROI" sheet) and diffs them against calculateRoi().
 *
 * This is THE guardrail to run whenever the math changes: if the code and the
 * spreadsheet disagree, this fails. Cell map (Impact ROI sheet):
 *   B13/B14/B15 — CJS cost per case  low/medium/high
 *   B17         — RJC average cost per case
 *   B20/B21/B22 — program savings $  (CJS − RJC) low/medium/high
 *   B24/B25/B26 — total RJC benefits $ (HP + RP + Community) low/medium/high
 *   B35/B36/B37 — IROI low/medium/high
 *   B40..B43    — IROI by category (medium): program savings, HP, RP, Community
 */
const XLSX_PATH = path.join(process.cwd(), 'docs/IROI_IMPACT_MODEL.xlsx')

let cell: (addr: string) => number

beforeAll(async () => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX_PATH)
  const ws = wb.getWorksheet('Impact ROI')
  if (!ws) throw new Error('Impact ROI sheet not found in spreadsheet')
  cell = (addr: string): number => {
    const v = ws.getCell(addr).value as unknown
    if (v && typeof v === 'object' && 'result' in v) return Number((v as { result: number }).result)
    return Number(v)
  }
})

describe('spreadsheet parity — engine vs IROI_IMPACT_MODEL.xlsx (default inputs)', () => {
  const out = calculateRoi(DEFAULT_INPUTS)

  it('CJS cost per case (low/medium/high)', () => {
    expect(out.cjs_cost_per_case.low).toBeCloseTo(cell('B13'), 4)
    expect(out.cjs_cost_per_case.medium).toBeCloseTo(cell('B14'), 4)
    expect(out.cjs_cost_per_case.high).toBeCloseTo(cell('B15'), 4)
  })

  it('RJC average cost per case', () => {
    expect(out.rjc_avg_cost_per_case).toBeCloseTo(cell('B17'), 4)
  })

  it('program savings $ = CJS − RJC (low/medium/high)', () => {
    const rjc = out.rjc_avg_cost_per_case
    expect(out.cjs_cost_per_case.low - rjc).toBeCloseTo(cell('B20'), 2)
    expect(out.cjs_cost_per_case.medium - rjc).toBeCloseTo(cell('B21'), 2)
    expect(out.cjs_cost_per_case.high - rjc).toBeCloseTo(cell('B22'), 2)
  })

  it('total RJC benefits $ = HP + RP + Community (low/medium/high)', () => {
    const total = (s: 'low' | 'medium' | 'high') =>
      out.hp_benefit + out.rp_benefit[s] + out.community_benefit[s]
    expect(total('low')).toBeCloseTo(cell('B24'), 2)
    expect(total('medium')).toBeCloseTo(cell('B25'), 2)
    expect(total('high')).toBeCloseTo(cell('B26'), 2)
  })

  it('IROI (low/medium/high)', () => {
    expect(out.iroi.low).toBeCloseTo(cell('B35'), 8)
    expect(out.iroi.medium).toBeCloseTo(cell('B36'), 8)
    expect(out.iroi.high).toBeCloseTo(cell('B37'), 8)
  })

  it('IROI by category at medium sensitivity', () => {
    expect(out.iroi_by_category_medium.program_savings).toBeCloseTo(cell('B40'), 8)
    expect(out.iroi_by_category_medium.harmed_party_benefits).toBeCloseTo(cell('B41'), 8)
    expect(out.iroi_by_category_medium.responsible_party_benefits).toBeCloseTo(cell('B42'), 8)
    expect(out.iroi_by_category_medium.community_benefits).toBeCloseTo(cell('B43'), 8)
  })
})
