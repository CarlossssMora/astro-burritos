export type NasaParameter = 'T2M' | 'PRECTOTCORR'
export type NasaPowerRequest = { parameter: NasaParameter; latitude: number; longitude: number; startYear: number; endYear: number }
export type NasaObservation = { date: string; value: number; unit: string }
export type NasaPowerResult = {
  parameter: NasaParameter
  unit: string
  observations: NasaObservation[]
  source: 'NASA POWER'
  sourceUrl: string
  retrievedAt: string
  temporalResolution: 'daily'
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
  intercept: number | null
  pValue: number | null
  confidenceInterval95: [number, number] | null
  rSquared: number | null
  significantAt05: boolean | null
  method: string
  warnings: string[]
  completeness: number | null
}

export type ClimateAnalysis = NasaPowerResult & {
  annual: AnnualObservation[]
  trend: TrendResult
}
