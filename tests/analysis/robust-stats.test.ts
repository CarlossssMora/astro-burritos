import { describe, expect, it } from 'vitest'
import { blockBootstrapInterval, hamedRao, mannKendallScore, minimumDetectableTrend, olsFit, rankData, senWithInterval, trendFreePrewhitening } from '../../lib/analysis/robust-stats'

// Real annual series from the v2 audit (NASA POWER). Expected values come from docs/backend/analysis/stats.py.
const years = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const pueblaTN = { x: years(2001, 2024), y: [9.929, 10.244, 10.3559, 9.9052, 10.7005, 10.2245, 10.2288, 10.0244, 10.3843, 9.7728, 10.2048, 10.1021, 10.4795, 10.4021, 10.8706, 10.8229, 10.3442, 10.5931, 11.1534, 10.8875, 10.5972, 10.7851, 11.5284, 11.6822] }
const tehuacanRain = { x: years(1981, 2024), y: [1370.43, 746.12, 1035.03, 1480.16, 1165.22, 1231.29, 932.58, 929.73, 936.44, 1111.44, 1382.54, 1908.75, 1987.17, 699.0, 1458.08, 1052.18, 1586.94, 1546.89, 825.48, 822.35, 984.48, 907.27, 891.73, 948.85, 696.2, 844.0, 953.19, 915.81, 848.46, 1033.23, 893.47, 978.05, 955.64, 967.48, 829.24, 881.32, 1090.05, 981.51, 913.22, 904.71, 1051.78, 794.85, 756.84, 858.6] }
const pueblaWind = { x: years(1981, 2024), y: [2.0845, 2.0612, 2.1813, 2.0551, 1.9731, 2.153, 2.141, 2.1497, 2.1226, 2.091, 1.9826, 1.983, 2.0596, 1.9322, 1.9773, 2.0501, 2.1318, 2.1975, 2.2757, 2.2405, 2.1211, 2.0325, 2.1132, 2.1504, 2.1496, 2.0999, 1.9688, 2.1336, 2.0299, 2.1255, 2.0056, 1.9921, 2.0025, 1.9561, 1.9622, 1.94, 1.8169, 1.8844, 1.8401, 1.9847, 1.8767, 1.9259, 1.9448, 1.9533] }

describe('port of stats.py', () => {
  it('matches Hamed–Rao, TFPW, Sen interval and detectability for Puebla TN 2001–2024', () => {
    expect(hamedRao(pueblaTN).pValue).toBeCloseTo(0.00014759962823842544, 6)
    expect(hamedRao(pueblaTN).varianceFactor).toBeCloseTo(1, 10)
    expect(trendFreePrewhitening(pueblaTN).pValue).toBeCloseTo(0.00017663383441533654, 6)
    const sen = senWithInterval(pueblaTN)
    expect(sen.slope).toBeCloseTo(0.04941285714285712, 10)
    expect(sen.interval[0]).toBeCloseTo(0.02595, 10)
    expect(sen.interval[1]).toBeCloseTo(0.07622608695652172, 10)
    expect(minimumDetectableTrend(pueblaTN)).toBeCloseTo(0.03171890954584724, 8)
    expect(olsFit(pueblaTN).slope).toBeCloseTo(0.05152586956521738, 10)
  })

  it('matches stats.py for Tehuacán precipitation 1981–2024', () => {
    expect(hamedRao(tehuacanRain).pValue).toBeCloseTo(0.0156357508286547, 6)
    expect(trendFreePrewhitening(tehuacanRain).pValue).toBeCloseTo(0.015183282740178336, 6)
    expect(senWithInterval(tehuacanRain).interval[0]).toBeCloseTo(-11.29625, 8)
    expect(minimumDetectableTrend(tehuacanRain)).toBeCloseTo(11.368338976594124, 6)
  })

  it('inflates the variance when ranks are autocorrelated (Puebla wind 1981–2024)', () => {
    const result = hamedRao(pueblaWind)
    expect(result.varianceFactor).toBeCloseTo(2.4214914078661067, 8)
    expect(result.pValue).toBeCloseTo(0.011459024933103863, 6)
    expect(trendFreePrewhitening(pueblaWind).pValue).toBeCloseTo(5.353049500031173e-05, 7)
  })
})

describe('helpers', () => {
  it('ranks ties with their average rank', () => {
    expect(rankData([3, 1, 3, 2])).toEqual([3.5, 1, 3.5, 2])
  })

  it('scores a monotonic series with the maximum Mann–Kendall S', () => {
    expect(mannKendallScore([1, 2, 3, 4, 5])).toBe(10)
  })

  it('returns a deterministic block-bootstrap interval that contains the OLS slope', () => {
    const first = blockBootstrapInterval(pueblaTN)
    const second = blockBootstrapInterval(pueblaTN)
    expect(first).toEqual(second)
    expect(first.blockLength).toBe(3)
    const slope = olsFit(pueblaTN).slope
    expect(first.interval[0]).toBeLessThan(slope)
    expect(first.interval[1]).toBeGreaterThan(slope)
  })
})
