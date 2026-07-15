/**
 * Compact metadata about each stored field key, derived once at module load
 * from roi-model-fields.json.
 *
 * Provides human-readable labels and identifies which fields are creator-editable
 * (independently of the CREATOR_EDITABLE_FIELDS set in permissions.ts, which
 * should agree — this is the source for the display layer).
 */
import fieldsJson from '../../../docs/roi-model-fields.json'

export interface FieldMeta {
  label: string
  note: string | null
  creatorEditable: boolean
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

const CJS_SUBFIELDS: Record<string, { label: string; creatorEditable: boolean }> = {
  units_required: { label: 'Units required',  creatorEditable: true  },
  cost_per_unit:  { label: 'Cost per unit',   creatorEditable: true  },
  pct_low:        { label: '% applicability — low',    creatorEditable: true },
  pct_medium:     { label: '% applicability — medium', creatorEditable: true },
  pct_high:       { label: '% applicability — high',   creatorEditable: true },
}

const RJC_SUBFIELDS: Record<string, { label: string; creatorEditable: boolean }> = {
  hours_or_units: { label: 'Hours / units',  creatorEditable: false },
  rate_per_unit:  { label: 'Rate per unit',  creatorEditable: false },
}

const SPLIT_SUBFIELDS: Record<string, { label: string; creatorEditable: boolean }> = {
  resolution_pct:             { label: 'Full resolution %',            creatorEditable: true  },
  preconferencing_only_pct:   { label: 'Pre-conferencing only % (→ CJS)', creatorEditable: true  },
  conferenced_unresolved_pct: { label: 'Conferenced unresolved % (→ CJS)', creatorEditable: true  },
}

// ─── Row-level labels ─────────────────────────────────────────────────────────

type RowEntry = { id: string; label: string; notes: string | null }

export const CJS_ROW_META: Record<string, { label: string; notes: string | null }> = {}
for (const row of fieldsJson.cjs_program_costs as RowEntry[]) {
  CJS_ROW_META[row.id] = { label: row.label, notes: row.notes }
}

export const RJC_ROW_META: Record<string, { label: string; notes: string | null }> = {}
for (const row of fieldsJson.rjc_program_costs as RowEntry[]) {
  RJC_ROW_META[row.id] = { label: row.label, notes: row.notes }
}

RJC_ROW_META['rjc_preconferencing_overhead'] = {
  label: fieldsJson.rjc_preconferencing_overhead.label,
  notes: fieldsJson.rjc_preconferencing_overhead.notes,
}

// ─── Flat HP / RP / Community metadata ───────────────────────────────────────

type HpEntry = { label: string; notes: string | null; creator_editable: boolean }

const _hpJson = fieldsJson.hp_rp_community_inputs as Record<string, HpEntry>

// ─── FIELD_META — the unified lookup ─────────────────────────────────────────

/**
 * The ⓘ tooltip explanation for a field: the variable's descriptive spreadsheet
 * label combined with its notes. Using the label as the base guarantees every
 * field gets a meaningful explanation even where the spreadsheet had no notes.
 */
function explain(
  descriptiveLabel: string | null | undefined,
  notes: string | null | undefined
): string | null {
  const parts = [descriptiveLabel, notes]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
  return parts.length > 0 ? parts.join(' — ') : null
}

function buildFieldMeta(): Map<string, FieldMeta> {
  const m = new Map<string, FieldMeta>()

  // CJS — descriptive text is the cost-line (row) label
  for (const row of fieldsJson.cjs_program_costs as RowEntry[]) {
    const note = explain(row.label, row.notes)
    for (const [sf, sfMeta] of Object.entries(CJS_SUBFIELDS)) {
      m.set(`${row.id}.${sf}`, {
        label:           sfMeta.label,
        note,
        creatorEditable: sfMeta.creatorEditable,
      })
    }
  }

  // RJC rows — descriptive text is the cost-line (row) label
  for (const row of fieldsJson.rjc_program_costs as RowEntry[]) {
    const note = explain(row.label, row.notes)
    for (const [sf, sfMeta] of Object.entries(RJC_SUBFIELDS)) {
      m.set(`${row.id}.${sf}`, {
        label:           sfMeta.label,
        note,
        creatorEditable: sfMeta.creatorEditable,
      })
    }
  }

  // RJC preconferencing overhead
  const pco = fieldsJson.rjc_preconferencing_overhead
  const pcoNote = explain(pco.label, pco.notes)
  for (const [sf, sfMeta] of Object.entries(RJC_SUBFIELDS)) {
    m.set(`rjc_preconferencing_overhead.${sf}`, {
      label:           sfMeta.label,
      note:            pcoNote,
      creatorEditable: sfMeta.creatorEditable,
    })
  }

  // RJC outcome split — descriptive text is the per-row split label
  const splitNotes = fieldsJson.rjc_outcome_split.notes
  for (const [sf, sfMeta] of Object.entries(SPLIT_SUBFIELDS)) {
    m.set(`rjc_outcome_split.${sf}`, {
      label:           sfMeta.label,
      note:            explain(sfMeta.label, splitNotes),
      creatorEditable: sfMeta.creatorEditable,
    })
  }

  // HP / RP / Community — descriptive text is the field label
  for (const [key, entry] of Object.entries(_hpJson)) {
    if (key.includes('_DUPLICATE_OF_')) continue
    m.set(key, {
      label:           entry.label,
      note:            explain(entry.label, entry.notes),
      creatorEditable: entry.creator_editable,
    })
  }

  // The curated, admin-editable tooltip text lives in field_tooltips (keyed by
  // variable). It's the source of truth for the ⓘ explanation; the explain()
  // values above remain only as a fallback for any key not present there.
  const tooltips = (fieldsJson as { field_tooltips?: Record<string, string> }).field_tooltips
  if (tooltips) {
    for (const [key, meta] of m) {
      const tip = tooltips[variableKeyOf(key)]
      if (tip != null && tip.trim() !== '') {
        m.set(key, { ...meta, note: tip })
      }
    }
  }

  return m
}

export const FIELD_META: ReadonlyMap<string, FieldMeta> = buildFieldMeta()

/** Ordered CJS row IDs as they appear in the model */
export const CJS_ROW_IDS = [
  'cjs_row13', 'cjs_row14', 'cjs_row15',
  'cjs_row16', 'cjs_row17', 'cjs_row18', 'cjs_row19',
] as const

/** Ordered RJC row IDs (program cost rows) */
export const RJC_ROW_IDS = [
  'rjc_row11', 'rjc_row12', 'rjc_row13', 'rjc_row14',
  'rjc_row15', 'rjc_row16', 'rjc_row17', 'rjc_row18',
  'rjc_row19', 'rjc_row20', 'rjc_row21', 'rjc_row22',
  'rjc_preconferencing_overhead',
] as const

/** Ordered outcome split sub-field keys */
export const SPLIT_KEYS = [
  'rjc_outcome_split.resolution_pct',
  'rjc_outcome_split.preconferencing_only_pct',
  'rjc_outcome_split.conferenced_unresolved_pct',
] as const

/** Ordered HP/RP/Community field keys (no duplicates) */
export const HP_KEYS = Object.keys(_hpJson).filter(
  (k) => !k.includes('_DUPLICATE_OF_')
) as string[]

/**
 * The HP/RP/Community section splits into three benefit subsections, partitioned
 * by their source-spreadsheet cells (HP B15–24, RP B28–36, Community B43–59).
 * Each gets its own subtotal from the engine (hp/rp/community benefit).
 */
export const HP_SUBSECTIONS = [
  {
    key: 'hp' as const,
    title: 'Harmed Party',
    fieldKeys: [
      'avg_harmed_parties_per_case',
      'avg_restitution_per_hp',
      'pct_restitution_increase_rjc',
      'avoided_transportation_expense',
      'avoided_loss_of_income',
      'pct_time_expense_difference',
    ],
  },
  {
    key: 'rp' as const,
    title: 'Responsible Party',
    fieldKeys: [
      'ged_earnings_increase',
      'pct_obtaining_ged',
      'expungement_earnings_avoided',
      'pct_expungement_rate_increase',
      'rp_earnings_not_incarcerated',
    ],
  },
  {
    key: 'community' as const,
    title: 'Community',
    fieldKeys: [
      'community_service_hours',
      'community_service_dollar_per_hour',
      'pct_completing_community_service',
      'tax_avoided_earnings',
      'tax_rate',
      'pct_recidivism_reduction',
    ],
  },
]

// ─── Field explanations: variables + override resolution ──────────────────────

/**
 * Map a stored field key to its logical "variable" key — the unit an admin edits
 * an explanation for. CJS/RJC subfields collapse to their cost-line row; each
 * outcome-split value and each HP/RP/Community field is its own variable.
 */
export function variableKeyOf(fieldKey: string): string {
  if (fieldKey.startsWith('rjc_outcome_split.')) return fieldKey
  const dot = fieldKey.indexOf('.')
  return dot === -1 ? fieldKey : fieldKey.slice(0, dot)
}

/**
 * The effective ⓘ explanation for a field: an admin override (keyed by variable)
 * if present, else the JSON-derived default from FIELD_META.
 */
export function resolveExplanation(
  fieldKey: string,
  overrides?: ReadonlyMap<string, string>
): string | null {
  const override = overrides?.get(variableKeyOf(fieldKey))
  if (override != null) return override
  return FIELD_META.get(fieldKey)?.note ?? null
}

export type SectionLabel = 'CJS Program Costs' | 'RJC Program Costs' | 'HP / RP / Community'

export interface FieldVariable {
  variableKey: string
  label: string
  section: SectionLabel
  defaultExplanation: string | null
}

/** The logical variables an admin can edit explanations for, in display order. */
function buildFieldVariables(): FieldVariable[] {
  const vars: FieldVariable[] = []

  for (const rowId of CJS_ROW_IDS) {
    vars.push({
      variableKey: rowId,
      label: CJS_ROW_META[rowId]?.label ?? rowId,
      section: 'CJS Program Costs',
      defaultExplanation: FIELD_META.get(`${rowId}.units_required`)?.note ?? null,
    })
  }

  for (const rowId of RJC_ROW_IDS) {
    vars.push({
      variableKey: rowId,
      label: RJC_ROW_META[rowId]?.label ?? rowId,
      section: 'RJC Program Costs',
      defaultExplanation: FIELD_META.get(`${rowId}.hours_or_units`)?.note ?? null,
    })
  }

  for (const key of SPLIT_KEYS) {
    vars.push({
      variableKey: key,
      label: FIELD_META.get(key)?.label ?? key,
      section: 'RJC Program Costs',
      defaultExplanation: FIELD_META.get(key)?.note ?? null,
    })
  }

  for (const key of HP_KEYS) {
    vars.push({
      variableKey: key,
      label: FIELD_META.get(key)?.label ?? key,
      section: 'HP / RP / Community',
      defaultExplanation: FIELD_META.get(key)?.note ?? null,
    })
  }

  return vars
}

export const FIELD_VARIABLES: readonly FieldVariable[] = buildFieldVariables()
