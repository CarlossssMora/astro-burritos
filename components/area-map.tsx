'use client'

import { useMemo } from 'react'
import { Map as MapIcon, MapPin } from 'lucide-react'
import type { Region } from '@/components/location-selector'
import { fitProjection, niceKm, useCountries, useStates } from '@/lib/geo'

const WIDTH = 600
const HEIGHT = 320

const hemisphere = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`

export function AreaMap({ region }: { region: Region }) {
  const countries = useCountries().data?.features
  const states = useStates(region.country).data?.features
  const country = countries?.find((feature) => feature.properties.ADM0_A3 === region.country)
  const state = region.state ? states?.find((feature) => feature.properties.name === region.state) : undefined
  const target = region.state ? state : country
  const title = state?.properties.name ?? country?.properties.NAME

  const map = useMemo(() => {
    if (!target) return null
    const { path, project, kmPerPixel } = fitProjection(target.geometry, WIDTH, HEIGHT, 24)
    const km = niceKm((WIDTH / 4) * kmPerPixel)
    // A selected state shows its sibling states as context; a whole country shows its states as inner lines.
    const others = (states ?? []).filter((feature) => feature !== target).map((feature) => path(feature.geometry)).join('')
    return { shape: path(target.geometry), others, point: project(region.lon, region.lat), km, barShare: km / kmPerPixel / WIDTH }
  }, [target, states, region.lat, region.lon])

  const coords = `${hemisphere(region.lat, 'N', 'S')} • ${hemisphere(region.lon, 'E', 'W')}`

  return <section className="area-panel panel" aria-labelledby="area-title">
    <div className="chart-header"><div><span className="section-eyebrow"><MapIcon size={16} /> SELECTED AREA</span><h2 id="area-title">{title ?? 'No area selected'} {state && country && <span className="range-label">{country.properties.NAME}</span>}</h2></div></div>
    {map ? <>
      <div className="area-map">
        <svg className="area-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Outline of ${region.name} with the analysis point at ${coords}`}>
          {region.state ? <><path className="area-context" d={map.others} /><path className="area-shape" d={map.shape} /></> : <><path className="area-shape" d={map.shape} /><path className="area-inner" d={map.others} /></>}
          <circle className="area-point" cx={map.point[0]} cy={map.point[1]} r="6" />
        </svg>
        <div className="area-scale" style={{ width: `${map.barShare * 100}%` }}><span>{map.km < 1 ? map.km.toFixed(1) : map.km.toLocaleString('en-US')} km</span></div>
      </div>
      <div className="globe-caption"><span className="legend-item"><span className="legend-point" /> ANALYSIS POINT</span><span className="globe-location"><MapPin size={16} /> {coords}</span></div>
      <p className="field-hint">NASA POWER analyzes the marked point, not an area average. Boundaries: Natural Earth (public domain).</p>
    </> : <div className="chart-empty" role="status">
      <div className="chart-empty-icon"><MapIcon size={16} /></div>
      <strong>{region.country ? 'Loading boundaries…' : 'No country at this point'}</strong>
      <p>{region.country ? 'Natural Earth outlines load from this site, not an external service.' : 'Select a country or state on the globe or in the list to see its outline.'}</p>
    </div>}
  </section>
}
