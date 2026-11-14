import type { AutocorrelationDiagnostics, MannKendallResult } from '@/lib/nasa/types'

type YearValue = { year: number; value: number }

export function calculateLag1ResidualAutocorrelation(values: number[]): AutocorrelationDiagnostics {
  const method = 'Lag-1 residual Pearson correlation with a 1.96/sqrt(n) screening threshold; diagnostic only'
  if (values.length < 4) {
    return {
      lag1ResidualCorrelation: null,
      screeningThreshold: null,
      flagged: null,
      method,
      warnings: ['At least four residuals are required for the lag-1 autocorrelation screen.'],
    }
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const denominator = values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  if (denominator <= Number.EPSILON) {
    return {
      lag1ResidualCorrelation: null,
      screeningThreshold: 1.96 / Math.sqrt(values.length),
      flagged: null,
      method,
      warnings: ['Residual variance is zero; lag-1 autocorrelation is not estimable.'],
    }
  }

  const numerator = values.slice(1).reduce((sum, value, index) => sum + (value - mean) * (values[index] - mean), 0)
  const correlation = numerator / denominator
  const screeningThreshold = 1.96 / Math.sqrt(values.length)
  const flagged = Math.abs(correlation) > screeningThreshold
  return {
    lag1ResidualCorrelation: correlation,
    screeningThreshold,
    flagged,
    method,
    warnings: flagged ? ['Residual lag-1 autocorrelation exceeded the screening threshold; classical OLS and baseline Mann–Kendall uncertainty may be optimistic.'] : [],
  }
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1
  const absolute = Math.abs(value) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * absolute)
  const polynomial = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absolute * absolute)
  return 0.5 * (1 + sign * polynomial)
}

function median(values: number[]) {
  if (!values.length) return null
  const ordered = [...values].sort((first, second) => first - second)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

export function calculateSenSlope(points: YearValue[]) {
  const slopes: number[] = []
  for (let first = 0; first < points.length - 1; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const years = points[second].year - points[first].year
      if (years !== 0) slopes.push((points[second].value - points[first].value) / years)
    }
  }
  return median(slopes)
}

export function calculateMannKendall(points: YearValue[]): MannKendallResult {
  const warnings: string[] = []
  if (points.length < 3) {
    warnings.push('At least three observations are required for Mann–Kendall.')
    return { tau: null, score: null, pValue: null, significantAt05: null, method: 'Mann–Kendall monotonic trend test', warnings }
  }

  let score = 0
  const tieCounts = new Map<number, number>()
  for (const point of points) tieCounts.set(point.value, (tieCounts.get(point.value) ?? 0) + 1)
  for (let first = 0; first < points.length - 1; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      score += Math.sign(points[second].value - points[first].value)
    }
  }

  const n = points.length
  const tieCorrection = [...tieCounts.values()].reduce((sum, count) => sum + count * (count - 1) * (2 * count + 5), 0)
  const variance = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18
  const denominator = n * (n - 1) / 2
  const tau = denominator === 0 ? null : score / denominator
  if (variance <= 0) {
    warnings.push('All observations are tied; Mann–Kendall variance is not estimable.')
    return { tau, score, pValue: null, significantAt05: null, method: 'Mann–Kendall monotonic trend test with tie correction', warnings }
  }

  const z = score > 0 ? (score - 1) / Math.sqrt(variance) : score < 0 ? (score + 1) / Math.sqrt(variance) : 0
  const pValue = Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))))
  return { tau, score, pValue, significantAt05: pValue < 0.05, method: 'Mann–Kendall monotonic trend test with tie correction; autocorrelation must be assessed separately', warnings }
}
