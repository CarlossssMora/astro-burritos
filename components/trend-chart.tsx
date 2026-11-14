'use client'

import { ChartNoAxesColumn, Download, LoaderCircle, TrendingUp } from 'lucide-react'
import { PanelHeader } from '@/components/panel-header'
import type { Variable } from '@/components/variable-selector'
import type { ClimateAnalysis } from '@/lib/nasa/types'

// Signed change with a real minus sign; precision shrinks as magnitude grows (°C in hundredths, mm in units).
function formatChange(delta: number) {
  const size = Math.abs(delta)
  const text = size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)
  return `${Number(text) === 0 ? '±' : delta > 0 ? '+' : '−'}${text}`
}
// Green up, red down, neutral when the rounded change is zero.
const tone = (delta: number) => Number(formatChange(delta).slice(1)) === 0 ? '' : delta > 0 ? 'is-up' : 'is-down'

export function TrendChart({ variable, startYear, endYear, analysisRequested, analysis, error, isLoading, onRetry }: { variable: Variable; startYear: number; endYear: number; analysisRequested: boolean; analysis?: ClimateAnalysis; error?: Error; isLoading: boolean; onRetry: () => void }) {
  const points = analysis?.annual.map((point) => ({ year: point.year, value: point.value, count: point.validObservationCount, completeness: point.completeness })) ?? []
  const maxValue = Math.max(...points.map((point) => point.value), 1)
  const minValue = Math.min(...points.map((point) => point.value), 0)
  const spread = maxValue - minValue || 1
  const label = variable === 'temperature' ? 'Temperature' : 'Precipitation'
  const aggregate = variable === 'temperature' ? 'mean' : 'total'
  const unit = analysis?.annual[0]?.unit ?? (variable === 'temperature' ? '°C' : 'mm/year')
  const xForIndex = (index: number) => points.length < 2 ? 50 : 14 + (index / (points.length - 1)) * 72
  const yForValue = (value: number) => 85 - ((value - minValue) / spread) * 66
  const chartPoints = points.map((point, index) => `${xForIndex(index)},${yForValue(point.value)}`).join(' ')
  const trendPoints = analysis?.trend.slopePerYear !== null && analysis?.trend.slopePerYear !== undefined && analysis.trend.intercept !== null && analysis.trend.intercept !== undefined && points.length > 1
    ? `${xForIndex(0)},${yForValue(analysis.trend.intercept + analysis.trend.slopePerYear * points[0].year)} ${xForIndex(points.length - 1)},${yForValue(analysis.trend.intercept + analysis.trend.slopePerYear * (points.at(-1)?.year ?? 0))}`
    : null

  // Endpoint comparison: last year of the period minus the first. Flagged when either end is an incomplete year.
  const first = points[0]
  const last = points.at(-1)
  const extremes = first && last && points.length > 1 ? { delta: last.value - first.value, incomplete: first.completeness < 0.9 || last.completeness < 0.9 } : null
  // Year-over-year: each year against the previous returned year (a gap is labelled, never filled).
  const changes = points.slice(1).map((point, index) => ({ ...point, delta: point.value - points[index].value, previousYear: points[index].year }))
  const showResults = !isLoading && !error && points.length > 0

  function exportCsv() {
    if (!analysis) return
    const csv = ['date,value,unit', ...analysis.observations.map((item) => `${item.date},${item.value},${item.unit}`)].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `earthscope-${variable}-${startYear}-${endYear}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <section className="chart-panel panel" aria-labelledby="trend-title">
    <PanelHeader badge="Result" title="Historical observations" icon={TrendingUp} />
    <div className="chart-header">
      <h2 id="trend-title">{label} by year <span className="range-label">{startYear} — {endYear}</span></h2>
      <div className="chart-actions">
        {showResults && extremes && last && first && <span className={`change-chip ${tone(extremes.delta)}`} title={`Annual ${aggregate} in ${last.year} minus ${first.year}. Two single years can differ by chance; the long-term rate is the trend in the Evidence file.${extremes.incomplete ? ' * One end has less than 90% monthly coverage.' : ''}`}>
          <strong>{formatChange(extremes.delta)} {unit}{extremes.incomplete ? '*' : ''}</strong><small>{last.year} vs {first.year}</small>
        </span>}
        <button className="export-button" type="button" disabled={!analysis?.observations.length} onClick={exportCsv} aria-label="Export NASA POWER observations as CSV"><Download size={16} /> Export CSV</button>
      </div>
    </div>
    <div className="chart-empty" role="status" aria-live="polite">
      {isLoading ? <><LoaderCircle className="loading-icon" size={24} /><strong>Requesting observations from NASA POWER…</strong><p>Monthly data coverage depends on location and parameter.</p></> : error ? <><div className="chart-empty-icon">!</div><strong>NASA POWER request failed</strong><p>{error.message}</p><button className="export-button retry-button" type="button" onClick={onRetry}>Retry request</button></> : points.length ? <div className="chart-results">
        <div className="chart-result-meta"><span>{analysis?.source} • {analysis?.parameter}</span><span>Annual {aggregate} • {unit}</span></div>
        <svg className="trend-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label} annual ${aggregate} for ${points.length} years from NASA POWER`}>
          <line x1="10" y1="85" x2="90" y2="85" className="chart-grid-line" /><line x1="10" y1="19" x2="90" y2="19" className="chart-grid-line" />
          <polyline points={chartPoints} fill="none" className="chart-line" strokeLinecap="round" strokeLinejoin="round" />
          {trendPoints && <polyline points={trendPoints} fill="none" className="trend-line" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((point, index) => <circle key={point.year} cx={xForIndex(index)} cy={yForValue(point.value)} r="1.15" className="chart-dot"><title>{point.year}: {point.value.toFixed(2)} {unit} ({point.count} monthly observations; {(point.completeness * 100).toFixed(1)}% coverage)</title></circle>)}
        </svg>
        <div className="chart-axis"><span>{points[0]?.year}</span><span>{analysis?.coverage.start ?? '—'} to {analysis?.coverage.end ?? '—'}</span><span>{points.at(-1)?.year}</span></div>
        <p className="chart-disclaimer">Annual summaries are derived from returned monthly values. Precipitation uses actual calendar days; the trend uses years with at least 90% monthly coverage and does not establish causation.</p>
      </div> : <>
        <div className="chart-empty-icon"><ChartNoAxesColumn size={16} /></div><strong>{analysisRequested ? 'No observations returned for this period' : 'Historical observations will appear here'}</strong><p>{analysisRequested ? 'NASA POWER returned no usable monthly values for the selected parameter and range.' : 'Choose a location and variable, then analyze to request NASA POWER monthly observations. No measurements or statistics are fabricated.'}</p><div className="chart-axis"><span>{startYear}</span><span>{Math.round((startYear + endYear) / 2)}</span><span>{endYear}</span></div>
      </>}
    </div>
    {showResults && changes.length > 0 && <details className="yoy">
      <summary><span className="yoy-show">Show year-by-year change</span><span className="yoy-hide">Hide year-by-year change</span></summary>
      <ol className="yoy-grid" aria-label={`Change in annual ${aggregate} from the previous year`}>
        {changes.map((change) => <li key={change.year}>
          <span className="yoy-year">{change.year}{change.year - change.previousYear > 1 ? ` vs ${change.previousYear}` : ''}</span>
          <span className={`yoy-delta ${tone(change.delta)}`}>{formatChange(change.delta)} {unit}</span>
          <span className="yoy-value">{change.value.toFixed(variable === 'temperature' ? 2 : 0)} {unit}{change.completeness < 0.9 ? ' • <90% months' : ''}</span>
        </li>)}
      </ol>
      <p className="chart-disclaimer">Each value is the change in annual {aggregate} from the previous year. Year-to-year swings are mostly natural variability; the long-term rate is the trend in the Evidence file.</p>
    </details>}
  </section>
}
