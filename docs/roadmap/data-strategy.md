# EarthScope: objective and multi-source data strategy

## Product objective

EarthScope will answer one auditable question:

> **Between 2001 and the latest complete year, which temperature, precipitation and vegetation trends are detectable in NASA and reference products over Puebla and Tehuacán, how large are they, where do products agree or disagree after spatial harmonization, and how robust are they to the time window and missing-data tests?**

This objective is intentionally narrower than “explain climate change.” EarthScope will describe signals detectable in products, compare products with explicitly partial independence, expose uncertainty and provenance, and avoid causal attribution, alerts and unsupported forecasts. A comparison is not proof that either product is the truth.

The first geographic study is Puebla, Mexico, with Tehuacán as a contrasting semi-arid region. “Puebla” and “Tehuacán” will mean declared municipal or study-area geometries, while the POWER result will retain the coarser MERRA-2 grid-cell footprint. A later region can be added only when its geometry, coverage and source comparability are documented.

## Mandatory source plan

The next data milestone must use more than NASA POWER and must include the following source families from the challenge brief:

| Priority | Source | Role in EarthScope | Variable family | Important boundary |
| --- | --- | --- | --- | --- |
| Current | [NASA POWER Monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/) | Baseline point series | T2M, PRECTOTCORR | MERRA-2-derived meteorology; not direct satellite measurement |
| Required 1 | [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg), accessed and explored through [Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/) | Higher-resolution precipitation comparison | Monthly precipitation accumulation/rate | Independence is partial because IMERG Final uses gauge information; select exact product/version, preserve units and never merge into POWER silently |
| Required 2 | [NASA AppEEARS](https://appeears.earthdatacloud.nasa.gov/) | Land-surface time series with quality layers | MODIS/VIIRS vegetation index and/or land-surface temperature | Earthdata authentication and asynchronous extraction may be required; retain QA flags and product version |
| Required 3 | [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) | True visual context and time-aware map layers | Satellite imagery or pre-rendered science layers | GIBS tiles are visualizations; their colors are not numeric observations for trend tests |
| Required 4 | [NOAA Climate Data Online](https://www.ncei.noaa.gov/cdo-web/webservices) | Independent station validation where coverage exists | Station temperature/precipitation | API token, station metadata and inhomogeneity/relocation checks are required |
| Audit | [KNMI Climate Explorer](https://climexp.knmi.nl/) | External sanity check for monthly anomalies/trends | Station, gridded observation and reanalysis references | Audit/reference only until access and licensing are documented |
| Deferred | [SWOT](https://www.asc-csa.gc.ca/eng/satellites/swot/) | Possible later water case study | Water surface elevation, area, slope or discharge-derived products | Removed from the MVP: short/irregular coverage and weak fit for Tehuacán/Puebla water questions |
| Conditional | [RADARSAT/Geo.ca and the SAR tutorial](https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial) | Later land/wetness/change case in suitable Canadian regions | SAR backscatter or derived land/water classes | Geographic scope and licensing must be confirmed before inclusion |

Giovanni, AppEEARS and GIBS are access/analysis/visualization services as well as entry points. The canonical bundle must record the underlying dataset and product, not only the service name. POWER and IMERG are complementary products, not fully independent ground truth: both can incorporate gauge information or related atmospheric constraints.

## Deep processing pipeline

Every source will pass through the same five layers. Raw data is immutable; cleaned and derived data are reproducible artifacts.

1. **Ingest/raw:** save the exact request or download URL, response headers, product/version, retrieval time, source model, native resolution, coordinate reference system, time standard, license/attribution and a checksum. Store the original file or a documented external identifier.
2. **Quality control:** validate schema, coordinates, timestamps, duplicate keys, fill values, non-numeric values, impossible ranges, source-specific QA flags, missing periods, spatial masks and station metadata. Outliers are flagged first, never silently deleted. No missing value becomes zero.
3. **Harmonization:** convert units only with a documented rule; normalize timestamps to an explicit standard; retain native values beside normalized values; define whether an input is a rate, mean, accumulation, index or model/reanalysis estimate; map each pixel/point to a named region and preserve the source grid.
4. **Scientific features:** generate monthly and annual summaries, completeness, anomalies against a fixed baseline, seasonal aggregates and spatial summaries. Use area-weighting for polygons and document pixel inclusion. Do not compare products until period, units, support, spatial scale and meaning are compatible. For POWER, show the native grid-cell footprint instead of implying municipal precision.
5. **Analysis/delivery:** produce trend, uncertainty, cross-source comparison and visualization-ready artifacts. Every number carries a `seriesId`, source, unit, period, quality summary and transformation chain so frontend can render it without reconstructing science.

### Pre-registered statistical safeguards

- Keep OLS as the transparent baseline. Its slope is evaluated with a two-sided t-test and a 95% confidence interval, with the independent-residual assumption shown as a limitation.
- Add Mann–Kendall with Sen's slope as a non-parametric robustness pair. Use autocorrelation-aware/pre-whitened variants or block bootstrap when diagnostics require it.
- Remove the seasonal cycle with a fixed climatology before comparing monthly signals. For precipitation, report both annual totals and May–October wet-season totals.
- Use two windows chosen before inspecting results: 1981–latest complete year for POWER sensitivity and 2001–latest common complete year for MODIS/IMERG comparisons. “Latest complete year” is derived from each source manifest, never hardcoded in the UI.
- Apply Benjamini–Hochberg false-discovery-rate control to the pre-declared family of site × variable × source hypotheses. Report raw p-values and adjusted q-values.
- Use the following dashboard classification, not as a formal test of equality: **agreement** means same slope sign and overlapping 95% intervals; **discrepancy** means opposite signs with both trends significant; everything else is **inconclusive**. Formal source differences require paired anomalies on common support and an uncertainty-aware test.
- Report agreement/disagreement between products; never average products with different physical meanings.

## Frontend-ready data contract

The canonical TypeScript contract lives in `lib/analysis/types.ts` as `EarthScopeDataBundle`. It is designed to be serializable JSON:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "<ISO timestamp>",
  "study": {
    "id": "puebla-tehuacan-2001-present",
    "objective": "<objective>",
    "researchQuestion": "<question>",
    "regions": [],
    "baselinePeriod": { "startYear": 2001, "endYear": "<latest complete common year>" }
  },
  "sources": [],
  "series": [],
  "analyses": [],
  "qualitySummary": {
    "invalidObservationCount": 0,
    "incompleteSeriesCount": 0,
    "unresolvedWarnings": []
  }
}
```

Frontend should consume `series[].observations` and `analyses[]`; it must not infer units, source identity, completeness or statistical meaning from a label. A map view can use `location`, `period`, `sourceId` and a separately validated raster/tile descriptor without treating tile colors as values.

## Linear regression and future values

The current product estimates historical trend only. A future “prediction” view is a separate gate because extrapolating a line is not automatically a forecast. The implementation plan is:

1. Build a cleaned, seasonal-aware series and reserve a temporal holdout before fitting.
2. Fit OLS only as an interpretable baseline, with diagnostics for residual autocorrelation, non-linearity, heteroscedasticity and influential years.
3. Report both confidence intervals for the mean line and prediction intervals for new observations; never show only a single future line.
4. Validate the holdout with MAE, RMSE and interval coverage. If a variable fails, label it `blocked-by-quality` rather than drawing a future curve.
5. Store the result as `RegressionProjection` with `interpretation: exploratory-extrapolation`, not as a climate forecast. Rainfall, vegetation indices, water level and satellite retrievals may require different transformations or models; “one linear regression for every field” is not scientifically defensible.
6. Only after independent review expose the projection as a clearly separated optional layer in the UI.

No future values or projection layer are being fabricated in the current branch.

## Action plan and gates

### Phase A — Data contract and provenance

- Freeze the study question, region polygons and baseline period.
- Implement source adapters around the canonical types.
- Add raw snapshot manifests and checksums.
- Gate: every observation can be traced back to a source request/download and native unit.

### Phase B — Precipitation comparison

- Select and validate one IMERG Final monthly product/version through Giovanni.
- Define Puebla/Tehuacán study polygons and aggregate both products to the same declared support; retain the native POWER cell as a separate context.
- Compare anomalies and trends, not absolute totals alone. Retain two separate series and label their partial dependence.
- Audit units, gauge adjustment, coverage, missingness, spatial support and wet-season behavior.
- Gate: a second person can reproduce the comparison from the manifest.

### Phase C — Land surface and validation

- Select one AppEEARS vegetation or land-surface-temperature product and preserve its QA layer.
- Add NOAA CDO stations near the study regions when station metadata and coverage are adequate.
- Use KNMI Climate Explorer as an external trend/anomaly audit.
- Gate: quality flags, station metadata and cross-source disagreement are visible in the data bundle.

### Phase D — Map context and scope control

- Add only validated GIBS layers with date/product compatibility; keep them visual/contextual.
- Keep SWOT outside the MVP unless a named water feature, repeated observations and a defensible question are approved.
- Evaluate RADARSAT/Geo.ca only for a region and question where SAR is physically relevant.
- Gate: each layer has a product-specific legend, date, resolution and attribution.

### Phase E — Projection review

- Implement the regression artifact and holdout evaluation off-screen first.
- Have the science reviewer approve diagnostics, intervals and wording.
- Gate: no projection is displayed when validation or quality checks fail.

## Validation and model comparison protocol

Trend significance and prediction skill are different questions and will be reported separately.

### 1. Trend evidence

For every pre-declared series, report the OLS slope, t-test p-value, 95% confidence interval, Mann–Kendall p-value, Sen's slope, number of valid periods, completeness and all warnings. A significant trend in one test but not the other is a robustness disagreement, not a forced PASS/FAIL.

### 2. Retrospective prediction tests

No future curve is accepted because it looks plausible. For each variable with enough history:

- use rolling-origin or blocked temporal holdouts;
- fit only on the past and score on the withheld future;
- report MAE, RMSE, bias and 95% interval coverage;
- compare the model against a persistence baseline and a seasonal-climatology baseline;
- run the same evaluation with the last year, one year block and random monthly masks removed;
- retain the deleted values only in a sealed evaluation set and never train on them;
- repeat for both time windows when the source supports them.

t-tests, Mann–Kendall and confidence intervals validate trend evidence and uncertainty; they do not replace out-of-sample forecast metrics.

### 3. Cross-source verification

There is no universal “truth source” for every Earth-system variable. The comparison hierarchy is:

1. harmonize spatial support and time period;
2. compare anomalies and seasonal totals in common units;
3. evaluate bias, correlation, MAE and paired differences;
4. use NOAA station data as an external reference where station metadata and coverage are adequate;
5. use NASA product validation documentation and sensitivity across products as evidence of confidence, not as proof of correctness.

If a product has no adequate reference at the target scale, the result is labeled `not independently validated` rather than assigned a confidence score.
