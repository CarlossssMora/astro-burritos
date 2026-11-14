import { NextRequest, NextResponse } from 'next/server'
import { aggregateAnnual, calculateTrend } from '@/lib/analysis/trend'
import { fetchNasaPowerDaily } from '@/lib/nasa/client'

const parameters = {
  temperature: 'T2M',
  precipitation: 'PRECTOTCORR',
} as const

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const latitude = Number(query.get('latitude'))
  const longitude = Number(query.get('longitude'))
  const startYear = Number(query.get('startYear'))
  const endYear = Number(query.get('endYear'))
  const variable = query.get('variable') as keyof typeof parameters

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Latitude or longitude is outside the valid range.' }, { status: 400 })
  }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1981 || endYear > new Date().getUTCFullYear() - 1 || startYear > endYear) {
    return NextResponse.json({ error: 'Choose a valid year range. Daily data coverage varies by parameter and location.' }, { status: 400 })
  }
  if (!(variable in parameters)) return NextResponse.json({ error: 'Unsupported climate variable.' }, { status: 400 })

  try {
    const result = await fetchNasaPowerDaily({
      parameter: parameters[variable],
      latitude,
      longitude,
      startYear,
      endYear,
    })
    const annual = aggregateAnnual(result.observations, result.parameter)
    const trend = calculateTrend(annual)
    return NextResponse.json({ ...result, annual, trend }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'NASA POWER is temporarily unavailable. Please try again later.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
