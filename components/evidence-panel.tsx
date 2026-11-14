import { AlertTriangle, BadgeCheck, ChartNoAxesColumn, CircleDot, Database, FileText, Info } from 'lucide-react'
import type { Region } from '@/components/location-selector'
import type { Variable } from '@/components/variable-selector'
import type { ClimateAnalysis } from '@/lib/nasa/types'

function formatMetric(value: number | null, digits = 3) {
  return value === null || !Number.isFinite(value) ? 'not estimable' : value.toFixed(digits)
}

export function EvidencePanel({ region, variable, startYear, endYear, analysisRequested, analysis, error, isLoading }: { region: Region; variable: Variable; startYear: number; endYear: number; analysisRequested: boolean; analysis?: ClimateAnalysis; error?: Error; isLoading: boolean }) {
  const trend = analysis?.trend
  const parameter = analysis?.parameter ?? (variable === 'temperature' ? 'T2M' : 'PRECTOTCORR')
  const unit = analysis?.annual[0]?.unit ?? (variable === 'temperature' ? '°C' : 'mm/year')
  const status = isLoading ? 'REQUESTING NASA POWER DATA' : error ? 'NASA POWER REQUEST FAILED' : analysis ? 'VERIFIED OBSERVATIONS LOADED' : 'READY FOR ANALYSIS'

  return <aside className="evidence-panel panel" aria-labelledby="evidence-title">
    <div className="evidence-header"><div><span className="section-eyebrow"><FileText size={16} /> RESEARCH RECORD</span><h2 id="evidence-title">Evidence file</h2></div><span className="record-id">ES—0001</span></div>
    <div className="evidence-status"><span className="status-indicator" /> {status}</div>
    <p className="evidence-intro">A transparent record of the source, methods, and limits behind every climate signal.</p>
    <div className="evidence-section"><h3><Database size={16} /> DATA SOURCE</h3><div className="evidence-value">NASA POWER • {parameter}</div><p className="evidence-muted">Daily {parameter === 'T2M' ? 'air temperature' : 'corrected precipitation'} observations • annual aggregation</p><a className="source-link" href={analysis?.sourceUrl ?? 'https://power.larc.nasa.gov/'} target="_blank" rel="noreferrer">NASA POWER source request <span>↗</span></a>{analysis && <p className="evidence-muted">Retrieved {new Date(analysis.retrievedAt).toLocaleString()}</p>}</div>
    <div className="evidence-section"><h3><CircleDot size={16} /> SPATIAL &amp; TEMPORAL SCOPE</h3><div className="scope-location">{region.country ? `Point in ${region.name}` : region.name}</div><div className="scope-coords">{region.lat.toFixed(2)}°, {region.lon.toFixed(2)}°</div><div className="scope-period"><span>{startYear}—{endYear}</span><span>{variable === 'temperature' ? 'Temperature • °C mean' : 'Precipitation • mm/year sum'}</span></div>{analysis && <p className="evidence-muted">Returned coverage: {analysis.coverage.start ?? '—'} to {analysis.coverage.end ?? '—'} • {analysis.missingCount} expected daily values unavailable</p>}</div>
    <div className="evidence-section metrics-section"><h3><ChartNoAxesColumn size={16} /> STATISTICAL SUMMARY</h3><div className="metric-row"><span>Trend slope</span><strong>{formatMetric(trend?.slopePerYear ?? null)} {unit}/yr</strong></div><div className="metric-row"><span>95% confidence interval</span><strong>{trend?.confidenceInterval95 ? `${formatMetric(trend.confidenceInterval95[0])} to ${formatMetric(trend.confidenceInterval95[1])}` : 'not estimable'}</strong></div><div className="metric-row"><span>p-value</span><strong>{formatMetric(trend?.pValue ?? null)}</strong></div><div className="metric-row"><span>Years in trend</span><strong>{trend?.nYears ?? '—'}</strong></div><div className="metric-row"><span>Minimum daily coverage</span><strong>{trend?.completeness === null || trend?.completeness === undefined ? '—' : `${(trend.completeness * 100).toFixed(1)}%`}</strong></div><div className="metrics-note"><Info size={16} /><span>{trend ? `${trend.method}. ${trend.significantAt05 === null ? 'Significance was not estimable.' : trend.significantAt05 ? 'p < 0.05 under this model.' : 'p ≥ 0.05 under this model; this does not prove no change.'}` : 'No values reported before source data and method validation.'}</span></div></div>
    {trend?.warnings.length ? <div className="caveat-card"><AlertTriangle size={16} /><div><strong>Analysis warnings</strong><p>{trend.warnings.join(' ')}</p></div></div> : <div className="caveat-card"><AlertTriangle size={16} /><div><strong>Interpret with care</strong><p>Local climate patterns are complex. A trend is not attribution, and incomplete data must not be treated as evidence.</p></div></div>}
    <div className="nature-note"><BadgeCheck size={16} /><span>Observation &amp; trend status: <strong>{analysisRequested && !analysis && !error ? 'loading' : analysis ? 'descriptive, source-linked' : 'not yet requested'}</strong></span></div>
  </aside>
}
