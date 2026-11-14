'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import { Map as MapIcon, MapPin } from 'lucide-react'
import type { Region } from '@/components/location-selector'
import { ZoomControl } from '@/components/zoom-control'
import { fitProjection, niceKm, useCountries, useStates, type CountryFeature, type StateFeature } from '@/lib/geo'

const WIDTH = 600
const HEIGHT = 320
const MAP_ZOOM = { min: 0.25, max: 8 }

const hemisphere = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`
const round = (value: number) => Number(value.toFixed(2))

export function AreaMap({ region, onSelect }: { region: Region; onSelect: (region: Region) => void }) {
  const [zoom, setZoom] = useState(1)
  const countries = useCountries().data?.features
  const states = useStates(region.country).data?.features
  const country = countries?.find((feature) => feature.properties.ADM0_A3 === region.country)
  const state = region.state ? states?.find((feature) => feature.properties.name === region.state) : undefined
  const target = region.state ? state : country
  const title = state?.properties.name ?? country?.properties.NAME

  // Paths depend only on the fitted projection; zoom is a viewBox change, so it never rebuilds them.
  const map = useMemo(() => {
    if (!target) return null
    const projection = fitProjection(target.geometry, WIDTH, HEIGHT, 24)
    return {
      projection,
      shape: projection.path(target.geometry),
      // Other countries give context when zoomed out. A selected state shows its sibling states;
      // a whole country shows its states as inner lines. Every one of them is clickable.
      neighbors: (countries ?? []).filter((feature) => feature.properties.ADM0_A3 !== region.country).map((feature) => ({ feature, d: projection.path(feature.geometry) })),
      subdivisions: (states ?? []).filter((feature) => feature !== target).map((feature) => ({ feature, d: projection.path(feature.geometry) })),
    }
  }, [target, states, countries, region.country])

  const coords = `${hemisphere(region.lat, 'N', 'S')} • ${hemisphere(region.lon, 'E', 'W')}`

  if (!map) return <section className="area-panel panel" aria-labelledby="area-title">
    <div className="chart-header"><div><span className="section-eyebrow"><MapIcon size={16} /> SELECTED AREA</span><h2 id="area-title">No area selected</h2></div></div>
    <div className="chart-empty" role="status">
      <div className="chart-empty-icon"><MapIcon size={16} /></div>
      <strong>{region.country ? 'Loading boundaries…' : 'No country at this point'}</strong>
      <p>{region.country ? 'Natural Earth outlines load from this site, not an external service.' : 'Select a country or state on the globe or in the list to see its outline.'}</p>
    </div>
  </section>

  const point = map.projection.project(region.lon, region.lat)
  // Zooming out stays centered on the area; zooming in drifts toward the analysis point (fully at high zoom).
  const pull = Math.max(0, 1 - 1 / zoom)
  const centerX = WIDTH / 2 + (point[0] - WIDTH / 2) * pull
  const centerY = HEIGHT / 2 + (point[1] - HEIGHT / 2) * pull
  const viewBox = `${centerX - WIDTH / (2 * zoom)} ${centerY - HEIGHT / (2 * zoom)} ${WIDTH / zoom} ${HEIGHT / zoom}`
  const kmPerPixel = map.projection.kmPerPixel / zoom
  const km = niceKm((WIDTH / 4) * kmPerPixel)
  const countryName = (code: string) => countries?.find((feature) => feature.properties.ADM0_A3 === code)?.properties.NAME ?? code

  // The clicked spot becomes the analysis point, the same rule as a click on the globe.
  function select(event: MouseEvent<SVGPathElement>, area: CountryFeature | StateFeature) {
    const svg = event.currentTarget.ownerSVGElement
    const matrix = svg?.getScreenCTM()?.inverse()
    if (!matrix) return
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix)
    const [lon, lat] = map!.projection.invert(x, y)
    const spot = { lat: round(lat), lon: round(lon) }
    if ('adm0_a3' in area.properties) onSelect({ name: `${area.properties.name}, ${countryName(area.properties.adm0_a3)}`, ...spot, country: area.properties.adm0_a3, state: area.properties.name })
    else onSelect({ name: area.properties.NAME, ...spot, country: area.properties.ADM0_A3 })
  }

  const subdivisionPaths = map.subdivisions.map(({ feature, d }, index) => <path key={`${feature.properties.name}-${index}`} className={`${region.state ? 'area-context' : 'area-inner'} area-pick`} d={d} onClick={(event) => select(event, feature)}><title>{feature.properties.name}</title></path>)

  return <section className="area-panel panel" aria-labelledby="area-title">
    <div className="chart-header"><div><span className="section-eyebrow"><MapIcon size={16} /> SELECTED AREA</span><h2 id="area-title">{title} {state && country && <span className="range-label">{country.properties.NAME}</span>}</h2></div></div>
    <div className="area-map">
      {/* Pointer shortcut only: the Country → State selects are the keyboard path to the same choices. */}
      <svg className="area-svg" viewBox={viewBox} role="group" aria-label={`Map of ${region.name} with the analysis point at ${coords}. Click a state or country to select it.`}>
        {map.neighbors.map(({ feature, d }) => <path key={feature.properties.ADM0_A3} className="area-neighbor area-pick" d={d} onClick={(event) => select(event, feature)}><title>{feature.properties.NAME}</title></path>)}
        {region.state && subdivisionPaths}
        {target && <path className="area-shape area-pick" d={map.shape} onClick={(event) => select(event, target)}><title>{title}</title></path>}
        {!region.state && subdivisionPaths}
        <circle className="area-point" cx={point[0]} cy={point[1]} r={6 / zoom} />
      </svg>
      <div className="area-scale" style={{ width: `${(km / kmPerPixel / WIDTH) * 100}%` }}><span>{km < 1 ? km.toFixed(1) : km.toLocaleString('en-US')} km</span></div>
      <ZoomControl value={zoom} min={MAP_ZOOM.min} max={MAP_ZOOM.max} label="Map zoom" onChange={(next) => setZoom(next)} />
    </div>
    <div className="globe-caption"><span className="legend-item"><span className="legend-point" /> ANALYSIS POINT</span><span className="globe-location"><MapPin size={16} /> {coords}</span></div>
    <p className="field-hint">Click a state or country to select it; the clicked spot becomes the analysis point. NASA POWER analyzes that point, not an area average. Boundaries: Natural Earth (public domain).</p>
  </section>
}
