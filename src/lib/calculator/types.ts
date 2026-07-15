export interface CjsRow {
  units_required: number
  cost_per_unit: number
  pct_low: number
  pct_medium: number
  pct_high: number
}

export interface CjsProgramCosts {
  cjs_row13: CjsRow
  cjs_row14: CjsRow
  cjs_row15: CjsRow
  cjs_row16: CjsRow
  cjs_row17: CjsRow
  cjs_row18: CjsRow
  cjs_row19: CjsRow
}

export interface RjcRow {
  hours_or_units: number
  rate_per_unit: number
}

export interface RjcOutcomeSplit {
  resolution_pct: number
  preconferencing_only_pct: number
  conferenced_unresolved_pct: number
}

export interface RjcProgramCosts {
  rjc_row11: RjcRow
  rjc_row12: RjcRow
  rjc_row13: RjcRow
  rjc_row14: RjcRow
  rjc_row15: RjcRow
  rjc_row16: RjcRow
  rjc_row17: RjcRow
  rjc_row18: RjcRow
  rjc_row19: RjcRow
  rjc_row20: RjcRow
  rjc_row21: RjcRow
  rjc_row22: RjcRow
  rjc_preconferencing_overhead: RjcRow
  rjc_outcome_split: RjcOutcomeSplit
}

/**
 * The expungement fields (expungement_earnings_avoided, pct_expungement_rate_increase)
 * are used twice by the engine: once for the RP benefit total and once for the community
 * tax-revenue benefit. They are stored once here and referenced twice in the calculation.
 */
export interface HpRpCommunityInputs {
  avg_harmed_parties_per_case: number
  avg_restitution_per_hp: number
  pct_restitution_increase_rjc: number
  avoided_transportation_expense: number
  avoided_loss_of_income: number
  pct_time_expense_difference: number
  ged_earnings_increase: number
  pct_obtaining_ged: number
  expungement_earnings_avoided: number
  pct_expungement_rate_increase: number
  rp_earnings_not_incarcerated: number
  community_service_hours: number
  community_service_dollar_per_hour: number
  pct_completing_community_service: number
  tax_avoided_earnings: number
  tax_rate: number
  pct_recidivism_reduction: number
}

export interface RoiInputs {
  cjs: CjsProgramCosts
  rjc: RjcProgramCosts
  hp_rp_community: HpRpCommunityInputs
}

export interface Sensitivity<T> {
  low: T
  medium: T
  high: T
}

/** One RJC case-outcome scenario: its per-case cost, its share of cases, and the
 *  weighted contribution (cost × weight) it adds to the RJC average. */
export interface RjcScenarioCost {
  cost: number
  weight: number
  weighted: number
}

export interface RjcScenarioBreakdown {
  resolution: RjcScenarioCost
  preconferencing_only: RjcScenarioCost
  conferenced_unresolved: RjcScenarioCost
}

export interface RoiOutputs {
  cjs_cost_per_case: Sensitivity<number>
  rjc_avg_cost_per_case: number
  /** Per-scenario breakdown whose weighted contributions sum to rjc_avg_cost_per_case. */
  rjc_scenarios: RjcScenarioBreakdown
  hp_benefit: number
  rp_benefit: Sensitivity<number>
  community_benefit: Sensitivity<number>
  iroi: Sensitivity<number>
  iroi_by_category_medium: {
    program_savings: number
    harmed_party_benefits: number
    responsible_party_benefits: number
    community_benefits: number
  }
}
