'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ArrowUpRight, Globe, Info, MapPin, Navigation, Pause, Play, RotateCcw, Sparkles } from 'lucide-react'
import { EarthGlobe } from '@/components/earth-globe'
import { LocationSelector, type Region } from '@/components/location-selector'
import { VariableSelector, type Variable } from '@/components/variable-selector'
import { PeriodPicker } from '@/components/period-picker'
import { TrendChart } from '@/components/trend-chart'
import { AreaMap } from '@/components/area-map'
import { EvidencePanel } from '@/components/evidence-panel'
import { DataSourceBadge } from '@/components/data-source-badge'
import type { ClimateAnalysis } from '@/lib/nasa/types'

const fetcher = async (url: string): Promise<ClimateAnalysis> => {
  const response = await fetch(url)
  const body = await response.json() as ClimateAnalysis & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Unable to retrieve climate observations.')
  return body
}

export function AppShell() {
  const [region, setRegion] = useState<Region>({ name: 'Puebla, Mexico', lat: 19.04, lon: -98.20, country: 'MEX', state: 'Puebla' })
  const [variable, setVariable] = useState<Variable>('temperature')
  const [startYear, setStartYear] = useState(2001)
  const [endYear, setEndYear] = useState(2024)
  const [analysisRequested, setAnalysisRequested] = useState(false)
  const [paused, setPaused] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  // Respect reduced-motion: start with the globe still.
  useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true) }, [])
  const params = new URLSearchParams({ latitude: String(region.lat), longitude: String(region.lon), startYear: String(startYear), endYear: String(endYear), variable })
  const { data: analysis, error, isLoading, mutate } = useSWR<ClimateAnalysis, Error>(analysisRequested ? `/api/series?${params.toString()}` : null, fetcher, { revalidateOnFocus: false })

  function analyze() {
    setAnalysisRequested(true)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="EarthScope home">
          <span className="brand-mark"><Globe size={24} /></span>
          <span className="brand-stack"><span className="brand-name">earthscope</span><span className="brand-kicker">SPACE APPS CONTEXT</span></span>
          <span className="brand-divider" />
          <span className="brand-subtitle">CLIMATE SIGNALS, IN CONTEXT</span>
        </a>
        <div className="topbar-right">
          <span className="project-tag"><span className="tiny-dot" /> INDEPENDENT RESEARCH PROJECT</span>
        </div>
      </header>

      <div className="disclaimer"><Info size={16} /><span>Independent NASA Space Apps Challenge project. <strong>Not an official NASA product.</strong></span></div>

      <section className="workspace" id="main" aria-label="Climate signal analysis workspace">
        <aside className="filters-panel panel">
          <div className="section-eyebrow"><Navigation size={16} /> ANALYSIS SETUP</div>
          <h1>Find a signal.<br /><span>Understand its story.</span></h1>
          <p className="intro-copy">Explore historical climate observations for a place you care about.</p>

          <LocationSelector value={region} onChange={(next) => { setRegion(next); setAnalysisRequested(false) }} />
          <VariableSelector value={variable} onChange={(next) => { setVariable(next); setAnalysisRequested(false) }} />
          <PeriodPicker startYear={startYear} endYear={endYear} onStartChange={(year) => { setStartYear(year); setAnalysisRequested(false) }} onEndChange={(year) => { setEndYear(year); setAnalysisRequested(false) }} />

          <div className="setup-actions">
            <button className="analyze-button" type="button" onClick={analyze} disabled={isLoading}><Sparkles size={16} /> {isLoading ? 'Requesting…' : 'Analyze region'} <span>→</span></button>
            <div className="setup-note"><Info size={16} /><span>Analyze requests the selected monthly series from NASA POWER. Results are descriptive, not forecasts.</span></div>
            <div className="panel-footnote"><span className="step-number">01</span><span>SELECT LOCATION &amp; CLIMATE VARIABLE</span></div>
          </div>
        </aside>

        <section className="center-column" aria-label="Interactive Earth and historical trend">
          <div className="globe-panel panel">
            <div className="globe-head"><div><span className="section-eyebrow"><span className="live-ring" /> GLOBAL VIEW</span><h2>One planet. <span>Countless signals.</span></h2></div><div className="globe-controls" aria-label="Globe controls"><button className="icon-button" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume globe rotation' : 'Pause globe rotation'} title={paused ? 'Resume rotation' : 'Pause rotation'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button><button className="icon-button" type="button" onClick={() => setResetSignal((n) => n + 1)} aria-label="Reset globe view" title="Reset view"><RotateCcw size={16} /></button></div></div>
            <div className="globe-stage"><EarthGlobe region={region} paused={paused} resetSignal={resetSignal} onSelect={(next) => { setRegion(next); setAnalysisRequested(false) }} /></div>
            <div className="globe-caption"><span><Globe size={16} /> DRAG TO ROTATE • SCROLL TO ZOOM • CLICK A COUNTRY, THEN A STATE</span><span className="globe-location"><MapPin size={16} /> {region.name}</span></div>
            <div className="globe-legend"><span className="legend-item"><span className="legend-point" /> SELECTED LOCATION</span><span className="legend-divider" /><span className="legend-note">No data overlays are shown until observations are verified.</span></div>
          </div>
          <TrendChart variable={variable} startYear={startYear} endYear={endYear} analysisRequested={analysisRequested} analysis={analysis} error={error} isLoading={isLoading} onRetry={() => mutate()} />
          <AreaMap region={region} onSelect={(next) => { setRegion(next); setAnalysisRequested(false) }} />
        </section>

        <EvidencePanel region={region} variable={variable} startYear={startYear} endYear={endYear} analysisRequested={analysisRequested} analysis={analysis} error={error} isLoading={isLoading} />
      </section>

      <footer className="app-footer"><DataSourceBadge /><span className="footer-center">Scientific evidence before visual certainty. • Earth imagery: NASA Blue Marble • Boundaries: Natural Earth</span><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER project <ArrowUpRight size={16} /></a></footer>
    </main>
  )
}
