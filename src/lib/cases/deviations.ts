// Deviation report: every way a case departs from the frozen Philadelphia
// model defaults. Powers the provenance brief on the public summary page and
// the PDF export. Pure functions — no DB access.

import type { RoiCaseField } from '../db/schema'
import {
  CJS_ROW_IDS,
  CJS_ROW_META,
  RJC_ROW_IDS,
  RJC_ROW_META,
  SPLIT_KEYS,
  HP_KEYS,
  FIELD_META,
} from './field-meta'
import { formatWithUnit } from './field-units'

export interface Deviation {
  fieldKey: string
  /** Cost-line label for CJS/RJC subfields; null for flat HP/split fields. */
  rowLabel: string | null
  /** The specific input's label ("Cost per unit", "Tax rate", …). */
  fieldLabel: string
  section: 'CJS Program Costs' | 'RJC Program Costs' | 'Case Outcome Split' | 'HP / RP / Community'
  defaultDisplay: string
  currentDisplay: string
  annotation: string | null
}

// Canonical display order: CJS rows, RJC rows, outcome split, HP/RP/Community —
// matching the case page top to bottom.
const ORDERED_KEYS: ReadonlyArray<{ key: string; rowLabel: string | null; section: Deviation['section'] }> = [
  ...CJS_ROW_IDS.flatMap((rowId) =>
    ['units_required', 'cost_per_unit', 'pct_low', 'pct_medium', 'pct_high'].map((sub) => ({
      key: `${rowId}.${sub}`,
      rowLabel: CJS_ROW_META[rowId]?.label ?? rowId,
      section: 'CJS Program Costs' as const,
    }))
  ),
  ...RJC_ROW_IDS.flatMap((rowId) =>
    ['hours_or_units', 'rate_per_unit'].map((sub) => ({
      key: `${rowId}.${sub}`,
      rowLabel: RJC_ROW_META[rowId]?.label ?? rowId,
      section: 'RJC Program Costs' as const,
    }))
  ),
  ...SPLIT_KEYS.map((key) => ({
    key,
    rowLabel: null,
    section: 'Case Outcome Split' as const,
  })),
  ...HP_KEYS.map((key) => ({
    key,
    rowLabel: null,
    section: 'HP / RP / Community' as const,
  })),
]

/**
 * All fields whose current value differs numerically from the frozen default,
 * in case-page display order, with display-formatted values and the creator's
 * annotation. Fields whose annotation lives on a grouped sibling (one shared
 * note per cost line) pick that note up via annotationByRow fallback.
 */
export function computeDeviations(
  fields: Array<Pick<RoiCaseField, 'fieldKey' | 'currentValue' | 'defaultValue'> & { annotation?: string | null }>
): Deviation[] {
  const byKey = new Map(fields.map((f) => [f.fieldKey, f]))

  // A grouped row's shared note is stored on one canonical sibling. Collect
  // per-row notes so every deviating member of the group can display it.
  const noteByRow = new Map<string, string>()
  for (const f of fields) {
    const dot = f.fieldKey.indexOf('.')
    if (dot === -1) continue
    const note = f.annotation?.trim()
    if (note) noteByRow.set(f.fieldKey.slice(0, dot), note)
  }

  const out: Deviation[] = []
  for (const { key, rowLabel, section } of ORDERED_KEYS) {
    const f = byKey.get(key)
    if (!f) continue
    if (Number(f.currentValue) === Number(f.defaultValue)) continue

    const dot = key.indexOf('.')
    const ownNote = f.annotation?.trim()
    const groupNote = dot === -1 ? undefined : noteByRow.get(key.slice(0, dot))

    out.push({
      fieldKey: key,
      rowLabel,
      fieldLabel: FIELD_META.get(key)?.label ?? key,
      section,
      defaultDisplay: formatWithUnit(Number(f.defaultValue), key),
      currentDisplay: formatWithUnit(Number(f.currentValue), key),
      annotation: ownNote || groupNote || null,
    })
  }
  return out
}
