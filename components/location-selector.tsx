'use client'

import { MapPin } from 'lucide-react'

export type Region = { name: string; lat: number; lon: number }
const regions: Region[] = [
  { name: 'Puebla, Mexico', lat: 19.04, lon: -98.20 },
  { name: 'New York, United States', lat: 40.71, lon: -74.01 },
  { name: 'Nairobi, Kenya', lat: -1.29, lon: 36.82 },
  { name: 'Delhi, India', lat: 28.61, lon: 77.21 },
  { name: 'São Paulo, Brazil', lat: -23.55, lon: -46.63 },
  { name: 'Reykjavík, Iceland', lat: 64.15, lon: -21.94 },
]

export function LocationSelector({ value, onChange }: { value: Region; onChange: (region: Region) => void }) {
  return <div className="field-group"><label className="field-label" htmlFor="region"><MapPin size={16} /> LOCATION</label><div className="select-wrap"><select id="region" value={regions.some((region) => region.lat === value.lat && region.lon === value.lon) ? `${value.lat},${value.lon}` : 'custom'} onChange={(event) => { const selected = regions.find((region) => `${region.lat},${region.lon}` === event.target.value); if (selected) onChange(selected) }}><option value="custom" disabled>Selected coordinates</option>{regions.map((region) => <option key={region.name} value={`${region.lat},${region.lon}`}>{region.name}</option>)}</select><span aria-hidden="true">⌄</span></div><div className="coordinate-row"><span>{value.lat.toFixed(2)}° {value.lat >= 0 ? 'N' : 'S'}</span><span>{Math.abs(value.lon).toFixed(2)}° {value.lon >= 0 ? 'E' : 'W'}</span><span className="coordinate-source">WGS84</span></div></div>
}
