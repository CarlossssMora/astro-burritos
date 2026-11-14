import { describe, expect, it } from 'vitest'
import { latestCompletedYear, parseCoordinates, parseFormat, parseVariable, parseVariableList, parseWindow, RequestError } from '../../lib/api/validation'
import { getVariable, POINT_VARIABLE_IDS, REGION_VARIABLE_IDS, VARIABLES } from '../../lib/variables/catalog'

describe('request validation', () => {
  it('rejects inherited keys such as toString and __proto__', () => {
    expect(() => parseVariable('toString', 'point')).toThrow(RequestError)
    expect(() => parseVariable('__proto__', 'region')).toThrow(RequestError)
  })

  it('rejects daily-only variables in region requests', () => {
    expect(() => parseVariable('TN', 'region')).toThrow(/Valid values/)
    expect(parseVariable('T2M', 'region').id).toBe('T2M')
  })

  it('parses variable lists and defaults to every point variable', () => {
    expect(parseVariableList(null)).toEqual(POINT_VARIABLE_IDS)
    expect(parseVariableList('TN, TX,TN')).toEqual(['TN', 'TX'])
    expect(() => parseVariableList('TN,WS2M')).toThrow(/WS2M/)
  })

  it('defaults to the 2001–2024 common window and enforces bounds', () => {
    expect(parseWindow(null, null)).toEqual({ startYear: 2001, endYear: Math.min(2024, latestCompletedYear()) })
    expect(() => parseWindow('1980', '2000')).toThrow(RequestError)
    expect(() => parseWindow('2010', '2005')).toThrow(RequestError)
    expect(() => parseWindow('2001', String(latestCompletedYear() + 1))).toThrow(RequestError)
    expect(() => parseWindow('20x1', '2010')).toThrow(/valid year/)
  })

  it('validates coordinates and output format', () => {
    expect(parseCoordinates('19.04', '-98.2')).toEqual({ latitude: 19.04, longitude: -98.2 })
    expect(() => parseCoordinates('95', '0')).toThrow(RequestError)
    expect(() => parseCoordinates(null, '0')).toThrow(RequestError)
    expect(parseFormat(undefined)).toBe('json')
    expect(parseFormat('geojson')).toBe('geojson')
    expect(() => parseFormat('csv')).toThrow(RequestError)
  })
})

describe('variable catalog', () => {
  it('has unique ids, bilingual labels and coherent availability', () => {
    expect(new Set(VARIABLES.map((v) => v.id)).size).toBe(VARIABLES.length)
    for (const variable of VARIABLES) {
      expect(variable.label.es && variable.label.en).toBeTruthy()
      if (variable.availability.region) expect(variable.source.endpoint).toBe('monthly')
      if (variable.group === 'precipitation') expect(variable.trendPolicy).toBe('show-without-claim')
    }
    expect(REGION_VARIABLE_IDS).not.toContain('TN')
    expect(REGION_VARIABLE_IDS).toContain('TXx')
  })
})

describe('processing profiles', () => {
  it('gives every variable a complete profile', () => {
    for (const variable of VARIABLES) {
      expect(variable.profile.relevanceThreshold).toBeGreaterThan(0)
      expect(variable.profile.displayUnit).toMatch(/década/)
    }
  })

  it('customizes the rules by what each variable represents', () => {
    expect(getVariable('PRECTOTCORR')!.profile).toMatchObject({ trendScale: 'relative-percent', primaryMethod: 'sen-mann-kendall', anomaly: { kind: 'percent' }, nativeBounds: { min: 0 } })
    expect(getVariable('TX90p')!.profile).toMatchObject({ trendScale: 'percentage-points', primaryMethod: 'sen-mann-kendall', expectedValue: 10 })
    expect(getVariable('TXx')!.profile.primaryMethod).toBe('sen-mann-kendall')
    expect(getVariable('GWETROOT')!.profile).toMatchObject({ nativeBounds: { min: 0, max: 1 }, minBlockLength: 5 })
    expect(getVariable('TN')!.profile.seasons).toEqual(['dry', 'wet'])
    expect(getVariable('RH2M')!.profile.trendScale).toBe('percentage-points')
  })
})
