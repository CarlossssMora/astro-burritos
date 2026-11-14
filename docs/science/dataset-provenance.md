# Dataset provenance

## NASA POWER Monthly and Annual API

- Provider: NASA POWER / NASA Langley Research Center.
- Endpoint: `https://power.larc.nasa.gov/api/temporal/monthly/point`.
- Request parameters: one of `T2M` or `PRECTOTCORR`, `community=AG`, a point latitude/longitude, complete start/end years, `format=JSON`, and `time-standard=LST`.
- Source model: the API response identifies the source as `MERRA2` for the current MVP request.
- Product/API version: read from `header.api.version` at runtime and shown in the Evidence File when present.
- Resolution: one point and monthly time steps. `T2M` is displayed in `°C`; `PRECTOTCORR` is received in `mm/day` and converted to `mm/year` only in the annual summary.
- Fill value: read from `header.fill_value`; values matching it and non-numeric values are removed.
- Retrieval time: recorded as `retrievedAt` in every server response.
- License/attribution: users should consult NASA POWER's current terms and attribution guidance before publishing derived products.

## Reproducible request

Replace the coordinates and years as needed:

```text
https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M&community=AG&longitude=-98.2&latitude=19.04&start=2001&end=2024&format=JSON&time-standard=LST
```

The URL shown in the Evidence File is the exact request used for the displayed result. The annual transformation is implemented in `lib/analysis/trend.ts` and is covered by tests in `tests/analysis/trend.test.ts`.
