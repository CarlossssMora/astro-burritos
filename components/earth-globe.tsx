'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GlobeMethods } from 'react-globe.gl'
import type { Region } from '@/components/location-selector'
import { useCountries, useStates, type CountryFeature, type StateFeature } from '@/lib/geo'

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false, loading: () => <div className="globe-loading" role="status">Preparing interactive Earth…</div> })

// WebGL needs literal colors, not CSS variables: neon-yellow, blue-yonder and white from the brand theme.
const POINT_COLOR = '#EAFE07'
const ATMOSPHERE_COLOR = '#2E96F5'
const CAP_COLOR = 'rgba(255, 255, 255, 0.02)'
const HOVER_CAP_COLOR = 'rgba(46, 150, 245, 0.4)'
const SELECTED_CAP_COLOR = 'rgba(234, 254, 7, 0.35)'
const STROKE_COLOR = 'rgba(255, 255, 255, 0.6)'
// Accessors must be functions: a bare string is read as a property name of each feature, not as a color.
const strokeColor = () => STROKE_COLOR
const noSideWalls = () => '' // falsy: flat caps, no extruded sides

type Area = CountryFeature | StateFeature
const isState = (area: Area): area is StateFeature => 'adm0_a3' in area.properties
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// ponytail: fixed cap (the library already clamps to 2); raise it if the globe looks soft on 4K screens.
const MAX_PIXEL_RATIO = 1.5
// ponytail: tuned by eye on the light theme; raise for more relief, lower if land washes out.
const SUN_INTENSITY = 0.5 * Math.PI
const pointColor = () => POINT_COLOR

function hasWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

export function EarthGlobe({ region, paused, resetSignal, onSelect }: { region: Region; paused: boolean; resetSignal: number; onSelect: (region: Region) => void }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hovered, setHovered] = useState<Area | null>(null)
  const countries = useCountries().data?.features
  const states = useStates(region.country).data?.features

  useEffect(() => setWebgl(hasWebGL()), [])

  // Render at the container's size instead of a fixed canvas.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }))
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // Stop the render loop while the globe is off-screen or the tab is hidden.
  // Re-subscribes on `ready`: a new IntersectionObserver fires once immediately, so a globe that
  // starts below the fold (mobile) gets paused even if its visibility never changes afterwards.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !ready) return
    let onScreen = true
    const sync = () => {
      const globe = globeRef.current
      if (!globe) return
      if (onScreen && !document.hidden) globe.resumeAnimation()
      else globe.pauseAnimation()
    }
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
    observer.observe(wrap)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [ready])

  // onGlobeReady can fire before the ref is attached, so ref-based setup runs in effects keyed on `ready`.
  useEffect(() => {
    const globe = globeRef.current
    if (!ready || !globe) return
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    // globe.gl ships a grey ambient plus a sun over the north pole, so the visible face sat at ~60% of the texture.
    // White ambient shows the texture at full strength; the sun rides with the camera (upper left) so relief reads on any side.
    const [ambient, sun] = globe.lights()
    ambient.color.setScalar(1)
    ambient.intensity = Math.PI
    sun.intensity = SUN_INTENSITY
    sun.position.set(-150, 150, 0)
    globe.camera().add(sun)
    globe.scene().add(globe.camera())
  }, [ready])

  useEffect(() => {
    if (!ready || !globeRef.current) return
    const globe = globeRef.current
    globe.controls().autoRotate = !paused
    globe.controls().autoRotateSpeed = 0.32
  }, [paused, ready])

  useEffect(() => {
    if (!ready || !globeRef.current) return
    globeRef.current.pointOfView({ lat: region.lat, lng: region.lon, altitude: 1.7 }, 750)
  }, [region.lat, region.lon, resetSignal, ready])

  const handleReady = useCallback(() => setReady(true), [])
  const handleClick = useCallback(({ lat, lng }: { lat: number; lng: number }) => onSelect({ name: 'Selected coordinates', lat: Number(lat.toFixed(2)), lon: Number(lng.toFixed(2)) }), [onSelect])
  const points = useMemo(() => [{ lat: region.lat, lng: region.lon }], [region.lat, region.lon])

  // Countries everywhere, plus the selected country's states drawn just above them: one click picks a
  // country (and loads its states), the next picks a state. The clicked spot is the analysis point.
  const polygons = useMemo<Area[]>(() => [...(countries ?? []), ...(states ?? [])], [countries, states])
  const countryName = useCallback((code: string) => countries?.find((country) => country.properties.ADM0_A3 === code)?.properties.NAME ?? code, [countries])
  const isSelected = useCallback((area: Area) => isState(area) ? area.properties.adm0_a3 === region.country && area.properties.name === region.state : area.properties.ADM0_A3 === region.country && !region.state, [region.country, region.state])
  const capColor = useCallback((area: object) => area === hovered ? HOVER_CAP_COLOR : isSelected(area as Area) ? SELECTED_CAP_COLOR : CAP_COLOR, [hovered, isSelected])
  const altitude = useCallback((area: object) => (isState(area as Area) ? 0.012 : 0.006) + (area === hovered ? 0.006 : 0), [hovered])
  const label = useCallback((area: object) => {
    const feature = area as Area
    return escapeHtml(isState(feature) ? `${feature.properties.name} • ${countryName(feature.properties.adm0_a3)}` : feature.properties.NAME)
  }, [countryName])
  const handlePolygonClick = useCallback((area: object, _event: MouseEvent, { lat, lng }: { lat: number; lng: number }) => {
    const feature = area as Area
    const point = { lat: Number(lat.toFixed(2)), lon: Number(lng.toFixed(2)) }
    if (isState(feature)) onSelect({ name: `${feature.properties.name}, ${countryName(feature.properties.adm0_a3)}`, ...point, country: feature.properties.adm0_a3, state: feature.properties.name })
    else onSelect({ name: feature.properties.NAME, ...point, country: feature.properties.ADM0_A3 })
  }, [countryName, onSelect])
  const handlePolygonHover = useCallback((area: object | null) => setHovered(area as Area | null), [])

  return <div ref={wrapRef} className="globe-canvas" role="img" aria-label="Interactive Earth globe. Drag to rotate, scroll to zoom, click a country and then a state to select it.">
    {webgl === false
      ? <div className="globe-fallback" role="alert"><div className="fallback-globe"><GlobeFallbackIcon /></div><p>Interactive globe unavailable</p><span>Your browser could not start WebGL. Use the location selector to explore a region.</span><button type="button" onClick={() => setWebgl(hasWebGL())}>Retry globe</button></div>
      : webgl && size.width > 0 && <Globe ref={globeRef} width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)" globeImageUrl="/textures/earth-blue-marble.jpg" bumpImageUrl="/textures/earth-topology.jpg" showAtmosphere atmosphereColor={ATMOSPHERE_COLOR} atmosphereAltitude={0.16} onGlobeReady={handleReady} onGlobeClick={handleClick} polygonsData={polygons} polygonCapColor={capColor} polygonSideColor={noSideWalls} polygonStrokeColor={strokeColor} polygonAltitude={altitude} polygonLabel={label} polygonsTransitionDuration={200} onPolygonClick={handlePolygonClick} onPolygonHover={handlePolygonHover} pointsData={points} pointAltitude={0.02} pointColor={pointColor} pointRadius={0.4} pointResolution={12} animateIn={false} />}
  </div>
}

function GlobeFallbackIcon() { return <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="57" fill="none" stroke="currentColor" strokeWidth="2"/><ellipse cx="80" cy="80" rx="26" ry="57" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M26 80h108M37 53h86M37 107h86" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
