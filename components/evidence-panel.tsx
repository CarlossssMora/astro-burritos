import { AlertTriangle, BadgeCheck, ChartNoAxesColumn, CircleDot, Database, FileText, Info } from 'lucide-react'
import type { Region } from '@/components/location-selector'
import type { Variable } from '@/components/variable-selector'
import type { ClimateAnalysis } from '@/lib/nasa/types'

function formatMetric(value: number | null, digits = 3) {
  return value === null || !Number.isFinite(value) ? 'not estimable' : value.toFixed(digits)
}

// Full-width record at the end of the page: source, scope, statistics and caveats side by side.
export function EvidencePanel({ region, variable, startYear, endYear, analysisRequested, analysis, error, isLoading }: { region: Region; variable: Variable; startYear: number; endYear: number; analysisRequested: boolean; analysis?: ClimateAnalysis; error?: Error; isLoading: boolean }) {
  const trend = analysis?.trend
  const parameter = analysis?.parameter ?? (variable === 'temperature' ? 'T2M' : 'PRECTOTCORR')
  const unit = analysis?.annual[0]?.unit ?? (variable === 'temperature' ? '°C' : 'mm/year')
  const status = isLoading ? 'REQUESTING NASA POWER DATA' : error ? 'NASA POWER REQUEST FAILED' : analysis && !analysis.observations.length ? 'NO OBSERVATIONS RETURNED' : analysis ? 'VERIFIED OBSERVATIONS LOADED' : 'READY FOR ANALYSIS'

  return <section className="evidence-panel panel" aria-labelledby="evidence-title">
    <header className="section-eyebrow panel-header"><FileText size={16} /> RESEARCH RECORD</header>
    <div className="evidence-header"><h2 id="evidence-title">Evidence file</h2><span className="record-id">ES—0001</span></div>
    <div className="evidence-status"><span className="status-indicator" /> {status}</div>
    <p className="evidence-intro">A transparent record of the source, methods, and limits behind every climate signal.</p>
    <div className="evidence-grid">
      <div className="evidence-section"><h3><Database size={16} /> DATA SOURCE</h3><div className="evidence-value">NASA POWER • {parameter}</div><p className="evidence-muted">Monthly {parameter === 'T2M' ? 'air temperature' : 'corrected precipitation'} values • annual aggregation</p><a className="source-link" href={analysis?.sourceUrl ?? 'https://power.larc.nasa.gov/'} target="_blank" rel="noreferrer">NASA POWER source request <span>↗</span></a>{analysis && <><p className="evidence-muted">Retrieved {new Date(analysis.retrievedAt).toLocaleString()}</p><p className="evidence-muted">{analysis.sourceModel ?? 'Source model not reported'}{analysis.productVersion ? ` • API ${analysis.productVersion}` : ''} • {analysis.timeStandard ?? 'time standard not reported'}</p></>}</div>
      <div className="evidence-section"><h3><CircleDot size={16} /> SPATIAL &amp; TEMPORAL SCOPE</h3><div className="scope-location">{region.country ? `Point in ${region.name}` : region.name}</div><div className="scope-coords">{region.lat.toFixed(2)}°, {region.lon.toFixed(2)}°</div><div className="scope-period"><span>{analysis?.period.startYear ?? startYear}—{analysis?.period.endYear ?? endYear}</span><span>{variable === 'temperature' ? 'Temperature • °C annual mean' : 'Precipitation • mm/year total'}</span></div>{analysis && <p className="evidence-muted">Returned coverage: {analysis.coverage.start ?? '—'} to {analysis.coverage.end ?? '—'} • {analysis.missingCount} expected monthly values unavailable</p>}</div>
      <div className="evidence-section metrics-section"><h3><ChartNoAxesColumn size={16} /> STATISTICAL SUMMARY</h3><div className="metric-row"><span>OLS trend slope</span><strong>{formatMetric(trend?.slopePerYear ?? null)} {unit}/yr</strong></div><div className="metric-row"><span>Sen slope</span><strong>{formatMetric(trend?.senSlopePerYear ?? null)} {unit}/yr</strong></div><div className="metric-row"><span>95% confidence interval</span><strong>{trend?.confidenceInterval95 ? `${formatMetric(trend.confidenceInterval95[0])} to ${formatMetric(trend.confidenceInterval95[1])}` : 'not estimable'}</strong></div><div className="metric-row"><span>OLS p-value</span><strong>{formatMetric(trend?.pValue ?? null)}</strong></div><div className="metric-row"><span>Mann–Kendall p-value</span><strong>{formatMetric(trend?.mannKendall?.pValue ?? null)}</strong></div><div className="metric-row"><span>Years in trend</span><strong>{trend?.nYears ?? '—'}</strong></div><div className="metric-row"><span>Minimum month coverage</span><strong>{trend?.completeness === null || trend?.completeness === undefined ? '—' : `${(trend.completeness * 100).toFixed(1)}%`}</strong></div><div className="metrics-note"><Info size={16} /><span>{trend ? `${trend.method}. ${trend.significantAt05 === null ? 'OLS significance was not estimable.' : trend.significantAt05 ? 'OLS p < 0.05 under this model.' : 'OLS p ≥ 0.05 under this model; this does not prove no change.'} ${trend.mannKendall?.significantAt05 === null ? 'Mann–Kendall significance was not estimable.' : trend.mannKendall?.significantAt05 ? 'Mann–Kendall also indicates a monotonic signal.' : 'Mann–Kendall does not indicate a monotonic signal at 0.05.'}` : 'No values reported before source data and method validation.'}</span></div></div>
      <div className="evidence-section evidence-notes">
        {trend?.warnings.length ? <div className="caveat-card"><AlertTriangle size={16} /><div><strong>Analysis warnings</strong><p>{trend.warnings.join(' ')}</p></div></div> : <div className="caveat-card"><AlertTriangle size={16} /><div><strong>Interpret with care</strong><p>Local climate patterns are complex. A trend is not attribution, and incomplete data must not be treated as evidence.</p></div></div>}
        <div className="nature-note"><BadgeCheck size={16} /><span>Observation &amp; trend status: <strong>{analysisRequested && !analysis && !error ? 'loading' : analysis ? 'descriptive, source-linked' : 'not yet requested'}</strong></span></div>
      </div>
    </div>
  </section>
}
