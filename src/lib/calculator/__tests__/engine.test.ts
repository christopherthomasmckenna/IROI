import { describe, it, expect } from 'vitest'
import { calculateRoi } from '../engine'
import { DEFAULT_INPUTS } from '../defaults'

/**
 * Reference values from roi-model-fields.json outputs_reference_values,
 * which were computed from the source spreadsheet with default inputs.
 * These numbers are the acceptance test for the ported calculation engine.
 */
const REFERENCE = {
  iroi: {
    low:    6.141271825755723,
    medium: 11.031652710241923,
    high:   15.336432120702682,
  },
  iroi_by_category_medium: {
    program_savings:            5.68844365470351,
    harmed_party_benefits:      1.611993658427588,
    responsible_party_benefits: 2.3229023688681285,
    community_benefits:         1.4083130282426963,
  },
}

describe('calculateRoi with default inputs', () => {
  const result = calculateRoi(DEFAULT_INPUTS)

  describe('intermediate values', () => {
    it('CJS cost low = 19,860', () => {
      expect(result.cjs_cost_per_case.low).toBe(19860)
    })
    it('CJS cost medium = 37,716', () => {
      expect(result.cjs_cost_per_case.medium).toBe(37716)
    })
    it('CJS cost high = 53,466', () => {
      expect(result.cjs_cost_per_case.high).toBe(53466)
    })
    it('RJC average cost per case ≈ 5,638.98', () => {
      expect(result.rjc_avg_cost_per_case).toBeCloseTo(5638.98, 2)
    })
    it('HP benefit = 9,090 (sensitivity-independent)', () => {
      expect(result.hp_benefit).toBe(9090)
    })
  })

  describe('RJC scenario breakdown', () => {
    it('weighted contributions sum to rjc_avg_cost_per_case', () => {
      const s = result.rjc_scenarios
      const sum =
        s.resolution.weighted + s.preconferencing_only.weighted + s.conferenced_unresolved.weighted
      expect(sum).toBeCloseTo(result.rjc_avg_cost_per_case, 10)
    })
    it('each weighted = cost × weight', () => {
      for (const s of [
        result.rjc_scenarios.resolution,
        result.rjc_scenarios.preconferencing_only,
        result.rjc_scenarios.conferenced_unresolved,
      ]) {
        expect(s.weighted).toBeCloseTo(s.cost * s.weight, 10)
      }
    })
  })

  describe('IROI sensitivity', () => {
    it('IROI low matches reference', () => {
      expect(result.iroi.low).toBeCloseTo(REFERENCE.iroi.low, 10)
    })
    it('IROI medium matches reference', () => {
      expect(result.iroi.medium).toBeCloseTo(REFERENCE.iroi.medium, 10)
    })
    it('IROI high matches reference', () => {
      expect(result.iroi.high).toBeCloseTo(REFERENCE.iroi.high, 10)
    })
  })

  describe('IROI by category at medium sensitivity', () => {
    it('program savings matches reference', () => {
      expect(result.iroi_by_category_medium.program_savings).toBeCloseTo(
        REFERENCE.iroi_by_category_medium.program_savings, 10
      )
    })
    it('harmed party benefits match reference', () => {
      expect(result.iroi_by_category_medium.harmed_party_benefits).toBeCloseTo(
        REFERENCE.iroi_by_category_medium.harmed_party_benefits, 10
      )
    })
    it('responsible party benefits match reference', () => {
      expect(result.iroi_by_category_medium.responsible_party_benefits).toBeCloseTo(
        REFERENCE.iroi_by_category_medium.responsible_party_benefits, 10
      )
    })
    it('community benefits match reference', () => {
      expect(result.iroi_by_category_medium.community_benefits).toBeCloseTo(
        REFERENCE.iroi_by_category_medium.community_benefits, 10
      )
    })
    it('category contributions sum to IROI medium', () => {
      const { program_savings, harmed_party_benefits, responsible_party_benefits, community_benefits } =
        result.iroi_by_category_medium
      expect(program_savings + harmed_party_benefits + responsible_party_benefits + community_benefits)
        .toBeCloseTo(result.iroi.medium, 10)
    })
  })
})

describe('calculateRoi input validation', () => {
  it('throws when outcome split does not sum to 1', () => {
    const badInputs = {
      ...DEFAULT_INPUTS,
      rjc: {
        ...DEFAULT_INPUTS.rjc,
        rjc_outcome_split: {
          resolution_pct:             0.97,
          preconferencing_only_pct:   0.05,
          conferenced_unresolved_pct: 0.005,
        },
      },
    }
    expect(() => calculateRoi(badInputs)).toThrow('must sum to 1')
  })
})
