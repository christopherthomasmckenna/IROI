import type {
  CjsProgramCosts,
  HpRpCommunityInputs,
  RjcProgramCosts,
  RjcScenarioBreakdown,
  RjcScenarioCost,
  RoiInputs,
  RoiOutputs,
  Sensitivity,
} from './types'

const CJS_ROWS = [
  'cjs_row13',
  'cjs_row14',
  'cjs_row15',
  'cjs_row16',
  'cjs_row17',
  'cjs_row18',
  'cjs_row19',
] as const satisfies ReadonlyArray<keyof CjsProgramCosts>

const RJC_FULL_ROWS = [
  'rjc_row11',
  'rjc_row12',
  'rjc_row13',
  'rjc_row14',
  'rjc_row15',
  'rjc_row16',
  'rjc_row17',
  'rjc_row18',
  'rjc_row19',
  'rjc_row20',
  'rjc_row21',
  'rjc_row22',
] as const satisfies ReadonlyArray<keyof RjcProgramCosts>

// ─── CJS ──────────────────────────────────────────────────────────────────────

function calcCjsCosts(cjs: CjsProgramCosts): Sensitivity<number> {
  return CJS_ROWS.reduce(
    (acc, key) => {
      const row = cjs[key]
      const costPerCase = row.units_required * row.cost_per_unit
      return {
        low:    acc.low    + costPerCase * row.pct_low,
        medium: acc.medium + costPerCase * row.pct_medium,
        high:   acc.high   + costPerCase * row.pct_high,
      }
    },
    { low: 0, medium: 0, high: 0 }
  )
}

// ─── RJC ──────────────────────────────────────────────────────────────────────

/**
 * The spreadsheet models three case-outcome paths, each with its own cost:
 *
 *   1. Full resolution (default 97%): all 12 RJC cost rows.
 *
 *   2. Pre-conferencing only, then CJS (default 2.5%): evaluation + pre-conf
 *      prep + the reduced preconferencing overhead (B27, $100 vs $300) + the
 *      CJS medium cost, because the case still goes through CJS.
 *
 *   3. Conferenced but unresolved, then CJS (default 0.5%): all 12 RJC rows
 *      + CJS medium cost, because the case still goes through CJS.
 *
 * RJC average cost = weighted sum of the three path costs using the outcome split.
 * The split must sum to 1; the UI enforces this by auto-deriving resolution_pct.
 */
function calcRjcBreakdown(rjc: RjcProgramCosts, cjsMedium: number): RjcScenarioBreakdown {
  const { resolution_pct, preconferencing_only_pct, conferenced_unresolved_pct } =
    rjc.rjc_outcome_split

  if (Math.abs(resolution_pct + preconferencing_only_pct + conferenced_unresolved_pct - 1) > 1e-9) {
    throw new Error(
      `RJC outcome split must sum to 1 (got ${resolution_pct + preconferencing_only_pct + conferenced_unresolved_pct})`
    )
  }

  const fullResolutionCost = RJC_FULL_ROWS.reduce(
    (sum, key) => sum + rjc[key].hours_or_units * rjc[key].rate_per_unit,
    0
  )

  const { hours_or_units: pcoH, rate_per_unit: pcoR } = rjc.rjc_preconferencing_overhead
  const preconferencingOnlyCost =
    rjc.rjc_row11.hours_or_units * rjc.rjc_row11.rate_per_unit +
    rjc.rjc_row12.hours_or_units * rjc.rjc_row12.rate_per_unit +
    pcoH * pcoR +
    cjsMedium

  const conferencedUnresolvedCost = fullResolutionCost + cjsMedium

  const scenario = (cost: number, weight: number): RjcScenarioCost => ({
    cost,
    weight,
    weighted: cost * weight,
  })

  return {
    resolution:             scenario(fullResolutionCost, resolution_pct),
    preconferencing_only:   scenario(preconferencingOnlyCost, preconferencing_only_pct),
    conferenced_unresolved: scenario(conferencedUnresolvedCost, conferenced_unresolved_pct),
  }
}

/** RJC average cost per case = sum of the three weighted scenario contributions. */
function rjcAvgFromBreakdown(b: RjcScenarioBreakdown): number {
  return b.resolution.weighted + b.preconferencing_only.weighted + b.conferenced_unresolved.weighted
}

// ─── Benefits ─────────────────────────────────────────────────────────────────

/**
 * HP (Harmed Party) benefit is sensitivity-independent.
 * = parties × (restitution × pct_increase) + parties × (transport + income) × time_pct
 */
function calcHpBenefit(hp: HpRpCommunityInputs): number {
  const restitution =
    hp.avg_harmed_parties_per_case *
    hp.avg_restitution_per_hp *
    hp.pct_restitution_increase_rjc

  const timeExpense =
    hp.avg_harmed_parties_per_case *
    (hp.avoided_transportation_expense + hp.avoided_loss_of_income) *
    hp.pct_time_expense_difference

  return restitution + timeExpense
}

/**
 * RP (Responsible Party) benefit varies by sensitivity because the earnings
 * benefit of avoiding incarceration scales with the incarceration likelihood
 * (sourced from CJS row 17 pct_low / pct_medium / pct_high).
 */
function calcRpBenefit(
  hp: HpRpCommunityInputs,
  row17Pct: Sensitivity<number>
): Sensitivity<number> {
  const ged         = hp.ged_earnings_increase * hp.pct_obtaining_ged
  const expungement = hp.expungement_earnings_avoided * hp.pct_expungement_rate_increase

  const rp = (incarcerationPct: number) =>
    hp.rp_earnings_not_incarcerated * incarcerationPct + expungement + ged

  return {
    low:    rp(row17Pct.low),
    medium: rp(row17Pct.medium),
    high:   rp(row17Pct.high),
  }
}

/**
 * Community benefit varies by sensitivity via the same CJS row 17 incarceration pct.
 *
 * Components:
 *   - Community service value (constant)
 *   - Tax revenue recovered: ((ged earnings) + (expungement earnings) + (avoided earnings × incarceration_pct)) × tax_rate
 *     Note: expungement_earnings_avoided is referenced here a second time (see type comment).
 *   - Recidivism savings: pct_recidivism_reduction × total CJS cost at this sensitivity
 */
function calcCommunityBenefit(
  hp: HpRpCommunityInputs,
  cjsCosts: Sensitivity<number>,
  row17Pct: Sensitivity<number>
): Sensitivity<number> {
  const service =
    hp.community_service_hours *
    hp.community_service_dollar_per_hour *
    hp.pct_completing_community_service

  const tax = (incarcerationPct: number) =>
    (hp.ged_earnings_increase * hp.pct_obtaining_ged +
     hp.expungement_earnings_avoided * hp.pct_expungement_rate_increase +
     hp.tax_avoided_earnings * incarcerationPct) *
    hp.tax_rate

  const recidivism = (cjsCost: number) => hp.pct_recidivism_reduction * cjsCost

  return {
    low:    service + tax(row17Pct.low)    + recidivism(cjsCosts.low),
    medium: service + tax(row17Pct.medium) + recidivism(cjsCosts.medium),
    high:   service + tax(row17Pct.high)   + recidivism(cjsCosts.high),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateRoi(inputs: RoiInputs): RoiOutputs {
  const cjs          = calcCjsCosts(inputs.cjs)
  const rjcScenarios = calcRjcBreakdown(inputs.rjc, cjs.medium)
  const rjcAvg       = rjcAvgFromBreakdown(rjcScenarios)

  const row17Pct: Sensitivity<number> = {
    low:    inputs.cjs.cjs_row17.pct_low,
    medium: inputs.cjs.cjs_row17.pct_medium,
    high:   inputs.cjs.cjs_row17.pct_high,
  }

  const hp        = calcHpBenefit(inputs.hp_rp_community)
  const rp        = calcRpBenefit(inputs.hp_rp_community, row17Pct)
  const community = calcCommunityBenefit(inputs.hp_rp_community, cjs, row17Pct)

  const iroi = (cjsCost: number, rpVal: number, communityVal: number) =>
    ((cjsCost - rjcAvg) + hp + rpVal + communityVal) / rjcAvg

  return {
    cjs_cost_per_case:    cjs,
    rjc_avg_cost_per_case: rjcAvg,
    rjc_scenarios:        rjcScenarios,
    hp_benefit:           hp,
    rp_benefit:           rp,
    community_benefit:    community,
    iroi: {
      low:    iroi(cjs.low,    rp.low,    community.low),
      medium: iroi(cjs.medium, rp.medium, community.medium),
      high:   iroi(cjs.high,   rp.high,   community.high),
    },
    iroi_by_category_medium: {
      program_savings:            (cjs.medium - rjcAvg) / rjcAvg,
      harmed_party_benefits:      hp              / rjcAvg,
      responsible_party_benefits: rp.medium       / rjcAvg,
      community_benefits:         community.medium / rjcAvg,
    },
  }
}
