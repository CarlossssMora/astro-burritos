import type { AnnualObservation, NasaObservation, TrendResult } from '@/lib/nasa/types'

export type { AnnualObservation, TrendResult }
export type TrendAnalyzer = (observations: NasaObservation[]) => TrendResult

/**
 * Stable identifiers used by the future multi-source ingestion layer. These
 * types deliberately keep source metadata beside values so the UI cannot
 * accidentally combine products with different semantics.
 */
export type DataSourceId = 'nasa-power' | 'nasa-imerg' | 'nasa-appeears' | 'nasa-gibs' | 'noaa-ghcn-daily' | 'knmi-climate-explorer' | 'nasa-dem' | 'swot' | 'radarsat'
export type TemporalResolution = 'subdaily' | 'daily' | '8-day' | 'monthly' | 'annual' | 'irregular'
export type AccessMethod = 'api' | 'download' | 'giovanni' | 'appeears' | 'gibs-tile' | 'manual'
export type QualityFlag = 'valid' | 'fill-value' | 'non-numeric' | 'duplicate' | 'out-of-range' | 'low-quality' | 'incomplete-period' | 'suspect-outlier'

export type CanonicalLocation = {
  id: string
  label: string
  latitude: number
  longitude: number
  regionId?: string
  support?: {
    type: 'point' | 'grid-cell' | 'polygon' | 'station'
    nominalResolutionKm?: number
    geometryId?: string
  }
}

export type CanonicalObservation = {
  id: string
  sourceId: DataSourceId
  dataset: string
  productVersion: string | null
  variable: string
  location: CanonicalLocation
  period: { start: string; end: string; temporalResolution: TemporalResolution }
  value: {
    raw: number | null
    normalized: number | null
    rawUnit: string | null
    normalizedUnit: string | null
  }
  quality: {
    valid: boolean
    flags: QualityFlag[]
    completeness: number | null
    fillValue: number | null
  }
  provenance: {
    sourceUrl: string
    retrievedAt: string
    accessMethod: AccessMethod
    checksum?: string
  }
}

export type CanonicalSeries = {
  id: string
  sourceId: DataSourceId
  dataset: string
  productVersion: string | null
  variable: string
  displayName: string
  nativeUnit: string
  normalizedUnit: string
  temporalResolution: TemporalResolution
  location: CanonicalLocation
  observations: CanonicalObservation[]
  coverage: { start: string | null; end: string | null; expectedCount: number; validCount: number }
  transformations: string[]
}

export type RegressionProjection = {
  method: 'ols'
  interpretation: 'exploratory-extrapolation'
  trainPeriod: { startYear: number; endYear: number }
  horizon: { startYear: number; endYear: number }
  unit: string
  values: Array<{ year: number; estimate: number; lower95: number | null; upper95: number | null }>
  validation: {
    holdoutYears: number
    mae: number | null
    rmse: number | null
    coverage95: number | null
    warnings: string[]
  }
}

export type AnalysisArtifact = {
  id: string
  seriesId: string
  method: 'ols-trend' | 'mann-kendall' | 'sen-slope' | 'seasonal-anomaly' | 'ols-projection'
  status: 'complete' | 'insufficient-data' | 'blocked-by-quality'
  result: TrendResult | RegressionProjection | null
  assumptions: string[]
  warnings: string[]
  createdAt: string
}

export type EarthScopeDataBundle = {
  schemaVersion: '1.0'
  generatedAt: string
  study: {
    id: string
    objective: string
    researchQuestion: string
    regions: CanonicalLocation[]
    baselinePeriod: { startYear: number; endYear: number }
  }
  sources: Array<{
    id: DataSourceId
    dataset: string
    productVersion: string | null
    sourceUrl: string
    retrievedAt: string
    notes: string[]
  }>
  series: CanonicalSeries[]
  analyses: AnalysisArtifact[]
  qualitySummary: {
    invalidObservationCount: number
    incompleteSeriesCount: number
    unresolvedWarnings: string[]
  }
}
