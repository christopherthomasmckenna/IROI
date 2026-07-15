import type {
  CjsRow,
  HpRpCommunityInputs,
  RjcRow,
  RoiInputs,
} from '../calculator/types'
import type { RoiCaseField } from '../db/schema'

/**
 * Reconstruct a typed RoiInputs from the flat field rows stored in roi_case_fields.
 * Accepts any array with fieldKey + currentValue (compatible with both insert and
 * select shapes from Drizzle).
 */
export function convertFieldsToInputs(
  fields: Array<Pick<RoiCaseField, 'fieldKey' | 'currentValue'>>
): RoiInputs {
  const m = new Map(fields.map((f) => [f.fieldKey, Number(f.currentValue)]))

  const get = (key: string): number => {
    const v = m.get(key)
    if (v === undefined) throw new Error(`Missing case field: ${key}`)
    return v
  }

  const cjsRow = (id: string): CjsRow => ({
    units_required: get(`${id}.units_required`),
    cost_per_unit:  get(`${id}.cost_per_unit`),
    pct_low:        get(`${id}.pct_low`),
    pct_medium:     get(`${id}.pct_medium`),
    pct_high:       get(`${id}.pct_high`),
  })

  const rjcRow = (id: string): RjcRow => ({
    hours_or_units: get(`${id}.hours_or_units`),
    rate_per_unit:  get(`${id}.rate_per_unit`),
  })

  const hp: HpRpCommunityInputs = {
    avg_harmed_parties_per_case:       get('avg_harmed_parties_per_case'),
    avg_restitution_per_hp:            get('avg_restitution_per_hp'),
    pct_restitution_increase_rjc:      get('pct_restitution_increase_rjc'),
    avoided_transportation_expense:    get('avoided_transportation_expense'),
    avoided_loss_of_income:            get('avoided_loss_of_income'),
    pct_time_expense_difference:       get('pct_time_expense_difference'),
    ged_earnings_increase:             get('ged_earnings_increase'),
    pct_obtaining_ged:                 get('pct_obtaining_ged'),
    expungement_earnings_avoided:      get('expungement_earnings_avoided'),
    pct_expungement_rate_increase:     get('pct_expungement_rate_increase'),
    rp_earnings_not_incarcerated:      get('rp_earnings_not_incarcerated'),
    community_service_hours:           get('community_service_hours'),
    community_service_dollar_per_hour: get('community_service_dollar_per_hour'),
    pct_completing_community_service:  get('pct_completing_community_service'),
    tax_avoided_earnings:              get('tax_avoided_earnings'),
    tax_rate:                          get('tax_rate'),
    pct_recidivism_reduction:          get('pct_recidivism_reduction'),
  }

  return {
    cjs: {
      cjs_row13: cjsRow('cjs_row13'),
      cjs_row14: cjsRow('cjs_row14'),
      cjs_row15: cjsRow('cjs_row15'),
      cjs_row16: cjsRow('cjs_row16'),
      cjs_row17: cjsRow('cjs_row17'),
      cjs_row18: cjsRow('cjs_row18'),
      cjs_row19: cjsRow('cjs_row19'),
    },
    rjc: {
      rjc_row11:                     rjcRow('rjc_row11'),
      rjc_row12:                     rjcRow('rjc_row12'),
      rjc_row13:                     rjcRow('rjc_row13'),
      rjc_row14:                     rjcRow('rjc_row14'),
      rjc_row15:                     rjcRow('rjc_row15'),
      rjc_row16:                     rjcRow('rjc_row16'),
      rjc_row17:                     rjcRow('rjc_row17'),
      rjc_row18:                     rjcRow('rjc_row18'),
      rjc_row19:                     rjcRow('rjc_row19'),
      rjc_row20:                     rjcRow('rjc_row20'),
      rjc_row21:                     rjcRow('rjc_row21'),
      rjc_row22:                     rjcRow('rjc_row22'),
      rjc_preconferencing_overhead:  rjcRow('rjc_preconferencing_overhead'),
      rjc_outcome_split: {
        resolution_pct:             get('rjc_outcome_split.resolution_pct'),
        preconferencing_only_pct:   get('rjc_outcome_split.preconferencing_only_pct'),
        conferenced_unresolved_pct: get('rjc_outcome_split.conferenced_unresolved_pct'),
      },
    },
    hp_rp_community: hp,
  }
}
