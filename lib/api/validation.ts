/** Shared request validation for API v2 routes. */
import { DEFAULT_WINDOW } from './v2'
import { getVariable, VARIABLES, type VariableDescriptor, type VariableId } from '../variables/catalog'

export const MIN_YEAR = 1981
export const MAX_RANGE_YEARS = 60

export class RequestError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function latestCompletedYear() {
  return new Date().getUTCFullYear() - 1
}

function integer(value: string | number | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback
  const text = String(value)
  if (!/^\d{4}$/.test(text)) throw new RequestError(`“${text}” is not a valid year.`)
  return Number(text)
}

export function parseWindow(start: string | number | null | undefined, end: string | number | null | undefined) {
  const latest = latestCompletedYear()
  const startYear = integer(start, DEFAULT_WINDOW.startYear)
  const endYear = integer(end, Math.min(DEFAULT_WINDOW.endYear, latest))
  if (startYear < MIN_YEAR || endYear > latest || startYear > endYear || endYear - startYear + 1 > MAX_RANGE_YEARS) {
    throw new RequestError(`Choose a period from ${MIN_YEAR} through ${latest}, with startYear ≤ endYear and at most ${MAX_RANGE_YEARS} years.`)
  }
  return { startYear, endYear }
}

export function parseCoordinates(lat: string | null, lon: string | null) {
  const latitude = Number(lat)
  const longitude = Number(lon)
  if (lat === null || lon === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new RequestError('latitude must be within ±90 and longitude within ±180.')
  }
  return { latitude, longitude }
}

/** Own-key lookup only, so names such as "toString" or "__proto__" are rejected. */
export function parseVariable(id: unknown, need: 'point' | 'region'): VariableDescriptor {
  const variable = typeof id === 'string' ? getVariable(id) : undefined
  if (!variable || !variable.availability[need]) {
    const valid = VARIABLES.filter((v) => v.availability[need]).map((v) => v.id).join(', ')
    throw new RequestError(`Unsupported variable for ${need} requests. Valid values: ${valid}.`)
  }
  return variable
}

export function parseVariableList(value: string | null): VariableId[] {
  const all = VARIABLES.filter((v) => v.availability.point).map((v) => v.id)
  if (!value) return all
  const ids = value.split(',').map((item) => item.trim()).filter(Boolean)
  const unknown = ids.filter((id) => !all.includes(id as VariableId))
  if (unknown.length) throw new RequestError(`Unknown variables: ${unknown.join(', ')}. Valid values: ${all.join(', ')}.`)
  return [...new Set(ids)] as VariableId[]
}

export function parseFormat(value: unknown): 'json' | 'geojson' {
  if (value === undefined || value === null || value === '' || value === 'json') return 'json'
  if (value === 'geojson') return 'geojson'
  throw new RequestError('format must be "json" or "geojson".')
}
