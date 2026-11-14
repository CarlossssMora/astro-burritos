'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GlobeMethods } from 'react-globe.gl'
import type { Region } from '@/components/location-selector'

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false, loading: () => <div className="globe-loading" role="status">Preparing interactive Earth…</div> })

// WebGL needs literal colors, not CSS variables: neon-yellow and blue-yonder from the brand theme.
const POINT_COLOR = '#EAFE07'
const ATMOSPHERE_COLOR = '#2E96F5'
// ponytail: fixed cap (the library already clamps to 2); raise it if the globe looks soft on 4K screens.
const MAX_PIXEL_RATIO = 1.5
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

export function EarthGlobe({ region, paused, resetSignal, onSelect }: { region: Region; paused: boolean; resetSignal: number; onSelect: (lat: number, lon: number) => void }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })

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
    if (ready) globeRef.current?.renderer().setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
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
  const handleClick = useCallback(({ lat, lng }: { lat: number; lng: number }) => onSelect(Number(lat.toFixed(2)), Number(lng.toFixed(2))), [onSelect])
  const points = useMemo(() => [{ lat: region.lat, lng: region.lon }], [region.lat, region.lon])

  return <div ref={wrapRef} className="globe-canvas" role="img" aria-label="Interactive Earth globe. Drag to rotate, scroll to zoom, and select a location.">
    {webgl === false
      ? <div className="globe-fallback" role="alert"><div className="fallback-globe"><GlobeFallbackIcon /></div><p>Interactive globe unavailable</p><span>Your browser could not start WebGL. Use the location selector to explore a region.</span><button type="button" onClick={() => setWebgl(hasWebGL())}>Retry globe</button></div>
      : webgl && size.width > 0 && <Globe ref={globeRef} width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)" globeImageUrl="/textures/earth-blue-marble.jpg" bumpImageUrl="/textures/earth-topology.jpg" showAtmosphere atmosphereColor={ATMOSPHERE_COLOR} atmosphereAltitude={0.16} onGlobeReady={handleReady} onGlobeClick={handleClick} pointsData={points} pointAltitude={0.02} pointColor={pointColor} pointRadius={0.4} pointResolution={12} animateIn={false} />}
  </div>
}

function GlobeFallbackIcon() { return <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="57" fill="none" stroke="currentColor" strokeWidth="2"/><ellipse cx="80" cy="80" rx="26" ry="57" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M26 80h108M37 53h86M37 107h86" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
