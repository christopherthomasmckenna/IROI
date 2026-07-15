import type { NewRoiCaseField } from '../db/schema'
import { DEFAULT_INPUTS } from '../calculator/defaults'
import fieldsJson from '../../../docs/roi-model-fields.json'

// ─── Note lookups (built at module load) ──────────────────────────────────────

type RowWithNotes = { id: string; notes: string | null }

const _cjsNotes = new Map<string, string | null>(
  (fieldsJson.cjs_program_costs as RowWithNotes[]).map((r) => [r.id, r.notes])
)

const _rjcNotes = new Map<string, string | null>(
  (fieldsJson.rjc_program_costs as RowWithNotes[]).map((r) => [r.id, r.notes])
)

const _hpNotes = fieldsJson.hp_rp_community_inputs as Record<
  string,
  { notes: string | null }
>

// ─── Builder ──────────────────────────────────────────────────────────────────

function field(
  caseId: string,
  sectionKey: NewRoiCaseField['sectionKey'],
  fieldKey: string,
  value: number,
  note: string | null
): NewRoiCaseField {
  const v = String(value)
  return { caseId, sectionKey, fieldKey, defaultValue: v, currentValue: v, note }
}

/**
 * Build the 81 field rows for a new case seeded from DEFAULT_INPUTS.
 * Notes are copied from roi-model-fields.json at creation time; they
 * can be updated by the creator/admin later.
 */
export function buildCaseFieldRows(caseId: string): NewRoiCaseField[] {
  const rows: NewRoiCaseField[] = []

  // ─── CJS Program Costs (7 rows × 5 sub-fields = 35) ────────────────────────
  const cjsRowIds = [
    'cjs_row13', 'cjs_row14', 'cjs_row15',
    'cjs_row16', 'cjs_row17', 'cjs_row18', 'cjs_row19',
  ] as const

  for (const rowId of cjsRowIds) {
    const vals = DEFAULT_INPUTS.cjs[rowId]
    const note = _cjsNotes.get(rowId) ?? null

    rows.push(field(caseId, 'cjs_program_costs', `${rowId}.units_required`, vals.units_required, note))
    rows.push(field(caseId, 'cjs_program_costs', `${rowId}.cost_per_unit`,  vals.cost_per_unit,  note))
    rows.push(field(caseId, 'cjs_program_costs', `${rowId}.pct_low`,        vals.pct_low,        note))
    rows.push(field(caseId, 'cjs_program_costs', `${rowId}.pct_medium`,     vals.pct_medium,     note))
    rows.push(field(caseId, 'cjs_program_costs', `${rowId}.pct_high`,       vals.pct_high,       note))
  }

  // ─── RJC Program Costs (12 rows × 2 sub-fields = 24) ───────────────────────
  const rjcRowIds = [
    'rjc_row11', 'rjc_row12', 'rjc_row13', 'rjc_row14',
    'rjc_row15', 'rjc_row16', 'rjc_row17', 'rjc_row18',
    'rjc_row19', 'rjc_row20', 'rjc_row21', 'rjc_row22',
  ] as const

  for (const rowId of rjcRowIds) {
    const vals = DEFAULT_INPUTS.rjc[rowId]
    const note = _rjcNotes.get(rowId) ?? null

    rows.push(field(caseId, 'rjc_program_costs', `${rowId}.hours_or_units`, vals.hours_or_units, note))
    rows.push(field(caseId, 'rjc_program_costs', `${rowId}.rate_per_unit`,  vals.rate_per_unit,  note))
  }

  // ─── RJC Preconferencing Overhead (2) ───────────────────────────────────────
  const pcoVals = DEFAULT_INPUTS.rjc.rjc_preconferencing_overhead
  const pcoNote = fieldsJson.rjc_preconferencing_overhead.notes

  rows.push(field(caseId, 'rjc_program_costs', 'rjc_preconferencing_overhead.hours_or_units', pcoVals.hours_or_units, pcoNote))
  rows.push(field(caseId, 'rjc_program_costs', 'rjc_preconferencing_overhead.rate_per_unit',  pcoVals.rate_per_unit,  pcoNote))

  // ─── RJC Outcome Split (3) ──────────────────────────────────────────────────
  const splitVals = DEFAULT_INPUTS.rjc.rjc_outcome_split
  const splitNote = fieldsJson.rjc_outcome_split.notes

  rows.push(field(caseId, 'rjc_program_costs', 'rjc_outcome_split.resolution_pct',             splitVals.resolution_pct,             splitNote))
  rows.push(field(caseId, 'rjc_program_costs', 'rjc_outcome_split.preconferencing_only_pct',   splitVals.preconferencing_only_pct,   splitNote))
  rows.push(field(caseId, 'rjc_program_costs', 'rjc_outcome_split.conferenced_unresolved_pct', splitVals.conferenced_unresolved_pct, splitNote))

  // ─── HP / RP / Community Inputs (17, skipping _DUPLICATE_OF_ keys) ─────────
  const hpVals = DEFAULT_INPUTS.hp_rp_community

  const hpKeys = Object.keys(hpVals) as Array<keyof typeof hpVals>
  for (const key of hpKeys) {
    const note = _hpNotes[key]?.notes ?? null
    rows.push(field(caseId, 'hp_rp_community_inputs', key, hpVals[key], note))
  }

  return rows
}
