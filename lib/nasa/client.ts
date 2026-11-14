import type { NasaObservation, NasaPowerRequest, NasaPowerResult } from '@/lib/nasa/types'

const parameterMetadata = {
  T2M: { unit: '°C', note: 'Annual values are means of valid daily air-temperature values.' },
  PRECTOTCORR: { unit: 'mm/day', note: 'Annual values are sums of valid daily precipitation values.' },
} as const

export async function fetchNasaPowerDaily(request: NasaPowerRequest) {
  const metadata = parameterMetadata[request.parameter as keyof typeof parameterMetadata]
  if (!metadata) throw new Error('Unsupported NASA POWER parameter.')

  const url = new URL('https://power.larc.nasa.gov/api/temporal/daily/point')
  url.search = new URLSearchParams({
    parameters: request.parameter,
    community: 'AG',
    longitude: String(request.longitude),
    latitude: String(request.latitude),
    start: `${request.startYear}0101`,
    end: `${request.endYear}1231`,
    format: 'JSON',
  }).toString()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  let response: Response
  try {
    response = await fetch(url, { next: { revalidate: 86400 }, signal: controller.signal })
  } catch {
    throw new Error('NASA POWER could not be reached. Check the connection and try again.')
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) throw new Error(`NASA POWER returned HTTP ${response.status}. Try a shorter period or another location.`)

  const payload = await response.json()
  const values = payload?.properties?.parameter?.[request.parameter]
  if (!values || typeof values !== 'object') throw new Error('The NASA POWER response did not include the requested parameter.')

  const entries = Object.entries(values as Record<string, unknown>)
  const observations: NasaObservation[] = entries
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value !== -999)
    .map(([date, value]) => ({ date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, value: value as number, unit: metadata.unit }))
  const expectedObservationCount = Array.from({ length: request.endYear - request.startYear + 1 }, (_, index) => request.startYear + index).reduce((sum, year) => sum + (new Date(Date.UTC(year + 1, 0, 0)).getUTCDate() === 29 ? 366 : 365), 0)

  const result: NasaPowerResult = {
    source: 'NASA POWER',
    parameter: request.parameter,
    unit: metadata.unit,
    observations,
    sourceUrl: url.toString(),
    retrievedAt: new Date().toISOString(),
    temporalResolution: 'daily',
    coverage: { start: observations[0]?.date ?? null, end: observations.at(-1)?.date ?? null },
    missingCount: Math.max(0, expectedObservationCount - observations.length),
    processingNotes: [metadata.note, 'NASA POWER fill values (-999) and non-numeric values were excluded.', 'The returned product is used descriptively; it is not treated as direct satellite measurement or causal evidence.'],
  }

  return result
}
