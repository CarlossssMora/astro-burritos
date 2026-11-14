import { NextRequest, NextResponse } from 'next/server'
import { analyzePoint } from '@/lib/api/point-service'
import { parseCoordinates, parseVariableList, parseWindow, RequestError } from '@/lib/api/validation'
import { PowerError } from '@/lib/nasa/power'

/** GET /api/point?latitude=19.04&longitude=-98.20&startYear=2001&endYear=2024&variables=T2M,TN,TX */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  try {
    const { latitude, longitude } = parseCoordinates(query.get('latitude'), query.get('longitude'))
    const { startYear, endYear } = parseWindow(query.get('startYear'), query.get('endYear'))
    const variables = parseVariableList(query.get('variables'))
    const body = await analyzePoint(latitude, longitude, startYear, endYear, variables)
    return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch (error) {
    if (error instanceof RequestError || error instanceof PowerError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'The point analysis failed unexpectedly.' }, { status: 500 })
  }
}
