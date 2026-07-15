// Unit classification for every input field. Drives the grayed unit adornments
// in the input fields ($ prefix, % suffix, etc.) and the display↔storage
// conversion for percentages (stored as fractions 0–1, shown/entered as 0–100).
//
// Pure data + functions — safe to import in both server and client components.

export type Unit = 'dollar' | 'percent' | 'count' | 'hours'

// CJS / RJC subfields, keyed by the leaf name after the dot.
const SUBFIELD_UNIT: Record<string, Unit> = {
  units_required: 'count',
  cost_per_unit:  'dollar',
  pct_low:        'percent',
  pct_medium:     'percent',
  pct_high:       'percent',
  hours_or_units: 'count',   // RJC
  rate_per_unit:  'dollar',  // RJC
}

// HP / RP / Community fields, keyed by full field key.
const HP_UNIT: Record<string, Unit> = {
  avg_harmed_parties_per_case:       'count',
  avg_restitution_per_hp:            'dollar',
  pct_restitution_increase_rjc:      'percent',
  avoided_transportation_expense:    'dollar',
  avoided_loss_of_income:            'dollar',
  pct_time_expense_difference:       'percent',
  ged_earnings_increase:             'dollar',
  pct_obtaining_ged:                 'percent',
  expungement_earnings_avoided:      'dollar',
  pct_expungement_rate_increase:     'percent',
  rp_earnings_not_incarcerated:      'dollar',
  community_service_hours:           'hours',
  community_service_dollar_per_hour: 'dollar',
  pct_completing_community_service:  'percent',
  tax_avoided_earnings:              'dollar',
  tax_rate:                          'percent',
  pct_recidivism_reduction:          'percent',
}

export function unitOf(fieldKey: string): Unit {
  if (fieldKey.startsWith('rjc_outcome_split.')) return 'percent'
  const dot = fieldKey.indexOf('.')
  if (dot >= 0) return SUBFIELD_UNIT[fieldKey.slice(dot + 1)] ?? 'count'
  return HP_UNIT[fieldKey] ?? 'count'
}

export function isPercentField(fieldKey: string): boolean {
  return unitOf(fieldKey) === 'percent'
}

// The count/hours unit WORD for a field, used as a left-floated adornment
// (like $). null for $ and % fields. CJS/RJC labels vary by row.
const RJC_HOURS = new Set(['rjc_row12', 'rjc_row13', 'rjc_row15', 'rjc_row17', 'rjc_row18'])
const RJC_CASES = new Set(['rjc_row11', 'rjc_row22'])

export function unitLabel(fieldKey: string): string | null {
  const u = unitOf(fieldKey)
  if (u !== 'count' && u !== 'hours') return null

  if (!fieldKey.includes('.')) {
    if (fieldKey === 'avg_harmed_parties_per_case') return 'Parties'
    if (fieldKey === 'community_service_hours') return 'Hours'
    return 'Units'
  }

  const rowId = fieldKey.split('.')[0]
  if (rowId.startsWith('cjs_row')) {
    if (rowId === 'cjs_row16' || rowId === 'cjs_row17') return 'Days'
    if (rowId === 'cjs_row19') return 'Units'
    return 'Cases'
  }
  if (RJC_HOURS.has(rowId)) return 'Hours'
  if (RJC_CASES.has(rowId)) return 'Cases'
  return 'Units'
}

export interface Adornment {
  prefix?: string
  suffix?: string
  align: 'left' | 'right'
}

export function adornmentOf(fieldKey: string): Adornment {
  switch (unitOf(fieldKey)) {
    case 'dollar':  return { prefix: '$', align: 'left' }
    case 'percent': return { suffix: '%', align: 'right' }
    // count / hours: the unit word, left-floated like $
    default:        return { prefix: unitLabel(fieldKey) ?? 'Units', align: 'left' }
  }
}

/** Stored value (fraction for %) → the number shown/entered in the field. */
export function toDisplayValue(storedValue: number, fieldKey: string): number {
  return isPercentField(fieldKey) ? Number((storedValue * 100).toFixed(6)) : storedValue
}

/** Field value entered in the UI → the value to store (fraction for %). */
export function toStoredValue(enteredValue: number, fieldKey: string): number {
  return isPercentField(fieldKey) ? enteredValue / 100 : enteredValue
}

/** Read-only formatted value with its unit, e.g. "$1,500", "23%", "Parties 2". */
export function formatWithUnit(storedValue: number, fieldKey: string): string {
  const a = adornmentOf(fieldKey)
  const n = toDisplayValue(storedValue, fieldKey).toLocaleString('en-US', { maximumFractionDigits: 4 })
  if (a.prefix === '$') return `$${n}`
  if (a.prefix) return `${a.prefix} ${n}` // unit word prefix, e.g. "Cases 1"
  if (a.suffix) return `${n}${a.suffix}`  // "%"
  return n
}
