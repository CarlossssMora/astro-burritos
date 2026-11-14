# EarthScope validation protocol

## Scope

This protocol applies to historical trend analysis and to any later exploratory projection. It prevents a good-looking line or agreement between two products from being mistaken for validated prediction.

## Required result for each series

Every series must report:

- source, product/version, native resolution and spatial support;
- start/end dates, valid count and completeness;
- OLS slope, t-test p-value and 95% confidence interval;
- Mann–Kendall statistic/p-value and Sen's slope;
- raw p-values and Benjamini–Hochberg adjusted q-values for the declared hypothesis family;
- warnings for autocorrelation, seasonality, missing periods, outliers and support mismatch.

The t-test and confidence interval describe the OLS slope under its assumptions. Mann–Kendall and Sen's slope provide a non-parametric robustness check. They are not interchangeable with forecast accuracy metrics.

## Windows and hypotheses

Windows are fixed before inspecting results:

- POWER sensitivity: 1981 through the latest complete POWER year.
- Common comparison: 2001 through the latest year present and complete in every selected source.
- Precipitation seasonal check: May through October, in addition to the annual total.

The initial family is site × variable × source × window. The analysis manifest must list the family before calculating p-values so the multiple-testing correction is auditable.

## Missing-data and deletion experiments

The raw archive is never modified. Evaluation creates a derived masked copy with a manifest:

1. remove the last complete year to test a one-step-ahead holdout;
2. remove a contiguous one-year block to test temporal resilience;
3. mask random months at 5%, 10% and 20% while preserving the random seed;
4. rerun cleaning, aggregation, OLS, Mann–Kendall and Sen's slope;
5. compare parameter drift, sign stability, interval width, false significance and forecast errors.

The evaluation set is never used during fitting. If completeness falls below the declared threshold, the model returns `blocked-by-quality` rather than imputing values silently.

## Cross-source comparison

POWER and IMERG precipitation are compared as separate products. Both may include gauge information, so the report uses “partial product comparison,” not “independent truth validation.” Temperature from POWER (`T2M`) is not interchangeable with MODIS land-surface temperature; only harmonized anomalies or trends with an explicit physical caveat may be compared. NDVI requires AppEEARS quality filtering and an urbanization caveat.

The dashboard classification is fixed before results:

- **Agreement:** same trend sign and overlapping 95% intervals.
- **Discrepancy:** opposite signs and both tests pass the pre-declared significance rule.
- **Inconclusive:** every other case, including one significant and one non-significant result.

This classification is descriptive. A formal difference test is required to claim that two slopes differ.

## Projection gate

An exploratory linear projection may be shown only if:

- the model beats persistence and seasonal-climatology baselines on a blocked holdout;
- MAE, RMSE and 95% interval coverage are reported;
- residual diagnostics do not show an unaddressed structural break or severe autocorrelation;
- the historical trend is directionally stable under both windows and the deletion experiments;
- a science reviewer approves wording that says `exploratory extrapolation`, not forecast or prediction certainty.

Rainfall, vegetation and water variables may require different transformations or models. A failed validation is a scientific result and must remain visible.
