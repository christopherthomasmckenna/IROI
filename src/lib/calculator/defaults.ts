import type { RoiInputs } from './types'

/**
 * Default values sourced directly from roi-model-fields.json, which was itself
 * validated against the source spreadsheet. These are the "factory" defaults —
 * each case stores its own frozen copy at creation time and never reads these again.
 */
export const DEFAULT_INPUTS: RoiInputs = {
  cjs: {
    cjs_row13: { units_required: 1,   cost_per_unit: 2000, pct_low: 1,    pct_medium: 1,    pct_high: 1 },
    cjs_row14: { units_required: 1,   cost_per_unit: 80,   pct_low: 1,    pct_medium: 1,    pct_high: 1 },
    cjs_row15: { units_required: 1,   cost_per_unit: 6000, pct_low: 1,    pct_medium: 1,    pct_high: 1 },
    cjs_row16: { units_required: 7,   cost_per_unit: 120,  pct_low: 0.1,  pct_medium: 0.5,  pct_high: 1 },
    cjs_row17: { units_required: 365, cost_per_unit: 120,  pct_low: 0.25, pct_medium: 0.65, pct_high: 1 },
    cjs_row18: { units_required: 1,   cost_per_unit: 746,  pct_low: 1,    pct_medium: 1,    pct_high: 1 },
    cjs_row19: { units_required: 0,   cost_per_unit: 0,    pct_low: 0,    pct_medium: 0,    pct_high: 0 },
  },
  rjc: {
    rjc_row11: { hours_or_units: 1,  rate_per_unit: 50   },
    rjc_row12: { hours_or_units: 15, rate_per_unit: 50   },
    rjc_row13: { hours_or_units: 15, rate_per_unit: 50   },
    rjc_row14: { hours_or_units: 10, rate_per_unit: 10   },
    rjc_row15: { hours_or_units: 4,  rate_per_unit: 50   },
    rjc_row16: { hours_or_units: 1,  rate_per_unit: 50   },
    rjc_row17: { hours_or_units: 10, rate_per_unit: 50   },
    rjc_row18: { hours_or_units: 10, rate_per_unit: 50   },
    rjc_row19: { hours_or_units: 1,  rate_per_unit: 300  },
    rjc_row20: { hours_or_units: 1,  rate_per_unit: 250  },
    rjc_row21: { hours_or_units: 1,  rate_per_unit: 150  },
    rjc_row22: { hours_or_units: 1,  rate_per_unit: 1000 },
    rjc_preconferencing_overhead: { hours_or_units: 1, rate_per_unit: 100 },
    rjc_outcome_split: {
      resolution_pct:             0.97,
      preconferencing_only_pct:   0.025,
      conferenced_unresolved_pct: 0.005,
    },
  },
  hp_rp_community: {
    avg_harmed_parties_per_case:    2,
    avg_restitution_per_hp:         1500,
    pct_restitution_increase_rjc:   0.23,
    avoided_transportation_expense: 250,
    avoided_loss_of_income:         5000,
    pct_time_expense_difference:    0.8,
    ged_earnings_increase:          8840,
    pct_obtaining_ged:              0.1,
    expungement_earnings_avoided:   3016,
    pct_expungement_rate_increase:  0.8,
    rp_earnings_not_incarcerated:   15080,
    community_service_hours:        40,
    community_service_dollar_per_hour: 15,
    pct_completing_community_service:  0.15,
    tax_avoided_earnings:           15080,
    tax_rate:                       0.1675,
    pct_recidivism_reduction:       0.15,
  },
}
