'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GlobeMethods } from 'react-globe.gl'
import type { Region } from '@/components/location-selector'

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false, loading: () => <div className="globe-loading" role="status">Preparing interactive Earth…</div> })

// WebGL needs literal colors, not CSS variables: neon-yellow and blue-yonder from the brand theme.
const POINT_COLOR = '#EAFE07'
const ATMOSPHERE_COLOR = '#2E96F5'
const MAX_PIXEL_RATIO = 2
const EARTH_TEXTURE_2K = '/textures/earth-blue-marble.jpg'
const EARTH_TEXTURE_4K = '/textures/earth-blue-marble-4k.jpg'
const pointColor = () => POINT_COLOR
const ringColor = () => (t: number) => `rgba(234, 254, 7, ${Math.max(0, 0.72 * (1 - t))})`

type NavigatorPerformanceHints = Navigator & {
  deviceMemory?: number
  connection?: { effectiveType?: string; saveData?: boolean }
}

type VisualProfile = {
  earthTextureUrl: string
  enhancedEffects: boolean
}

function selectVisualProfile(globeWidth: number): VisualProfile {
  const hints = navigator as NavigatorPerformanceHints
  const connection = hints.connection
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  const displayPixels = Math.max(window.screen.width, window.screen.height) * pixelRatio
  const renderedGlobePixels = globeWidth * pixelRatio
  const memory = hints.deviceMemory ?? (navigator.hardwareConcurrency <= 4 ? 4 : 8)
  const constrainedNetwork = connection?.saveData || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
  const benefitsFrom4K = displayPixels >= 1800 && renderedGlobePixels >= 650

  const use4K = benefitsFrom4K && memory >= 4 && !constrainedNetwork
  return {
    earthTextureUrl: use4K ? EARTH_TEXTURE_4K : EARTH_TEXTURE_2K,
    enhancedEffects: use4K && memory > 4,
  }
}

function hasWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

async function installGlobeEnhancements(globe: GlobeMethods, earthMaterial: THREE.MeshPhongMaterial) {
  const scene = globe.scene()
  const resolvedEarthMaterial = earthMaterial

  const previousMaterial = {
    specularMap: resolvedEarthMaterial.specularMap,
    specular: resolvedEarthMaterial.specular.clone(),
    shininess: resolvedEarthMaterial.shininess,
    bumpScale: resolvedEarthMaterial.bumpScale,
  }
  // Prevent the default material from showing a broad full-sphere highlight while maps load.
  resolvedEarthMaterial.specular.set('#102435')
  resolvedEarthMaterial.shininess = 72
  resolvedEarthMaterial.bumpScale = 2.2
  resolvedEarthMaterial.needsUpdate = true

  const loader = new THREE.TextureLoader()
  let waterTexture: THREE.Texture
  let nightTexture: THREE.Texture
  let cloudTexture: THREE.Texture
  try {
    [waterTexture, nightTexture, cloudTexture] = await Promise.all([
      loader.loadAsync('/textures/earth-water.png'),
      loader.loadAsync('/textures/earth-night.jpg'),
      loader.loadAsync('/textures/earth-clouds-4k.webp'),
    ])
  } catch (error) {
    resolvedEarthMaterial.specularMap = previousMaterial.specularMap
    resolvedEarthMaterial.specular.copy(previousMaterial.specular)
    resolvedEarthMaterial.shininess = previousMaterial.shininess
    resolvedEarthMaterial.bumpScale = previousMaterial.bumpScale
    resolvedEarthMaterial.needsUpdate = true
    throw error
  }
  const anisotropy = Math.min(globe.renderer().capabilities.getMaxAnisotropy(), 8)
  for (const texture of [waterTexture, nightTexture, cloudTexture]) texture.anisotropy = anisotropy
  nightTexture.colorSpace = THREE.SRGBColorSpace
  cloudTexture.colorSpace = THREE.SRGBColorSpace

  resolvedEarthMaterial.specularMap = waterTexture
  resolvedEarthMaterial.specular.set('#18334a')
  resolvedEarthMaterial.shininess = 72
  resolvedEarthMaterial.bumpScale = 2.2
  resolvedEarthMaterial.needsUpdate = true

  const radius = globe.getGlobeRadius()
  const sunDirection = new THREE.Vector3(-140, 80, 120).normalize()
  const nightMaterial = new THREE.ShaderMaterial({
    uniforms: { nightMap: { value: nightTexture }, sunDirection: { value: sunDirection } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vec3 nightColor = texture2D(nightMap, vUv).rgb;
        float darkness = 1.0 - smoothstep(-0.08, 0.2, dot(normalize(vWorldNormal), normalize(sunDirection)));
        float lightMask = smoothstep(0.08, 0.72, max(nightColor.r, max(nightColor.g, nightColor.b)));
        gl_FragColor = vec4(nightColor * 1.45, darkness * lightMask * 0.82);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const nightMesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.004, 96, 96), nightMaterial)
  nightMesh.renderOrder = 2

  const cloudMaterial = new THREE.MeshPhongMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
    alphaTest: 0.04,
  })
  const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 96, 96), cloudMaterial)
  cloudMesh.renderOrder = 3
  scene.add(nightMesh, cloudMesh)

  return {
    cloudMesh,
    dispose() {
      scene.remove(nightMesh, cloudMesh)
      nightMesh.geometry.dispose()
      nightMaterial.dispose()
      cloudMesh.geometry.dispose()
      cloudMaterial.dispose()
      nightTexture.dispose()
      cloudTexture.dispose()
      waterTexture.dispose()
      resolvedEarthMaterial.specularMap = previousMaterial.specularMap
      resolvedEarthMaterial.specular.copy(previousMaterial.specular)
      resolvedEarthMaterial.shininess = previousMaterial.shininess
      resolvedEarthMaterial.bumpScale = previousMaterial.bumpScale
      resolvedEarthMaterial.needsUpdate = true
    },
  }
}

export function EarthGlobe({ region, paused, resetSignal, onSelect }: { region: Region; paused: boolean; resetSignal: number; onSelect: (lat: number, lon: number) => void }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const cloudMeshRef = useRef<THREE.Mesh | null>(null)
  const renderActiveRef = useRef(true)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [visualProfile, setVisualProfile] = useState<VisualProfile | null>(null)
  const earthMaterial = useMemo(() => new THREE.MeshPhongMaterial({ color: 0x000000, specular: new THREE.Color('#102435'), shininess: 72 }), [])

  useEffect(() => setWebgl(hasWebGL()), [])

  // Render at the container's size instead of a fixed canvas.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }))
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // Pick once after the canvas has a real size, avoiding a wasteful 2K-to-4K texture swap.
  useEffect(() => {
    if (size.width > 0 && !visualProfile) setVisualProfile(selectVisualProfile(size.width))
  }, [size.width, visualProfile])

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
      renderActiveRef.current = onScreen && !document.hidden
      if (renderActiveRef.current) globe.resumeAnimation()
      else globe.pauseAnimation()
    }
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
    observer.observe(wrap)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [ready])

  // onGlobeReady can fire before the ref is attached, so ref-based setup runs in effects keyed on `ready`.
  useEffect(() => {
    if (!ready || !globeRef.current) return
    const globe = globeRef.current
    const renderer = globe.renderer()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    renderer.toneMappingExposure = 1.08

    // Shape the stock Three.js lights into a cooler ambient fill and a brighter sun.
    const [ambientLight, sunLight] = globe.lights()
    if (ambientLight) {
      ambientLight.color.set('#6d8fbd')
      ambientLight.intensity = Math.PI * (visualProfile?.enhancedEffects ? 0.34 : 0.72)
    }
    if (sunLight) {
      sunLight.color.set('#fff4dd')
      sunLight.intensity = Math.PI * (visualProfile?.enhancedEffects ? 1.18 : 1.05)
      sunLight.position.set(-140, 80, 120)
    }
  }, [ready, visualProfile?.enhancedEffects])

  useEffect(() => {
    if (!ready || !visualProfile?.enhancedEffects || !globeRef.current) return
    let cancelled = false
    let dispose: (() => void) | undefined
    installGlobeEnhancements(globeRef.current, earthMaterial).then((enhancements) => {
      if (cancelled) return enhancements.dispose()
      cloudMeshRef.current = enhancements.cloudMesh
      dispose = enhancements.dispose
    }).catch((error) => {
      if (!cancelled) console.warn('Optional globe enhancements could not be loaded.', error)
    })
    return () => {
      cancelled = true
      cloudMeshRef.current = null
      dispose?.()
    }
  }, [earthMaterial, ready, visualProfile?.enhancedEffects])

  useEffect(() => {
    if (!visualProfile?.enhancedEffects) return
    let frame = 0
    let previous = performance.now()
    const rotateClouds = (now: number) => {
      const elapsed = Math.min(now - previous, 50)
      previous = now
      if (!paused && renderActiveRef.current && cloudMeshRef.current) cloudMeshRef.current.rotation.y -= elapsed * 0.000006
      frame = requestAnimationFrame(rotateClouds)
    }
    frame = requestAnimationFrame(rotateClouds)
    return () => cancelAnimationFrame(frame)
  }, [paused, visualProfile?.enhancedEffects])

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
      : webgl && size.width > 0 && visualProfile && <Globe ref={globeRef} width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)" globeImageUrl={visualProfile.earthTextureUrl} bumpImageUrl={visualProfile.enhancedEffects ? '/textures/earth-topology.png' : '/textures/earth-topology.jpg'} globeMaterial={earthMaterial} showAtmosphere atmosphereColor={ATMOSPHERE_COLOR} atmosphereAltitude={visualProfile.enhancedEffects ? 0.18 : 0.2} onGlobeReady={handleReady} onGlobeClick={handleClick} pointsData={points} pointAltitude={0.035} pointColor={pointColor} pointRadius={0.3} pointResolution={20} pointsTransitionDuration={550} ringsData={paused ? [] : points} ringAltitude={0.025} ringColor={ringColor} ringMaxRadius={2.5} ringPropagationSpeed={0.75} ringRepeatPeriod={1250} ringResolution={96} animateIn={false} />}
  </div>
}

function GlobeFallbackIcon() { return <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="57" fill="none" stroke="currentColor" strokeWidth="2"/><ellipse cx="80" cy="80" rx="26" ry="57" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M26 80h108M37 53h86M37 107h86" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
