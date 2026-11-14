/**
 * Autocorrelation-aware trend statistics for annual series.
 * TypeScript port of docs/backend/analysis/stats.py (validated against it in tests).
 */

export type XY = { x: number[]; y: number[] }

const Z975 = 1.959964
const Z80 = 0.841621

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Two-sided p-value of a standard normal statistic. */
export function normalTwoSided(z: number) {
  return erfc(Math.abs(z) / Math.SQRT2)
}

/** Complementary error function (Numerical Recipes erfcc, |error| < 1.2e-7). */
function erfc(x: number) {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  return x >= 0 ? r : 2 - r
}

export function autocorrelation(values: number[], lag: number) {
  const n = values.length
  if (lag >= n) return 0
  const m = mean(values)
  const denominator = values.reduce((sum, value) => sum + (value - m) ** 2, 0)
  if (denominator <= 0) return 0
  let numerator = 0
  for (let index = 0; index < n - lag; index += 1) numerator += (values[index] - m) * (values[index + lag] - m)
  return numerator / denominator
}

/** Average ranks (1-based) with ties. */
export function rankData(values: number[]) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const ranks = new Array<number>(values.length)
  let start = 0
  while (start < order.length) {
    let end = start
    while (end + 1 < order.length && order[end + 1].value === order[start].value) end += 1
    const rank = (start + end) / 2 + 1
    for (let k = start; k <= end; k += 1) ranks[order[k].index] = rank
    start = end + 1
  }
  return ranks
}

export function pairwiseSlopes({ x, y }: XY) {
  const slopes: number[] = []
  for (let i = 0; i < x.length - 1; i += 1) for (let j = i + 1; j < x.length; j += 1) if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]))
  return slopes.sort((a, b) => a - b)
}

export function median(sorted: number[]) {
  const n = sorted.length
  if (!n) return NaN
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

export function mannKendallScore(y: number[]) {
  let s = 0
  for (let i = 0; i < y.length - 1; i += 1) for (let j = i + 1; j < y.length; j += 1) s += Math.sign(y[j] - y[i])
  return s
}

export function mannKendallVariance(y: number[]) {
  const n = y.length
  const ties = new Map<number, number>()
  for (const value of y) ties.set(value, (ties.get(value) ?? 0) + 1)
  let correction = 0
  for (const count of ties.values()) correction += count * (count - 1) * (2 * count + 5)
  return (n * (n - 1) * (2 * n + 5) - correction) / 18
}

function zScore(s: number, variance: number) {
  if (variance <= 0) return 0
  return s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0
}

/** Sen's slope with the Gilbert (1987) 95% interval. */
export function senWithInterval(data: XY) {
  const slopes = pairwiseSlopes(data)
  const n = slopes.length
  const c = Z975 * Math.sqrt(mannKendallVariance(data.y))
  const clamp = (index: number) => Math.max(0, Math.min(n - 1, index))
  const lower = slopes[clamp(Math.round((n - c) / 2) - 1)]
  const upper = slopes[clamp(Math.round((n + c) / 2))]
  return { slope: median(slopes), interval: [lower, upper] as [number, number] }
}

/** Modified Mann–Kendall test (Hamed & Rao 1998) on ranks of the Sen-detrended series. */
export function hamedRao(data: XY) {
  const { x, y } = data
  const n = y.length
  const s = mannKendallScore(y)
  const variance = mannKendallVariance(y)
  const slope = median(pairwiseSlopes(data))
  const ranks = rankData(y.map((value, index) => value - slope * x[index]))
  const bound = Z975 / Math.sqrt(n)
  let accumulator = 0
  for (let lag = 1; lag < n - 2; lag += 1) {
    const r = autocorrelation(ranks, lag)
    if (Math.abs(r) > bound) accumulator += (n - lag) * (n - lag - 1) * (n - lag - 2) * r
  }
  const factor = Math.max(1e-3, 1 + (2 / (n * (n - 1) * (n - 2))) * accumulator)
  return { pValue: variance > 0 ? normalTwoSided(zScore(s, variance * factor)) : null, varianceFactor: factor }
}

/** Trend-free pre-whitening (Yue et al. 2002) followed by Mann–Kendall. */
export function trendFreePrewhitening(data: XY) {
  const { x, y } = data
  const slope = median(pairwiseSlopes(data))
  const detrended = y.map((value, index) => value - slope * x[index])
  const lag1 = autocorrelation(detrended, 1)
  const whitened = detrended.slice(1).map((value, index) => value - lag1 * detrended[index] + slope * x[index + 1])
  const variance = mannKendallVariance(whitened)
  return { pValue: variance > 0 ? normalTwoSided(zScore(mannKendallScore(whitened), variance)) : null, lag1 }
}

/** Deterministic PRNG so the same series always yields the same interval. */
function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(values: number[]) {
  let hash = 2166136261
  for (const value of values) {
    const text = value.toFixed(6)
    for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

export function olsFit({ x, y }: XY) {
  const mx = mean(x)
  const my = mean(y)
  let sxx = 0
  let sxy = 0
  for (let index = 0; index < x.length; index += 1) { sxx += (x[index] - mx) ** 2; sxy += (x[index] - mx) * (y[index] - my) }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const residuals = y.map((value, index) => value - (intercept + slope * x[index]))
  const sse = residuals.reduce((sum, value) => sum + value * value, 0)
  return { slope, intercept, residuals, sxx, sigma: Math.sqrt(sse / (x.length - 2)) }
}

/** 95% interval of the OLS slope by moving-block residual bootstrap (block ≈ n^(1/3), at least minBlock). */
export function blockBootstrapInterval(data: XY, replicates = 2000, minBlock = 2) {
  const { x, y } = data
  const n = x.length
  const block = Math.min(n - 1, Math.max(minBlock, 2, Math.round(Math.cbrt(n))))
  const fit = olsFit(data)
  const fitted = y.map((value, index) => value - fit.residuals[index])
  const mx = mean(x)
  const random = mulberry32(seedFrom(y))
  const slopes: number[] = []
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const sample: number[] = []
    while (sample.length < n) {
      const start = Math.floor(random() * (n - block + 1))
      for (let k = 0; k < block && sample.length < n; k += 1) sample.push(fit.residuals[start + k])
    }
    const yb = fitted.map((value, index) => value + sample[index])
    const my = mean(yb)
    let sxy = 0
    for (let index = 0; index < n; index += 1) sxy += (x[index] - mx) * (yb[index] - my)
    slopes.push(sxy / fit.sxx)
  }
  slopes.sort((a, b) => a - b)
  return { interval: [slopes[Math.floor(0.025 * replicates)], slopes[Math.floor(0.975 * replicates) - 1]] as [number, number], blockLength: block }
}

/** Slope detectable with 80% power at α = 0.05 (two-sided), inflated for AR(1) residuals. */
export function minimumDetectableTrend(data: XY) {
  const fit = olsFit(data)
  const lag1 = Math.min(0.95, Math.max(0, autocorrelation(fit.residuals, 1)))
  return ((Z975 + Z80) * fit.sigma) / Math.sqrt(fit.sxx) * Math.sqrt((1 + lag1) / (1 - lag1))
}
