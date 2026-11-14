import { describe, expect, it } from 'vitest'
import { assessSeries, finalizeFamily, optionsFromProfile, sensitivityWindow, type AssessOptions } from '../../lib/analysis/robust-assessment'
import { getVariable } from '../../lib/variables/catalog'
import type { AnnualPoint } from '../../lib/analysis/annual-rules'

const tn = [9.929, 10.244, 10.3559, 9.9052, 10.7005, 10.2245, 10.2288, 10.0244, 10.3843, 9.7728, 10.2048, 10.1021, 10.4795, 10.4021, 10.8706, 10.8229, 10.3442, 10.5931, 11.1534, 10.8875, 10.5972, 10.7851, 11.5284, 11.6822]
const points = (start: number, values: Array<number | null>): AnnualPoint[] => values.map((value, i) => ({ year: start + i, value, validCount: value === null ? 11 : 12, expectedCount: 12, complete: value !== null }))
const OLS: AssessOptions = { policy: 'allowed', method: 'ols-hamed-rao', scale: 'absolute', displayUnit: '°C/década', referenceMean: null, relevanceThreshold: 0.1, unit: '°C' }

describe('robust assessment', () => {
  it('reports per-decade statistics, lines, display block and criteria for Puebla TN 2001–2024', () => {
    const trend = assessSeries(points(2001, tn), 2001, 2024, OLS)
    finalizeFamily([{ id: 'TN', trend }])
    expect(trend.nYears).toBe(24)
    expect(trend.slopePerDecade).toBeCloseTo(0.5152586956521738, 8)
    expect(trend.senPerDecade).toBeCloseTo(0.4941285714285712, 8)
    expect(trend.pValueHamedRao).toBeCloseTo(0.00014759962823842544, 6)
    expect(trend.qValue).toBeCloseTo(trend.pValueHamedRao as number, 12)
    expect(trend.display).toMatchObject({ method: 'ols-hamed-rao', scale: 'absolute', unit: '°C/década', exceedsRelevance: true })
    expect(trend.display.slope).toBeCloseTo(trend.slopePerDecade as number, 12)
    expect(trend.display.ci95).toEqual(trend.ci95BlockBootstrapPerDecade)
    expect(trend.lines.ols?.start.year).toBe(2001)
    // No data before 2001 in this fixture, so the sensitivity window (1981–2024) is unavailable: R5 fails.
    expect(trend.sensitivity).toBeNull()
    expect(trend.criteria).toMatchObject({ R1_qValue: true, R2_primaryInterval: true, R3_tfpw: true, R4_jackknife: true, R5_sensitivityWindow: false })
    expect(trend.verdict).toBe('probable')
  })

  it('reaches "robust" when the sensitivity window agrees', () => {
    const longer = points(1991, [...tn.slice(0, 10).map((v) => v - 0.4), ...tn])
    const trend = assessSeries(longer, 2001, 2024, OLS)
    finalizeFamily([{ id: 'TN', trend }])
    expect(trend.sensitivity).toMatchObject({ startYear: 1981, endYear: 2024, nYears: 34 })
    expect(trend.verdict).toBe('robust')
  })

  it('uses Sen + Gilbert as the primary method when the profile says so', () => {
    const trend = assessSeries(points(2001, tn), 2001, 2024, { ...OLS, method: 'sen-mann-kendall' })
    expect(trend.primary.slopePerDecade).toBeCloseTo(trend.senPerDecade as number, 12)
    expect(trend.display.ci95).toEqual(trend.ci95SenPerDecade)
  })

  it('expresses relative-percent trends against the 1991–2020 mean', () => {
    const rain = tn.map((v) => v * 100)
    const trend = assessSeries(points(2001, rain), 2001, 2024, { ...OLS, method: 'sen-mann-kendall', scale: 'relative-percent', displayUnit: '%/década', referenceMean: 1000, relevanceThreshold: 5, policy: 'show-without-claim' })
    expect(trend.display.unit).toBe('%/década')
    expect(trend.display.slope).toBeCloseTo((trend.senPerDecade as number) / 10, 10)
    expect(trend.claimAllowed).toBe(false)
    const missing = assessSeries(points(2001, rain), 2001, 2024, { ...OLS, scale: 'relative-percent', displayUnit: '%/década', referenceMean: null, relevanceThreshold: 5 })
    expect(missing.warnings.map((w) => w.code)).toContain('reference-unavailable')
    expect(missing.display.unit).toBe('°C/década')
  })

  it('flags robust trends smaller than the relevance threshold', () => {
    const tiny = points(1991, [...tn.slice(0, 10).map((v) => v - 0.4), ...tn].map((v) => 10 + (v - 10) / 20))
    const trend = assessSeries(tiny, 2001, 2024, OLS)
    finalizeFamily([{ id: 'x', trend }])
    expect(trend.display.exceedsRelevance).toBe(false)
    expect(trend.warnings.map((w) => w.code)).toContain('below-relevance')
  })

  it('excludes incomplete years without imputing and returns insufficient-data below 10 years', () => {
    const values: Array<number | null> = [...tn]
    values[5] = null
    const trend = assessSeries(points(2001, values), 2001, 2024, OLS)
    expect(trend.nYears).toBe(23)
    expect(trend.excludedIncompleteYears).toEqual([2006])
    const short = assessSeries(points(2001, tn.slice(0, 9)), 2001, 2009, OLS)
    finalizeFamily([{ id: 'y', trend: short }])
    expect(short.verdict).toBe('insufficient-data')
    expect(short.warnings.map((w) => w.code)).toContain('short-window')
  })

  it('builds options from a catalog profile and picks the sensitivity window', () => {
    const rain = getVariable('PRECTOTCORR')!
    expect(optionsFromProfile(rain.profile, rain.trendPolicy, rain.unit, 900)).toMatchObject({ method: 'sen-mann-kendall', scale: 'relative-percent', referenceMean: 900, relevanceThreshold: 5 })
    expect(sensitivityWindow(2001, 2024)).toEqual({ startYear: 1981, endYear: 2024 })
    expect(sensitivityWindow(1981, 2024)).toEqual({ startYear: 2001, endYear: 2024 })
  })
})
