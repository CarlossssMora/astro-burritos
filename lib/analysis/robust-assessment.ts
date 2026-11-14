/**
 * Full trend assessment for one annual series (API v2): classical OLS/Mann–Kendall from
 * lib/analysis/trend.ts plus autocorrelation-aware inference, detectability, stability
 * checks, pre-declared robustness criteria and a display block in the variable's own
 * processing profile (scale, primary method, relevance threshold).
 */
import { calculateTrend } from './trend'
import { adjustBenjaminiHochberg } from './multiple-testing'
import { blockBootstrapInterval, hamedRao, median, minimumDetectableTrend, olsFit, pairwiseSlopes, senWithInterval, trendFreePrewhitening, type XY } from './robust-stats'
import type { AnnualPoint } from './annual-rules'
import type { ProcessingProfile, TrendPolicy } from '../variables/catalog'

export const MIN_TREND_YEARS = 10

export type Verdict = 'robust' | 'probable' | 'weak' | 'not-detectable' | 'insufficient-data'
export type WarningCode = 'short-window' | 'incomplete-years-excluded' | 'autocorrelation' | 'window-sensitive' | 'not-claimable' | 'no-data' | 'reference-unavailable' | 'below-relevance' | 'out-of-bounds-removed'
export type ApiWarning = { code: WarningCode; es: string; en: string }
export type TrendLine = { start: { year: number; value: number }; end: { year: number; value: number } }

export type AssessOptions = {
  policy: TrendPolicy
  method: ProcessingProfile['primaryMethod']
  scale: ProcessingProfile['trendScale']
  displayUnit: string
  /** 1991–2020 mean of the series; required by the relative-percent scale. */
  referenceMean: number | null
  relevanceThreshold: number
  minBlockLength?: number
  unit?: string
}

/** Headline result in the profile's scale and method: what the interface shows first. */
export type TrendDisplay = {
  method: ProcessingProfile['primaryMethod']
  scale: ProcessingProfile['trendScale']
  unit: string
  slope: number | null
  ci95: [number, number] | null
  /** Hamed–Rao p-value (same for both methods). */
  pValue: number | null
  referenceMean: number | null
  relevanceThreshold: number
  /** |slope| ≥ relevanceThreshold. A robust but non-relevant trend reads as “significant but small”. */
  exceedsRelevance: boolean | null
}

export type RobustTrend = {
  window: { startYear: number; endYear: number }
  nYears: number
  excludedIncompleteYears: number[]
  display: TrendDisplay
  /** Primary method in native units per decade (used by the criteria). */
  primary: { method: ProcessingProfile['primaryMethod']; slopePerDecade: number | null; ci95PerDecade: [number, number] | null }
  slopePerDecade: number | null
  ci95OlsPerDecade: [number, number] | null
  ci95BlockBootstrapPerDecade: [number, number] | null
  senPerDecade: number | null
  ci95SenPerDecade: [number, number] | null
  pValueOls: number | null
  pValueMannKendall: number | null
  /** Primary p-value: Mann–Kendall corrected for autocorrelation (Hamed & Rao 1998). */
  pValueHamedRao: number | null
  hamedRaoVarianceFactor: number | null
  pValueTfpw: number | null
  lag1ResidualAutocorrelation: number | null
  rSquared: number | null
  minimumDetectablePerDecade: number | null
  /** |OLS slope| ÷ minimum detectable trend; below 1 the window is too short or noisy to detect a trend of this size. */
  detectabilityRatio: number | null
  jackknife: { signKeptShare: number; significantShare: number; minPerDecade: number; maxPerDecade: number } | null
  sensitivity: { startYear: number; endYear: number; nYears: number; slopePerDecade: number; pValueHamedRao: number | null } | null
  /** Benjamini–Hochberg q within the response family (see family in the response). */
  qValue: number | null
  criteria: { R1_qValue: boolean; R2_primaryInterval: boolean; R3_tfpw: boolean; R4_jackknife: boolean; R5_sensitivityWindow: boolean } | null
  criteriaMet: number
  verdict: Verdict
  /** False for variables whose trend must not be stated (precipitation): plot the series, no arrows or “increase/decrease” text. */
  claimAllowed: boolean
  lines: { ols: TrendLine | null; sen: TrendLine | null }
  warnings: ApiWarning[]
}

const W: Record<WarningCode, { es: string; en: string }> = {
  'short-window': { es: 'Menos de 10 años completos: no se estima tendencia.', en: 'Fewer than 10 complete years: no trend is estimated.' },
  'incomplete-years-excluded': { es: 'Se excluyeron años incompletos; no se imputan valores.', en: 'Incomplete years were excluded; nothing is imputed.' },
  autocorrelation: { es: 'Residuos autocorrelacionados: usar el p de Hamed–Rao y el intervalo principal, no el p de OLS.', en: 'Autocorrelated residuals: use the Hamed–Rao p and the primary interval, not the OLS p.' },
  'window-sensitive': { es: 'La tendencia cambia de signo o pierde significancia en la ventana de sensibilidad.', en: 'The trend changes sign or loses significance in the sensitivity window.' },
  'not-claimable': { es: 'Variable sin afirmación de tendencia: mostrar la serie sin indicar aumento ni disminución.', en: 'Variable without trend claims: show the series without stating an increase or decrease.' },
  'no-data': { es: 'Sin datos utilizables en esta celda.', en: 'No usable data for this cell.' },
  'reference-unavailable': { es: 'No hay 25 años completos en 1991–2020 para expresar el cambio en %; se muestra en unidades nativas.', en: 'Fewer than 25 complete 1991–2020 years to express the change in %; native units are shown.' },
  'below-relevance': { es: 'Tendencia estadísticamente sólida pero menor que el umbral de relevancia de la variable.', en: 'Statistically solid trend but smaller than the variable’s relevance threshold.' },
  'out-of-bounds-removed': { es: 'Se eliminaron registros fuera de los límites físicos de la variable.', en: 'Records outside the variable’s physical limits were removed.' },
}
export const warning = (code: WarningCode): ApiWarning => ({ code, ...W[code] })

export function sensitivityWindow(startYear: number, endYear: number) {
  return startYear <= 1985 ? { startYear: Math.max(startYear, endYear - 23), endYear } : { startYear: 1981, endYear }
}

function toXY(points: AnnualPoint[], startYear: number, endYear: number): XY {
  const usable = points.filter((point) => point.complete && point.value !== null && point.year >= startYear && point.year <= endYear)
  return { x: usable.map((point) => point.year), y: usable.map((point) => point.value as number) }
}

function line(slope: number, intercept: number, a: number, b: number): TrendLine {
  return { start: { year: a, value: intercept + slope * a }, end: { year: b, value: intercept + slope * b } }
}

const primarySlope = (data: XY, method: AssessOptions['method']) => method === 'sen-mann-kendall' ? median(pairwiseSlopes(data)) : olsFit(data).slope

function scaleFactor(options: AssessOptions) {
  if (options.scale !== 'relative-percent') return 1
  return options.referenceMean !== null && options.referenceMean > 0 ? 100 / options.referenceMean : null
}

/** Step 1: statistics that do not depend on the family. */
export function assessSeries(points: AnnualPoint[], startYear: number, endYear: number, options: AssessOptions): RobustTrend {
  const data = toXY(points, startYear, endYear)
  const inWindow = points.filter((point) => point.year >= startYear && point.year <= endYear)
  const excluded = inWindow.filter((point) => !point.complete || point.value === null).map((point) => point.year)
  const factor = scaleFactor(options)
  const base: RobustTrend = {
    window: { startYear, endYear }, nYears: data.x.length, excludedIncompleteYears: excluded,
    display: { method: options.method, scale: options.scale, unit: factor === null ? `${options.unit ?? ''}/década` : options.displayUnit, slope: null, ci95: null, pValue: null, referenceMean: options.referenceMean, relevanceThreshold: options.relevanceThreshold, exceedsRelevance: null },
    primary: { method: options.method, slopePerDecade: null, ci95PerDecade: null },
    slopePerDecade: null, ci95OlsPerDecade: null, ci95BlockBootstrapPerDecade: null, senPerDecade: null, ci95SenPerDecade: null,
    pValueOls: null, pValueMannKendall: null, pValueHamedRao: null, hamedRaoVarianceFactor: null, pValueTfpw: null,
    lag1ResidualAutocorrelation: null, rSquared: null, minimumDetectablePerDecade: null, detectabilityRatio: null,
    jackknife: null, sensitivity: null, qValue: null, criteria: null, criteriaMet: 0, verdict: 'insufficient-data',
    claimAllowed: options.policy === 'allowed', lines: { ols: null, sen: null }, warnings: [],
  }
  if (excluded.length) base.warnings.push(warning('incomplete-years-excluded'))
  if (options.policy !== 'allowed') base.warnings.push(warning('not-claimable'))
  if (options.scale === 'relative-percent' && factor === null) base.warnings.push(warning('reference-unavailable'))
  if (data.x.length < MIN_TREND_YEARS || new Set(data.y).size < 3) {
    base.warnings.push(warning(data.x.length ? 'short-window' : 'no-data'))
    return base
  }
  const classical = calculateTrend(data.x.map((year, index) => ({ year, value: data.y[index], unit: options.unit ?? '', validObservationCount: 12, expectedObservationCount: 12, completeness: 1 })))
  const fit = olsFit(data)
  const sen = senWithInterval(data)
  const senResiduals = data.y.map((value, index) => value - sen.slope * data.x[index]).sort((a, b) => a - b)
  const senIntercept = median(senResiduals)
  const hr = hamedRao(data)
  const tfpw = trendFreePrewhitening(data)
  const boot = blockBootstrapInterval(data, 2000, options.minBlockLength ?? 2)
  const mdt = minimumDetectableTrend(data)
  const method = options.method
  const primary = method === 'sen-mann-kendall'
    ? { slope: sen.slope, interval: sen.interval }
    : { slope: fit.slope, interval: boot.interval }
  const jack = data.x.map((year) => {
    const sub = { x: data.x.filter((value) => value !== year), y: data.y.filter((_, index) => data.x[index] !== year) }
    return { slope: primarySlope(sub, method), p: hamedRao(sub).pValue }
  })
  const sign = Math.sign(primary.slope)
  const sw = sensitivityWindow(startYear, endYear)
  const sData = toXY(points, sw.startYear, sw.endYear)
  // The sensitivity check only counts when it uses a different set of years (otherwise R5 would pass trivially).
  const sameYears = sData.x.length === data.x.length && sData.x.every((year, index) => year === data.x[index])
  const sensitivity = sData.x.length >= MIN_TREND_YEARS && !sameYears
    ? { ...sw, nYears: sData.x.length, slopePerDecade: primarySlope(sData, method) * 10, pValueHamedRao: hamedRao(sData).pValue }
    : null
  const a = data.x[0]
  const b = data.x[data.x.length - 1]
  if (classical.autocorrelation.flagged) base.warnings.push(warning('autocorrelation'))
  const displaySlope = factor === null ? primary.slope * 10 : primary.slope * 10 * factor
  const displayCi: [number, number] = factor === null ? [primary.interval[0] * 10, primary.interval[1] * 10] : [primary.interval[0] * 10 * factor, primary.interval[1] * 10 * factor]
  return {
    ...base,
    display: { ...base.display, slope: displaySlope, ci95: displayCi, pValue: hr.pValue, exceedsRelevance: Math.abs(displaySlope) >= options.relevanceThreshold },
    primary: { method, slopePerDecade: primary.slope * 10, ci95PerDecade: [primary.interval[0] * 10, primary.interval[1] * 10] },
    slopePerDecade: fit.slope * 10,
    ci95OlsPerDecade: classical.confidenceInterval95 ? [classical.confidenceInterval95[0] * 10, classical.confidenceInterval95[1] * 10] : null,
    ci95BlockBootstrapPerDecade: [boot.interval[0] * 10, boot.interval[1] * 10],
    senPerDecade: sen.slope * 10,
    ci95SenPerDecade: [sen.interval[0] * 10, sen.interval[1] * 10],
    pValueOls: classical.pValue,
    pValueMannKendall: classical.mannKendall?.pValue ?? null,
    pValueHamedRao: hr.pValue,
    hamedRaoVarianceFactor: hr.varianceFactor,
    pValueTfpw: tfpw.pValue,
    lag1ResidualAutocorrelation: classical.autocorrelation.lag1ResidualCorrelation,
    rSquared: classical.rSquared,
    minimumDetectablePerDecade: mdt * 10,
    detectabilityRatio: mdt > 0 ? Math.abs(fit.slope) / mdt : null,
    jackknife: {
      signKeptShare: jack.filter((item) => Math.sign(item.slope) === sign).length / jack.length,
      significantShare: jack.filter((item) => item.p !== null && item.p < 0.05).length / jack.length,
      minPerDecade: Math.min(...jack.map((item) => item.slope)) * 10,
      maxPerDecade: Math.max(...jack.map((item) => item.slope)) * 10,
    },
    sensitivity,
    lines: { ols: line(fit.slope, fit.intercept, a, b), sen: line(sen.slope, senIntercept, a, b) },
  }
}

/** Step 2: Benjamini–Hochberg over a declared family, then criteria and verdict (on the primary method). */
export function finalizeFamily(trends: Array<{ id: string; trend: RobustTrend }>, alpha = 0.05) {
  const q = new Map(adjustBenjaminiHochberg(trends.map((item) => ({ id: item.id, pValue: item.trend.pValueHamedRao })), alpha).map((item) => [item.id, item.qValue]))
  for (const { id, trend } of trends) {
    trend.qValue = q.get(id) ?? null
    const slope = trend.primary.slopePerDecade
    const interval = trend.primary.ci95PerDecade
    if (slope === null || interval === null) continue
    const sign = Math.sign(slope)
    const s = trend.sensitivity
    const criteria = {
      R1_qValue: trend.qValue !== null && trend.qValue < 0.05,
      R2_primaryInterval: interval[0] * interval[1] > 0,
      R3_tfpw: trend.pValueTfpw !== null && trend.pValueTfpw < 0.05,
      R4_jackknife: trend.jackknife !== null && trend.jackknife.signKeptShare === 1 && trend.jackknife.significantShare >= 0.9,
      R5_sensitivityWindow: s !== null && Math.sign(s.slopePerDecade) === sign && s.pValueHamedRao !== null && s.pValueHamedRao < 0.1,
    }
    trend.criteria = criteria
    trend.criteriaMet = Object.values(criteria).filter(Boolean).length
    trend.verdict = trend.criteriaMet === 5 ? 'robust' : trend.criteriaMet >= 3 && criteria.R1_qValue ? 'probable' : trend.pValueHamedRao !== null && trend.pValueHamedRao < 0.1 ? 'weak' : 'not-detectable'
    if (s && !criteria.R5_sensitivityWindow && (trend.verdict === 'probable' || trend.verdict === 'weak' || Math.sign(s.slopePerDecade) !== sign)) trend.warnings.push(warning('window-sensitive'))
    if ((trend.verdict === 'robust' || trend.verdict === 'probable') && trend.display.exceedsRelevance === false) trend.warnings.push(warning('below-relevance'))
  }
}

/** Builds AssessOptions from a variable profile. */
export function optionsFromProfile(profile: ProcessingProfile, policy: TrendPolicy, unit: string, referenceMean: number | null): AssessOptions {
  return { policy, method: profile.primaryMethod, scale: profile.trendScale, displayUnit: profile.displayUnit, referenceMean, relevanceThreshold: profile.relevanceThreshold, minBlockLength: profile.minBlockLength, unit }
}
