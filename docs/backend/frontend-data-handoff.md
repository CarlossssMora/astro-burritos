# EarthScope backend/data handoff

Fecha del corte: 2026-11-14. Este documento describe únicamente el backend y los datos. No requiere que el agente de frontend replique el procesamiento ni modifica el trabajo de fronteras, país/estado o mapa 2D.

## Estado real del repositorio

En este checkout la rama activa es `Guillermo`, en el commit `80bbc82`, limpia y sin merge en curso. El reporte adjunto menciona un `main` con `6fc03c6` y cinco conflictos `UU`; ese estado no existe en este checkout. El handoff se basa en el código que sí está presente aquí y conserva la regla de que `lat/lon` es un punto de análisis, no un promedio de país o estado.

## Qué existe hoy

La ruta canónica es:

```text
GET /api/series?latitude={lat}&longitude={lon}&startYear={yyyy}&endYear={yyyy}&variable=temperature|precipitation
```

`/api/climate` solo reexporta el mismo handler por compatibilidad.

El servidor:

1. valida latitud, longitud, variable y rango;
2. consulta NASA POWER Monthly Point con `community=AG` y `time-standard=LST`;
3. conserva observaciones mensuales y metadatos de procedencia;
4. excluye el registro anual `YYYY13`, rellenos `-999` y valores no numéricos;
5. calcula agregados anuales;
6. calcula OLS, intervalo de confianza, p-value t, Mann–Kendall base y pendiente de Sen;
7. devuelve advertencias cuando la cobertura o la varianza no permiten una conclusión.

NASA POWER proporciona `T2M` en °C y `PRECTOTCORR` en mm/day. EarthScope convierte la precipitación a mm/year multiplicando cada valor mensual por los días reales del mes. POWER es un producto meteorológico derivado de MERRA-2 y su valor representa una celda de rejilla, no una estación ni una media municipal.

## Contrato de respuesta actual

La respuesta es `ClimateAnalysis` en `lib/nasa/types.ts`:

```ts
type ClimateAnalysis = NasaPowerResult & {
  annual: AnnualObservation[]
  trend: TrendResult
}
```

Campos que el frontend debe consumir sin inferirlos:

```ts
type NasaPowerResult = {
  parameter: 'T2M' | 'PRECTOTCORR'
  unit: '°C' | 'mm/day'
  observations: Array<{
    date: string          // YYYY-MM
    year: number
    month: number
    value: number
    unit: string
    daysInMonth: number
  }>
  source: 'NASA POWER'
  sourceUrl: string
  retrievedAt: string
  productVersion: string | null
  sourceModel: string | null
  timeStandard: 'LST' | 'UTC' | null
  fillValue: number
  temporalResolution: 'monthly'
  period: { startYear: number; endYear: number }
  coverage: { start: string | null; end: string | null }
  missingCount: number
  processingNotes: string[]
}

type AnnualObservation = {
  year: number
  value: number
  unit: '°C' | 'mm/year'
  validObservationCount: number
  expectedObservationCount: 12
  completeness: number
}

type TrendResult = {
  nYears: number
  slopePerYear: number | null
  senSlopePerYear: number | null
  intercept: number | null
  pValue: number | null
  mannKendall: {
    tau: number | null
    score: number | null
    pValue: number | null
    significantAt05: boolean | null
    method: string
    warnings: string[]
  } | null
  confidenceInterval95: [number, number] | null
  rSquared: number | null
  significantAt05: boolean | null
  method: string
  warnings: string[]
  completeness: number | null
  autocorrelation: {
    lag1ResidualCorrelation: number | null
    screeningThreshold: number | null
    flagged: boolean | null
    method: string
    warnings: string[]
  }
}
```

## Cómo debe interpretarse

- `observations` son valores mensuales nativos; no se deben sumar temperaturas ni multiplicar temperaturas por días en frontend.
- `annual` ya contiene la transformación científica: temperatura media ponderada por días y precipitación acumulada.
- `slopePerYear` es la pendiente OLS histórica, no una predicción.
- `senSlopePerYear` es una pendiente robusta descriptiva.
- `pValue` es el p-value clásico del t-test OLS y supone residuos independientes.
- `mannKendall.pValue` es la implementación base con corrección de empates; todavía no es Hamed–Rao ni TFPW.
- `autocorrelation` es ahora un diagnóstico de cribado sobre los residuos OLS; no corrige todavía la inferencia. Si `flagged` es `true`, el resultado no debe presentarse como robusto.
- Si hay autocorrelación, frontend debe mostrar `warnings` y no etiquetar el resultado como “robusto”. El backend incorporará la corrección autocorrelacionada antes de cerrar la auditoría científica.
- Un p-value mayor o igual que 0.05 no demuestra ausencia de cambio.
- Ningún campo actual autoriza causalidad, alerta o pronóstico.

## Procedencia y estados

Para un resultado exitoso, mostrar o dejar accesible:

- `sourceUrl` exacta;
- `retrievedAt`;
- `productVersion`;
- `sourceModel`;
- `timeStandard`;
- `period`;
- `processingNotes`;
- `missingCount` y `completeness`.

Para errores HTTP:

- `400`: parámetros inválidos;
- `502`: NASA POWER no respondió, respondió con error o entregó un payload inválido.

Para una respuesta sin valores utilizables, `observations` y `annual` pueden estar vacíos y `trend` tendrá advertencias; no debe fabricarse una serie DEMO.

## Fuentes y estado de integración

| Fuente | Estado backend | Uso aprobado |
| --- | --- | --- |
| NASA POWER Monthly | Integrada | T2M y PRECTOTCORR por punto |
| GPM IMERG Final mensual `GPM_3IMERGM_07` | Pendiente de adaptador | Segunda serie de precipitación |
| Giovanni | Pendiente como acceso/validación | Explorar y documentar IMERG; el producto subyacente debe quedar identificado |
| AppEEARS / MOD13 | Pendiente de extracción autenticada | NDVI/EVI con QA; no mezclar MODIS y VIIRS |
| NASA GIBS | Pendiente de capa contextual | Visualización fechada; nunca valores numéricos de tendencia |
| GHCN-Daily/NCEI | Pendiente de inventario | Referencia de estaciones solo donde la cobertura lo permita |
| KNMI Climate Explorer | Auditoría futura | Solo con dataset subyacente nombrado; no contar GHCN dos veces |
| SWOT | Fuera del MVP | No responde bien a la pregunta actual de Puebla/Tehuacán |

La ventana común debe calcularse como el mínimo de las coberturas completas de los productos seleccionados. Con el corte actual, el candidato de comparación POWER–IMERG es 2001–2024; no se debe usar 2025 hasta verificar que IMERG Final mensual tenga todos sus meses.

## Contrato futuro multi-fuente

`EarthScopeDataBundle` en `lib/analysis/types.ts` ya define la forma futura:

- `sources[]`: producto, versión, URL, fecha y notas;
- `series[]`: observaciones con valor crudo, valor normalizado, unidad, soporte espacial, QA y procedencia;
- `analyses[]`: tendencia, robustez, anomalías o comparación;
- `qualitySummary`: faltantes, series incompletas y advertencias.

El frontend debe consumir `series[].observations` y `analyses[]` cuando exista el endpoint multi-fuente. No debe unir series por nombre visible, unidad abreviada o color de mapa.

## Utilidades backend disponibles

- `lib/analysis/common-window.ts` calcula la intersección de años completos entre manifiestos y selecciona el tramo continuo más largo. No inventa el año final: requiere que cada adaptador entregue sus años completos.
- `lib/analysis/multiple-testing.ts` aplica Benjamini–Hochberg a una familia declarada y devuelve `qValue`; el endpoint POWER unitario todavía no tiene una familia multi-serie sobre la cual aplicarlo.
- `lib/analysis/robust-trend.ts` calcula la pendiente de Sen, Mann–Kendall base y el diagnóstico de autocorrelación lag-1. La corrección autocorrelacionada permanece como gate científico antes de publicar una clasificación robusta.

## Próximo trabajo backend

1. Crear manifestas de producto, cobertura, DOI, resolución, unidades, QA y checksum.
2. Implementar el adaptador IMERG Final mensual y limitar automáticamente la ventana común.
3. Crear polígonos científicos INEGI/NASADEM en un espacio separado de `public/geo/`; las fronteras simplificadas de Natural Earth no sirven para agregación científica.
4. Implementar agregación de fino a grueso con fracción de píxel y peso `cos(lat)`.
5. Añadir anomalías mensuales, precipitación mayo–octubre y porcentajes respecto a climatología.
6. Añadir diagnóstico de autocorrelación y corrección Hamed–Rao/TFPW o intervalos por block bootstrap.
7. Añadir BH sobre la familia predefinida sitio × variable × fuente; los métodos OLS/MK son sensibilidades del mismo test, no pruebas independientes.
8. Ejecutar eliminación de años completos y del último año; reportar distribución de pendientes, retención de signo y cambio de significancia.
9. Solo después integrar AppEEARS y GHCN-Daily con sus limitaciones de cobertura y QA.

## Verificación actual

- `pnpm test`: 8 pruebas pasan.
- `pnpm exec tsc --noEmit`: pasa.
- `npm run build`: pasa.
- La API POWER fue validada previamente con una consulta real de Puebla.
- IMERG, AppEEARS, GHCN-Daily y GIBS aún no están conectados al endpoint actual; el contrato y el plan los dejan separados para evitar mezclar fuentes sin metadatos.
