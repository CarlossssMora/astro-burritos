export type NasaParameter = 'T2M' | 'PRECTOTCORR'
export type NasaPowerRequest = { parameter: NasaParameter; latitude: number; longitude: number; startYear: number; endYear: number }
export type NasaObservation = { date: string; year: number; month: number; value: number; unit: string; daysInMonth: number }
export type NasaPowerResult = {
  parameter: NasaParameter
  unit: string
  observations: NasaObservation[]
  source: 'NASA POWER'
  sourceUrl: string
  retrievedAt: string
  productVersion: string | null
  sourceModel: string | null
  timeStandard: 'LST' | 'UTC' | null
  fillValue: number
  temporalResolution: 'monthly'
  period: { startYear: number; endYear: number }
  coverage: { start: string | null; end: string | null }
  missingCount: number
  processingNotes: string[]
}

export type AnnualObservation = {
  year: number
  value: number
  unit: string
  validObservationCount: number
  expectedObservationCount: number
  completeness: number
}

export type TrendResult = {
  nYears: number
  slopePerYear: number | null
  senSlopePerYear: number | null
  intercept: number | null
  pValue: number | null
  mannKendall: MannKendallResult | null
  confidenceInterval95: [number, number] | null
  rSquared: number | null
  significantAt05: boolean | null
  method: string
  warnings: string[]
  completeness: number | null
  autocorrelation: AutocorrelationDiagnostics
}

export type AutocorrelationDiagnostics = {
  lag1ResidualCorrelation: number | null
  screeningThreshold: number | null
  flagged: boolean | null
  method: string
  warnings: string[]
}

export type MannKendallResult = {
  tau: number | null
  score: number | null
  pValue: number | null
  significantAt05: boolean | null
  method: string
  warnings: string[]
}

export type ClimateAnalysis = NasaPowerResult & {
  annual: AnnualObservation[]
  trend: TrendResult
}
