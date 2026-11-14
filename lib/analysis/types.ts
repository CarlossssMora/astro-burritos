import type { AnnualObservation, NasaObservation, TrendResult } from '@/lib/nasa/types'

export type { AnnualObservation, TrendResult }
export type TrendAnalyzer = (observations: NasaObservation[]) => TrendResult
