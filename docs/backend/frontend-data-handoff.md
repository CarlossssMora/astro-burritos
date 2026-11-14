# EarthScope · handoff de datos y backend (v2)

Corte: 2026-11-14. Base de código revisada: `origin/Guillermo @741fa44` (backend) y `origin/main @2996ebc` (frontend; revalidado en `477e99a`, que solo cambia el globo, CSS y el lockfile). Este documento sustituye al handoff de `26300d3`/`741fa44` y a la versión 1 de esta auditoría.

**Para el agente de interfaz:** empezar por la sección 2 (dónde está cada archivo) y seguir con 1, 5, 6 y 10: qué significa cada campo, cómo rotularlo y qué no afirmar. **Para el backend:** las secciones 2, 3, 4, 7, 8, 9 y 11 son la referencia de qué está bien, qué falla y en qué orden integrar. La sección 12 lista lo que se corrigió de la versión anterior.

Dashboard interactivo con los mismos datos (privado; pedir acceso al dueño del enlace): https://claude.ai/artifact/455m7zHPzENf2CJSE6e2Sc

## 1. Resumen ejecutivo

- En la ventana común **2001–2024**, **5 de 12** hipótesis primarias son robustas y **todas son de temperatura**: Puebla T2M +0.45 °C/década, Puebla TN +0.52 °C/década, Tehuacán T2M +0.62 °C/década, Tehuacán TX +0.73 °C/década, Tehuacán TN +0.54 °C/década.
- **Ninguna tendencia de precipitación es publicable.** Puebla anual +69 mm/década (q = 0.100), con tendencia mínima detectable de 107 mm/década; el signo cambia según el año de inicio y POWER casi no reproduce la variación interanual de las estaciones (r anual 0.333 y 0.124).
- **Hallazgo crítico de semántica:** `T2M_MAX` y `T2M_MIN` del endpoint mensual de POWER son el **extremo absoluto del mes**, no la media. La “Tmin +0.69 °C/década” de la versión anterior era el promedio de las noches más frías de cada mes. Las medias diarias (TX, TN) se calculan con el endpoint diario.
- El pipeline actual (POWER → agregación anual → OLS/MK/Sen) es **correcto en sus cálculos**: el código del repositorio ejecutado sobre datos reales coincide con una implementación independiente y el agregado anual reproduce el anual `YYYY13` de POWER. Hay un **error latente** (umbral 11/12 meses), dos errores menores activos y varias limitaciones de inferencia.
- Coherencia regional: en 2001–2024 la temperatura media sube en las **24 de 24** celdas MERRA-2 alrededor de Puebla; la lluvia sube en 12 y baja en 12.
- Validación con estaciones (Tlaxcala, 1981–2005): la máxima de POWER reproduce la tendencia de la estación (+0.77 vs +0.68 °C/década); la mínima sube cuatro veces más rápido en la estación (+0.83 vs +0.21).

## 2. Dónde está cada archivo

### 2.1 Documentación y datos de referencia (docs/backend/)

| Ruta | Qué contiene | Uso en la interfaz |
|---|---|---|
| docs/backend/frontend-data-handoff.md | Este documento | Contrato, reglas de presentación y estado del backend |
| docs/backend/data/README.md | Esquema de cada archivo JSON: clave de fila y significado de cada columna | Leer antes de usar cualquier JSON |
| docs/backend/data/catalog.json | Diccionario de las 35 variables: nombre, unidad, agregación, clase de aptitud y definición | Rotular variables y decidir cuáles se pueden presentar como tendencia |
| docs/backend/data/tests.json | 138 pruebas (sitio × variable × ventana) con pendiente, IC, p, q, tendencia mínima detectable y veredicto | Indicadores, matriz de variables y textos de robustez |
| docs/backend/data/annual.json | Series anuales de las 35 variables por celda, 1981–2025 | Gráficas de series y datos de ejemplo |
| docs/backend/data/monthly_trends.json | Tendencia por mes calendario de TN, TX, T2M y lluvia | Vista estacional |
| docs/backend/data/sweep.json | Pendiente según el año de inicio (1981–2009 a 2024) | Vista de sensibilidad a la ventana |
| docs/backend/data/spatial.json | Pendiente y q de campo de las 24 celdas MERRA-2 alrededor de Puebla | Mapa de coherencia regional |
| docs/backend/data/station_stats.json | Comparación POWER–GHCN (correlaciones, sesgos, tendencias) | Panel de validación |
| docs/backend/data/station_pairs.json | Pares mensuales estación–POWER | Dispersión de validación |
| docs/backend/data/climatology.json | Climatología 1991–2020 de cada celda | Contexto estacional |
| docs/backend/data/coverage.json | Cobertura verificada de cada fuente y ventana común | Línea de tiempo de fuentes |
| docs/backend/data/audit.json | Hallazgos del pipeline (sección 4) | Referencia; no se muestra al usuario final |
| docs/backend/data/sources.json | Evaluación de las fuentes externas (sección 9) | Panel de procedencia |
| docs/backend/data/corrections.json | Correcciones respecto a la versión 1 de la auditoría | Referencia |
| docs/backend/analysis/ | Scripts en Python estándar que generan los JSON y este documento | No se usa en la interfaz; implementación de referencia para el backend |
| docs/backend/api-v2.md | Guía de la API v2: endpoints, campos, filtros, reglas de presentación, mapa y errores | Documento principal para consumir los datos procesados |
| docs/backend/samples/ | Respuestas reales de la API v2 (Puebla, Tehuacán, Tlaxcala) | Desarrollar y probar la interfaz sin red |

Los JSON son una instantánea del 2026-11-14 con la forma `{rows, meta}`. Sirven de referencia y de datos de ejemplo; la interfaz en producción debe consumir la API, no estos archivos.

### 2.2 Código que define o consume el contrato

| Ruta | Rama | Para qué |
|---|---|---|
| lib/nasa/types.ts | Guillermo (en main falta autocorrelation) | Tipos NasaPowerResult, AnnualObservation, TrendResult (incluye autocorrelation) y ClimateAnalysis: forma exacta de la respuesta |
| app/api/series/route.ts | Guillermo y main | Endpoint GET /api/series: parámetros, validación y códigos 400/502 |
| app/api/climate/route.ts | Guillermo y main | Alias del mismo endpoint |
| lib/nasa/client.ts | Guillermo y main | Consulta a POWER, filtro de relleno y processingNotes |
| lib/analysis/trend.ts | Guillermo y main | Agregación anual y OLS: significado de annual[] y de los campos de trend |
| lib/analysis/robust-trend.ts | Guillermo (en main falta el diagnóstico de autocorrelación) | Mann–Kendall, Sen y diagnóstico de autocorrelación |
| lib/analysis/common-window.ts | Solo Guillermo | Ventana común entre fuentes (native, common, fixed) |
| lib/analysis/multiple-testing.ts | Solo Guillermo | Benjamini–Hochberg |
| lib/analysis/types.ts | Guillermo (en main falta TemporalWindow) | Contrato futuro multi-fuente: EarthScopeDataBundle, CanonicalSeries, TemporalWindow |
| components/app-shell.tsx | main (vigente) | Llama a /api/series con SWR |
| components/trend-chart.tsx | main (vigente) | Gráfica anual: usa annual[], slopePerYear e intercept (ver notas en 10.1) |
| components/evidence-panel.tsx | main (vigente) | Panel estadístico y de procedencia |
| components/variable-selector.tsx, period-picker.tsx, location-selector.tsx | main (vigente) | Controles de variable, periodo (2001–2024) y ubicación |
| app/api/variables/route.ts, app/api/point/route.ts, app/api/region/route.ts | Guillermo (API v2) | Endpoints de catálogo, punto (gráficas) y región (mapa) |
| lib/api/v2.ts | Guillermo (API v2) | Tipos PointResponse, RegionResponse y VariablesResponse para importar en la interfaz |
| lib/variables/catalog.ts | Guillermo (API v2) | Catálogo de variables: etiquetas es/en, unidades, clase, disponibilidad y política de tendencia |
| lib/analysis/annual-rules.ts, robust-stats.ts, robust-assessment.ts, region.ts; lib/nasa/power.ts; lib/api/*-service.ts | Guillermo (API v2) | Limpieza, agregación, estadística robusta, cuadrícula y llamadas a POWER |
| lib/geo.ts | Solo main | Fronteras Natural Earth y proyección del mapa 2D (no sirven para agregación científica) |
| docs/science/methodology.md, docs/science/validation-protocol.md | Guillermo | Protocolo científico (methodology.md aún dice 90%, ver A1) |

La interfaz vigente está en `main`; los componentes de la rama Guillermo son una versión anterior. Los tipos con `autocorrelation`, la ventana común y BH solo existen en Guillermo.

### 2.3 API v2: datos ya procesados para la interfaz

Las variables seleccionadas en este reporte se procesan en el servidor con la misma limpieza que temperatura y lluvia (años 12/12, sin imputar) y con un perfil propio por variable: escala del cambio (absoluta, % de la media 1991–2020 o puntos porcentuales), método principal (OLS o Sen), anomalías, límites físicos, sub-series por temporada y umbral de relevancia. Guía completa: `docs/backend/api-v2.md`.

| Endpoint | Devuelve | Uso |
|---|---|---|
| GET /api/variables | Catálogo de 13 variables, excluidas con motivo, reglas y textos de veredicto | Selectores, leyendas y filtros |
| GET /api/point | Series anuales y mensuales, climatología 1991–2020 y evaluación de tendencia de las 13 variables en una celda | Gráficas y panel de evidencia |
| POST /api/region | Celdas de una variable recortadas al polígono del estado o país, tendencia por celda con FDR de campo y serie regional ponderada | Mapa y gráfica regional |

`/api/series` y `/api/climate` no cambian. Variables en el mapa: T2M, T2M_RANGE, TXx, TNn, PRECTOTCORR, PREC_MJJASO, QV2M, RH2M y GWETROOT. Solo en punto (requieren datos diarios): TX, TN, TX90p y TN90p.

## 3. Estado del código

### 3.1 Ramas

- `origin/Guillermo` (741fa44) contiene el backend completo: `lib/analysis/{trend,robust-trend,common-window,multiple-testing,types}.ts`, `lib/nasa/{client,types}.ts`, `app/api/series/route.ts`, 12 pruebas.
- `origin/main` (2996ebc) **no** contiene 26300d3 ni 741fa44: le faltan `common-window.ts`, `multiple-testing.ts`, el diagnóstico de autocorrelación y el campo `trend.autocorrelation`. main sí tiene la interfaz nueva (globo, `lib/geo.ts`, selector país/estado).
- Antes de que la interfaz consuma `trend.autocorrelation` hay que integrar Guillermo en main.
- Revalidado el 2026-11-14: `origin/main` avanzó a `477e99a` (globo, CSS y lockfile). Sigue sin contener 26300d3 ni 741fa44, y `components/trend-chart.tsx` y `components/evidence-panel.tsx` no cambiaron.

### 3.2 Endpoint vigente

```text
GET /api/series?latitude={lat}&longitude={lon}&startYear={yyyy}&endYear={yyyy}&variable=temperature|precipitation
```

Consulta POWER Monthly Point (`community=AG`, `time-standard=LST`), descarta `YYYY13`, −999 y no numéricos, agrega por año (media ponderada por días o suma mm/día × días) y calcula OLS, IC 95%, p de t, Mann–Kendall con empates, Sen y autocorrelación lag-1 de residuos. `/api/climate` reexporta el mismo handler.

### 3.3 Campos que la interfaz en main consume hoy

`analysis.annual[]` (año, valor, unidad, conteo, completitud), `analysis.observations[]` (exportación CSV), `trend.slopePerYear`, `trend.intercept`, `trend.senSlopePerYear`, `trend.confidenceInterval95`, `trend.pValue`, `trend.mannKendall.pValue/significantAt05`, `trend.significantAt05`, `trend.nYears`, `trend.completeness`, `trend.method`, `trend.warnings`, `productVersion`, `sourceModel`, `timeStandard`, `retrievedAt`, `coverage`, `missingCount`, `period`.

## 4. Verificación del pipeline

Método: lectura del código y ejecución de las funciones del repositorio (copia fuera del proyecto, Node 26 con eliminación de tipos) sobre las respuestas reales de POWER, comparando con una implementación independiente en Python.

| Sitio | Parámetro | Ventana | Pendiente/año (repo) | p OLS (repo) | p MK (repo) | Pendiente/año (auditoría) | p OLS (auditoría) |
|---|---|---|---|---|---|---|---|
| puebla | T2M | 1981-2024 | 0.03779 | <0.0001 | <0.0001 | 0.03779 | <0.0001 |
| puebla | T2M | 2001-2024 | 0.04545 | 0.0008 | 0.0092 | 0.04545 | 0.0008 |
| puebla | PRECTOTCORR | 1981-2024 | -0.72606 | 0.7202 | 0.9597 | -0.72606 | 0.7202 |
| puebla | PRECTOTCORR | 2001-2024 | 6.87136 | 0.0351 | 0.0500 | 6.87136 | 0.0351 |
| tehuacan | T2M | 1981-2024 | 0.04886 | <0.0001 | <0.0001 | 0.04886 | <0.0001 |
| tehuacan | T2M | 2001-2024 | 0.06222 | <0.0001 | 0.0001 | 0.06222 | <0.0001 |
| tehuacan | PRECTOTCORR | 1981-2024 | -9.62487 | 0.0048 | 0.0156 | -9.62487 | 0.0048 |
| tehuacan | PRECTOTCORR | 2001-2024 | -0.36013 | 0.8974 | 0.7850 | -0.36013 | 0.8974 |

Coinciden. Hallazgos:

| # | Severidad | Estado | Archivo | Hallazgo | Evidencia | Impacto actual | Acción |
|---|---|---|---|---|---|---|---|
| A1 | Alta | Error latente | lib/analysis/trend.ts:112 · docs/science/methodology.md:14 | calculateTrend acepta años con completeness ≥ 0.9, o sea 11 de 12 meses. La suma anual de lluvia se hace solo con los meses presentes. | Ejecutando el código del repo: si falta agosto de 2024, el año sigue entrando. Lluvia 2024 de Puebla pasa de 979 a 843 mm y la pendiente 2001–2024 de +68.7 a +55.1 mm/década. En Tehuacán, de -3.6 a -19.1 mm/década. | Sin efecto hoy: POWER T2M y PRECTOTCORR están completos 1981–2025. Se activa con MODIS 2000 (11 meses), IMERG 2025 (9 meses), radiación 1983 o un diciembre aún no publicado. | Exigir validObservationCount === 12. Añadir prueba 11/12. Corregir methodology.md y el texto “at least 90%” del gráfico en main. |
| A2 | — | Correcto | lib/analysis/trend.ts:85-109 | Media ponderada por días (temperatura) y suma mm/día × días (lluvia). | Reproduce el anual YYYY13 de POWER: diferencia ≤ 0.006 °C y ≤ 1.8 mm/año (redondeo). | — | Mantener. |
| A3 | — | Correcto | lib/nasa/client.ts:28-46 | Excluye YYYY13, −999 y no numéricos; no imputa. | Radiación y nubosidad traen −999 en 1981–1983 y salen del análisis. | — | Mantener; la comparación value === -999 (línea 36) es redundante con fillValue. |
| A4 | Alta | Trampa de diseño | lib/nasa/client.ts:9-12 · lib/nasa/types.ts (NasaParameter) | El endpoint mensual entrega T2M_MAX y T2M_MIN como extremos del mes (día más caluroso, noche más fría), no como medias. | En 528 meses por sitio, T2M_MAX mensual = máximo de los diarios y T2M_MIN mensual = mínimo (diferencia 0.000). Con la media de los diarios difieren 3.3–4.2 °C. | Si se añaden al endpoint como están, aggregateAnnual promediaría extremos y la interfaz los rotularía como “temperatura máxima/mínima”. | Para medias usar el endpoint diario y promediar. Si se usa el mensual, rotular TXx/TNn y agregar con máximo/mínimo. |
| A5 | Baja | Error activo | app/api/series/route.ts:35 | `variable in parameters` acepta claves heredadas (toString, constructor, __proto__). | variable=toString pasa el filtro, se envía a POWER parameters=function… y la respuesta es 502 en vez de 400. | Petición externa inútil y código de error incorrecto. | Object.hasOwn(parameters, variable). |
| A6 | Baja | Error activo | lib/nasa/client.ts:91-92 | El rechazo HTTP 4xx de POWER (“request rejected…”) se reemplaza por “could not be reached after two attempts”. | El catch externo solo relanza mensajes con “timed out”. | El usuario ve “sin conexión” cuando el problema es el periodo o la ubicación. | Relanzar también los errores “request rejected”. |
| A7 | Media | Pendiente | lib/analysis/robust-trend.ts | Mann–Kendall sin corrección por autocorrelación; Sen sin intervalo; aproximación normal permitida desde n = 3. | Con Hamed–Rao el p del viento en Puebla 1981–2024 pasa de 0.0001 a 0.0136 (factor de varianza 2.541). | p optimistas cuando r1 > 0.3 (33 de las 138 pruebas de esta auditoría). | Hamed–Rao como p principal, TFPW como sensibilidad, IC de Sen (Gilbert) e IC por bootstrap de bloques. Exigir n ≥ 10 para publicar p. |
| A8 | Media | Advertencia | app/api/series/route.ts · lib/nasa/client.ts | El valor “punto” es exactamente la celda MERRA-2 más cercana (verificado: idéntico a la celda del endpoint regional). | Elevación de celda: Puebla 2147 m (ciudad ≈2135 m), Tehuacán 2064 m (ciudad ≈1680 m), Tlaxcala 2517 m (estación 2230 m). En Tlaxcala, TMAX de POWER es 3.8 °C más fría que la estación. | “Tehuacán” en POWER representa la sierra, no el valle semiárido. | Mostrar la huella de la celda (0.5° × 0.625°) y su elevación; usar IMERG 0.1° y NASADEM para estratificar. |
| A9 | Media | Advertencia | — (datos) | La caída de nubosidad y el aumento de radiación ocurren en 1996–1998 (Pettitt) y desaparecen después de 2001. | Nubosidad Puebla: Pettitt 1998 (p 0.0001); tendencia 2001–2024 p_HR 0.79. Antes de 2001 POWER usa GEWEX SRB con nubes ISCCP, que tienen una caída espuria documentada. | Una “tendencia” 1981–2024 de CLOUD_AMT o ALLSKY sería un artefacto de producto. | No publicar tendencias de esas variables antes de 2001; viento y presión solo como diagnóstico. |
| A10 | Alta | Limitación de datos | — (datos) | POWER reproduce el ciclo estacional de la lluvia pero poco su variación interanual, y su signo de tendencia depende del año de inicio. | Contra GHCN: r anual 0.333 (aeropuerto) y 0.124 (Tlaxcala); días húmedos 46.5% en POWER vs 23.1% en la estación. Puebla: −22 mm/década desde 1990, +102 desde 2005. | Ninguna tendencia de lluvia de POWER es publicable por sí sola; CDD, CWD y SDII diarios no son fiables. | Integrar IMERG (1998–2024) y validar con estaciones antes de afirmar algo sobre lluvia. |
| A11 | Media | Advertencia | — (datos) | POWER subestima el calentamiento nocturno medido en Tlaxcala; la máxima coincide. | 1981–2005: TMIN estación +0.83 vs POWER +0.21 °C/década (diferencia p 0.0); TMAX +0.68 vs +0.77 (p 0.8712). | La TN de POWER es una estimación regional conservadora; la estación puede incluir efecto urbano. | Presentar TN de POWER como señal regional y la diferencia con la estación como contexto. |
| A12 | Media | Advertencia | origin/main vs origin/Guillermo | main (2996ebc) no contiene 26300d3 ni 741fa44: le faltan autocorrelación, ventana común y BH. | git diff origin/Guillermo origin/main -- lib: 508 líneas eliminadas en main. | El tipo TrendResult del frontend en main no tiene el campo autocorrelation. | Integrar Guillermo en main antes de que la interfaz use los campos nuevos. |
| A13 | Media | Nota para frontend | components/trend-chart.tsx (main) · components/evidence-panel.tsx (main) | El eje Y del gráfico siempre incluye 0 y el eje X usa el índice, no el año. El texto dice “at least 90% monthly coverage”. | minValue = Math.min(..., 0): una serie de 16–18 °C se dibuja sobre 0–18 °C y se ve plana. Un año faltante desplazaría los puntos. | Tendencias reales se ven planas; el texto quedará desactualizado con A1. | Informativo para el agente de interfaz: escalar al rango de datos, ubicar por año, actualizar el texto. |
| A14 | Baja | Pendiente | tests/analysis/trend.test.ts | Hay 12 pruebas; ninguna cubre el caso 11/12 ni el umbral exacto. | La prueba de completitud usa 10/12 (0.83). | El error A1 no se detecta. | Añadir pruebas 11/12 y 12/12. |
| A15 | — | Correcto | lib/analysis/common-window.ts:66 | resolveCommonMonthlyWindow devuelve 2001-01 a 2024-12 con los manifiestos reales de POWER, IMERG y MOD13A3. | Ejecutado con node sobre una copia del código fuera del repositorio. | minimumStartYear = 2001 por defecto oculta que POWER–IMERG solo podría usar 1998–2024. | Pasar minimumStartYear explícito según la familia de fuentes. |
| A16 | Media | Pendiente | lib/analysis/trend.ts (TrendResult) | La API no informa qué tendencia podría detectarse con los datos disponibles. | Con 24 años, la tendencia mínima detectable de lluvia es 107 mm/década en Puebla y 82 en Tehuacán (~10% de la media por década). | “p ≥ 0.05” se lee como “no cambió”. | Añadir minimumDetectableTrend al TrendResult. |
| A17 | Baja | Advertencia | app/api/series/route.ts:27 | El último año permitido sale del reloj (año actual − 1), no de la cobertura real. | La respuesta de POWER incluye header.start y header.end (hoy 19810101–20251231). | En enero puede pedirse un año sin diciembre publicado, lo que activa A1. | Derivar el último año completo de header.end o del manifiesto. |

## 5. Semántica de NASA POWER (verificada)

| Hecho | Evidencia | Consecuencia |
|---|---|---|
| El “punto” es la celda MERRA-2 nativa más cercana (0.5° lat × 0.625° lon), sin interpolación. | Los valores del endpoint de punto son idénticos a los de la celda (19.0 N, −98.125 W) del endpoint regional. | Rotular “celda POWER ≈ 55 × 65 km”, nunca “la ciudad”. |
| Elevación de celda: Puebla 2147 m, Tehuacán 2064 m, Tlaxcala 2517 m. | `geometry.coordinates[2]` de la respuesta. | Tehuacán (≈1680 m) queda 380 m por debajo de su celda: la celda describe la sierra. |
| `T2M_MAX`/`T2M_MIN` mensuales = máximo/mínimo absoluto del mes. | 528 meses por sitio: diferencia 0.000 con el extremo diario y 3.3–4.2 °C con la media diaria. | Para medias usar el endpoint diario. Si se usa el mensual, rotular TXx/TNn. |
| `T2M_RANGE` mensual = media del rango diario (máx − mín). | Coincide con la media de (T2M_MAX − T2M_MIN) diarios. | Es una media; se puede agregar con ponderación por días. |
| `YYYY13` de `T2M_MAX`/`T2M_MIN` es el extremo anual. | Igual al máximo/mínimo de los 12 meses. | Nunca usarlo como media anual. |
| Unidades reales: T en C, lluvia en mm/day, radiación en **MJ/m^2/day**, humedad de suelo en fracción 1. | `parameters[*].units`. | Leer la unidad de la respuesta, no fijarla en código. |
| Radiación y nubes empiezan en 1984 (−999 en 1981–1983). Fuentes del encabezado: SRB, SYN1DEG, MERRA2. | Respuesta mensual. | El manifiesto debe declarar el inicio real por variable. |
| La respuesta incluye `header.start` y `header.end` (hoy 19810101–20251231). | Encabezado. | Derivar el último año completo de ahí, no del reloj. |
| POWER mensual ya trae los 12 meses de 2025. | Respuesta. | Para comparar con IMERG la ventana termina en 2024 (IMERG llega a 2025-09). |

## 6. Diccionario de variables

Clases: **Núcleo** (publicables), **Extremo térmico** (publicables con su definición), **Apoyo** (contexto), **Estacional/Lluvia diaria (baja confianza)**, **Lluvia diaria (no fiable)** (POWER registra el doble de días húmedos que las estaciones) y **Sospechosa** (cambio de producto o reanálisis sin homogeneizar). Solo Núcleo, Extremo térmico y Apoyo son “aptas”.

| Id | Nombre | Clase | Unidad | Fuente | Agregado anual | Definición |
|---|---|---|---|---|---|---|
| T2M | Temperatura media del aire (2 m) | Núcleo | °C | POWER mensual | media ponderada por días | Media mensual de T2M (MERRA-2). |
| TX | Temperatura máxima media diaria | Núcleo | °C | POWER diario (T2M_MAX) | media de los máximos diarios | Promedio anual de la máxima de cada día. No es el T2M_MAX mensual de POWER. |
| TN | Temperatura mínima media diaria | Núcleo | °C | POWER diario (T2M_MIN) | media de los mínimos diarios | Promedio anual de la mínima de cada día. No es el T2M_MIN mensual de POWER. |
| T2M_RANGE | Rango térmico diurno (DTR) | Núcleo | °C | POWER mensual | media ponderada por días | Promedio de la diferencia diaria máxima − mínima (verificado contra los datos diarios). |
| PRECTOTCORR | Precipitación anual | Núcleo | mm/año | POWER mensual | suma mm/día × días del mes | MERRA-2 corregida con observaciones. Total anual. |
| PREC_MJJASO | Precipitación de temporada de lluvias (may–oct) | Núcleo | mm | POWER mensual | suma may–oct | Total de mayo a octubre; concentra ~88% de la lluvia anual. |
| PREC_NDJFMA | Precipitación de temporada seca (nov–abr) | Estacional (baja confianza) | mm | POWER mensual | suma nov (año−1) a abr | Total de noviembre del año anterior a abril. |
| TXx | Máxima absoluta anual (TXx) | Extremo térmico | °C | POWER diario | máximo del año | Día más caluroso del año (ETCCDI TXx). |
| TNn | Mínima absoluta anual (TNn) | Extremo térmico | °C | POWER diario | mínimo del año | Noche más fría del año (ETCCDI TNn). |
| TXX_MEAN | Promedio de los máximos mensuales (T2M_MAX mensual) | Extremo térmico | °C | POWER mensual | media anual de los 12 máximos | Lo que entrega el endpoint mensual como T2M_MAX: el día más caluroso de cada mes. |
| TNN_MEAN | Promedio de los mínimos mensuales (T2M_MIN mensual) | Extremo térmico | °C | POWER mensual | media anual de los 12 mínimos | Lo que entrega el endpoint mensual como T2M_MIN: la noche más fría de cada mes. |
| TX90p | Días cálidos (TX90p) | Extremo térmico | % días | POWER diario | % de días > p90 1991–2020 | Percentil 90 por día del calendario (ventana de 5 días), base 1991–2020, sin bootstrap dentro de la base. |
| TN90p | Noches cálidas (TN90p) | Extremo térmico | % días | POWER diario | % de días > p90 1991–2020 | Igual que TX90p con la mínima diaria. |
| TX10p | Días frescos (TX10p) | Extremo térmico | % días | POWER diario | % de días < p10 1991–2020 | Percentil 10 por día del calendario, base 1991–2020. |
| TN10p | Noches frías (TN10p) | Extremo térmico | % días | POWER diario | % de días < p10 1991–2020 | Percentil 10 de la mínima diaria, base 1991–2020. |
| FD | Días con helada (FD) | Extremo térmico | días | POWER diario | conteo TN < 0 °C | Número de días con mínima bajo 0 °C en la celda. |
| SU25 | Días de verano (SU25) | Extremo térmico | días | POWER diario | conteo TX > 25 °C | Número de días con máxima sobre 25 °C. |
| Rx1day | Lluvia máxima en 1 día | Lluvia diaria (baja confianza) | mm | POWER diario | máximo anual | Mayor acumulado diario del año. |
| Rx5day | Lluvia máxima en 5 días | Lluvia diaria (baja confianza) | mm | POWER diario | máximo anual de 5 días consecutivos | Mayor acumulado de 5 días consecutivos. |
| R10mm | Días con lluvia ≥ 10 mm | Lluvia diaria (baja confianza) | días | POWER diario | conteo | Días de lluvia intensa. |
| R20mm | Días con lluvia ≥ 20 mm | Lluvia diaria (baja confianza) | días | POWER diario | conteo | Días de lluvia muy intensa. |
| SDII | Intensidad diaria (SDII) | Lluvia diaria (no fiable) | mm/día | POWER diario | total en días ≥1 mm ÷ número de días ≥1 mm | Lluvia media de un día húmedo. |
| CDD | Racha seca máxima (CDD) | Lluvia diaria (no fiable) | días | POWER diario | racha más larga < 1 mm que termina en el año | Las rachas pueden empezar el año anterior (la temporada seca cruza diciembre). |
| CWD | Racha húmeda máxima (CWD) | Lluvia diaria (no fiable) | días | POWER diario | racha más larga ≥ 1 mm | Afectada por la llovizna del reanálisis. |
| R95p | Lluvia en días muy húmedos (R95p) | Lluvia diaria (baja confianza) | mm | POWER diario | suma de días > p95 húmedo 1991–2020 | Total anual de los días por encima del percentil 95 de días húmedos. |
| R1mm | Días húmedos (≥ 1 mm) | Lluvia diaria (no fiable) | días | POWER diario | conteo | Frecuencia de días húmedos; MERRA-2 tiende a sobreestimarla. |
| DRIZZLE | Días de llovizna (0.1–1 mm) | Lluvia diaria (no fiable) | % días | POWER diario | % de días | Indicador de llovizna espuria del reanálisis. |
| RH2M | Humedad relativa (2 m) | Apoyo | % | POWER mensual | media ponderada por días | Depende de T y de la humedad absoluta; no es independiente de T2M. |
| QV2M | Humedad específica (2 m) | Apoyo | g/kg | POWER mensual | media ponderada por días | Humedad absoluta. |
| GWETROOT | Humedad del suelo, zona radicular | Apoyo | fracción 0–1 | POWER mensual | media ponderada por días | Variable del modelo de superficie de MERRA-2, no medición. |
| GWETTOP | Humedad del suelo, superficie | Apoyo | fracción 0–1 | POWER mensual | media ponderada por días | Capa superficial del modelo de MERRA-2. |
| WS2M | Viento a 2 m | Sospechosa | m/s | POWER mensual | media ponderada por días | Reanálisis sin homogeneizar; sensible a cambios en el sistema de observación. |
| PS | Presión superficial | Sospechosa | kPa | POWER mensual | media ponderada por días | Una tendencia de presión en una celda fija suele ser artefacto del reanálisis. |
| CLOUD_AMT | Nubosidad | Sospechosa | % | POWER mensual (SRB→CERES) | media ponderada por días | Antes de 2001 proviene de GEWEX SRB, que usa nubes ISCCP con una caída espuria documentada por cambios de geometría de observación; desde 2001, CERES SYN1deg. Celda de 1°. |
| ALLSKY_SFC_SW_DWN | Radiación solar en superficie | Sospechosa | MJ/m²/día | POWER mensual (SRB→CERES) | media ponderada por días | Unidad real de la API: MJ/m²/día (no kWh). Mismo cambio de producto SRB→CERES en 2001; celda de 1°. |

## 7. Resultados

### 7.1 Protocolo

- Familia **primaria** declarada antes de calcular: 2 sitios × {T2M, TX, TN, T2M_RANGE, PRECTOTCORR, PREC_MJJASO} × 2001–2024 = 12 hipótesis. Familia **exploratoria**: el resto (126 pruebas). Benjamini–Hochberg por separado sobre el p de Hamed–Rao.
- **Robusta** = R1 q < 0.05 · R2 IC por bootstrap de bloques excluye 0 · R3 TFPW p < 0.05 · R4 jackknife conserva el signo siempre y p < 0.05 en ≥ 90% · R5 mismo signo y p < 0.10 en la otra ventana · variable apta.
- Tendencia mínima detectable (80% de potencia, α = 0.05, inflada por AR(1)).

### 7.2 Familia primaria (2001–2024)

| Sitio | Variable | Pendiente/década | IC bloque 95% | Sen [IC] | p OLS | p Hamed–Rao | p TFPW | q BH | Mín. detectable | Criterios | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Puebla | PRECTOTCORR | +68.714 mm/año | [+6.518, +134.898] | +65.943 [-2.300, +140.250] | 0.0351 | 0.0500 | 0.0394 | 0.1001 | 107.109 | 2 | Débil |
| Puebla | PREC_MJJASO | +31.957 mm | [-19.439, +85.616] | +32.682 [-39.040, +93.918] | 0.3017 | 0.3334 | 0.3417 | 0.4445 | 87.513 | 0 | Sin tendencia detectable |
| Puebla | T2M | +0.455 °C | [+0.231, +0.681] | +0.360 [+0.113, +0.681] | 0.0008 | 0.0092 | 0.0060 | 0.0221 | 0.401 | 5 | Robusta |
| Puebla | T2M_RANGE | -0.141 °C | [-0.483, +0.190] | -0.152 [-0.412, +0.140] | 0.2915 | 0.4429 | 0.2244 | 0.5315 | 0.620 | 0 | Sin tendencia detectable |
| Puebla | TN | +0.515 °C | [+0.335, +0.694] | +0.494 [+0.260, +0.762] | <0.0001 | 0.0001 | 0.0002 | 0.0009 | 0.317 | 5 | Robusta |
| Puebla | TX | +0.375 °C | [-0.003, +0.755] | +0.371 [-0.113, +0.750] | 0.0410 | 0.1433 | 0.1130 | 0.2150 | 0.646 | 1 | Sin tendencia detectable |
| Tehuacán | PRECTOTCORR | -3.601 mm/año | [-55.293, +46.577] | -11.164 [-72.757, +53.246] | 0.8974 | 0.7850 | 1.0000 | 0.7850 | 82.039 | 1 | Sin tendencia detectable |
| Tehuacán | PREC_MJJASO | -10.829 mm | [-65.958, +42.599] | -7.872 [-65.400, +58.237] | 0.7203 | 0.7471 | 0.7917 | 0.7850 | 89.260 | 1 | Sin tendencia detectable |
| Tehuacán | T2M | +0.622 °C | [+0.386, +0.862] | +0.549 [+0.296, +0.844] | <0.0001 | 0.0017 | 0.0003 | 0.0051 | 0.425 | 5 | Robusta |
| Tehuacán | T2M_RANGE | +0.191 °C | [-0.054, +0.437] | +0.216 [-0.045, +0.548] | 0.1201 | 0.1069 | 0.1696 | 0.1833 | 0.374 | 1 | Sin tendencia detectable |
| Tehuacán | TN | +0.535 °C | [+0.324, +0.752] | +0.453 [+0.299, +0.729] | <0.0001 | 0.0001 | 0.0002 | 0.0009 | 0.390 | 5 | Robusta |
| Tehuacán | TX | +0.727 °C | [+0.379, +1.079] | +0.641 [+0.248, +1.137] | 0.0004 | 0.0014 | 0.0013 | 0.0051 | 0.592 | 5 | Robusta |

### 7.3 Señales robustas en la familia exploratoria (variables aptas)

| Sitio | Variable | Ventana | Pendiente/década | IC bloque | q BH |
|---|---|---|---|---|---|
| Puebla | T2M · Temperatura media del aire (2 m) | 1981-2024 | +0.378 °C | [+0.300, +0.468] | <0.0001 |
| Puebla | TN · Temperatura mínima media diaria | 1981-2024 | +0.333 °C | [+0.271, +0.404] | <0.0001 |
| Puebla | TN10p · Noches frías (TN10p) | 1981-2024 | -3.511 % días | [-4.186, -2.825] | <0.0001 |
| Puebla | TN90p · Noches cálidas (TN90p) | 1981-2024 | +4.359 % días | [+3.300, +5.575] | <0.0001 |
| Puebla | TNN_MEAN · Promedio de los mínimos mensuales (T2M_MIN mensual) | 1981-2024 | +0.309 °C | [+0.179, +0.463] | 0.0007 |
| Puebla | TXX_MEAN · Promedio de los máximos mensuales (T2M_MAX mensual) | 1981-2024 | +0.407 °C | [+0.234, +0.592] | <0.0001 |
| Tehuacán | SU25 · Días de verano (SU25) | 1981-2024 | +19.334 días | [+14.088, +24.838] | <0.0001 |
| Tehuacán | T2M · Temperatura media del aire (2 m) | 1981-2024 | +0.489 °C | [+0.395, +0.596] | <0.0001 |
| Tehuacán | TN · Temperatura mínima media diaria | 1981-2024 | +0.346 °C | [+0.266, +0.433] | <0.0001 |
| Tehuacán | TN10p · Noches frías (TN10p) | 1981-2024 | -2.893 % días | [-3.730, -2.109] | <0.0001 |
| Tehuacán | TN90p · Noches cálidas (TN90p) | 1981-2024 | +4.169 % días | [+3.156, +5.316] | <0.0001 |
| Tehuacán | TNN_MEAN · Promedio de los mínimos mensuales (T2M_MIN mensual) | 1981-2024 | +0.331 °C | [+0.202, +0.475] | 0.0002 |
| Tehuacán | TX · Temperatura máxima media diaria | 1981-2024 | +0.712 °C | [+0.534, +0.902] | <0.0001 |
| Tehuacán | TX10p · Días frescos (TX10p) | 1981-2024 | -3.815 % días | [-4.869, -2.780] | <0.0001 |
| Tehuacán | TX90p · Días cálidos (TX90p) | 1981-2024 | +6.000 % días | [+4.475, +7.814] | <0.0001 |
| Tehuacán | TXX_MEAN · Promedio de los máximos mensuales (T2M_MAX mensual) | 1981-2024 | +0.737 °C | [+0.537, +0.941] | <0.0001 |
| Tehuacán | TXx · Máxima absoluta anual (TXx) | 1981-2024 | +0.635 °C | [+0.298, +0.995] | <0.0001 |
| Puebla | QV2M · Humedad específica (2 m) | 2001-2024 | +0.297 g/kg | [+0.097, +0.503] | 0.0411 |
| Puebla | TN10p · Noches frías (TN10p) | 2001-2024 | -3.599 % días | [-4.613, -2.579] | 0.0003 |
| Puebla | TN90p · Noches cálidas (TN90p) | 2001-2024 | +8.597 % días | [+5.628, +11.698] | 0.0035 |
| Puebla | TNN_MEAN · Promedio de los mínimos mensuales (T2M_MIN mensual) | 2001-2024 | +0.692 °C | [+0.371, +1.001] | 0.0016 |
| Puebla | TNn · Mínima absoluta anual (TNn) | 2001-2024 | +1.108 °C | [+0.373, +1.784] | 0.0114 |
| Tehuacán | QV2M · Humedad específica (2 m) | 2001-2024 | +0.264 g/kg | [+0.135, +0.393] | 0.0002 |
| Tehuacán | SU25 · Días de verano (SU25) | 2001-2024 | +23.896 días | [+11.800, +36.340] | 0.0241 |
| Tehuacán | TN10p · Noches frías (TN10p) | 2001-2024 | -3.137 % días | [-4.755, -1.535] | <0.0001 |
| Tehuacán | TN90p · Noches cálidas (TN90p) | 2001-2024 | +7.415 % días | [+4.430, +10.454] | 0.0029 |
| Tehuacán | TNN_MEAN · Promedio de los mínimos mensuales (T2M_MIN mensual) | 2001-2024 | +0.614 °C | [+0.292, +0.929] | 0.0036 |
| Tehuacán | TX10p · Días frescos (TX10p) | 2001-2024 | -2.155 % días | [-3.388, -0.947] | 0.0232 |
| Tehuacán | TX90p · Días cálidos (TX90p) | 2001-2024 | +9.580 % días | [+4.520, +14.614] | 0.0041 |
| Tehuacán | TXX_MEAN · Promedio de los máximos mensuales (T2M_MAX mensual) | 2001-2024 | +0.615 °C | [+0.281, +0.961] | 0.0099 |

Pasan los cinco criterios pero **no son aptas** (no presentarlas como tendencia climática): Puebla PREC_NDJFMA 2001-2024; Puebla CDD 2001-2024; Puebla WS2M 1981-2024; Puebla WS2M 2001-2024; Puebla PS 1981-2024.

### 7.4 ¿En qué meses?

- Puebla TN 2001–2024 (°C/década, * p < 0.05): E+0.48* F+0.41* M+0.73* A+0.41* M+0.35 J+0.35 J+0.44* A+0.64* S+0.27 O+0.25 N+0.93* D+0.65*
- Puebla TX 2001–2024 (°C/década, * p < 0.05): E+0.15 F+0.58 M+0.79 A+0.07 M+0.47 J+0.42 J+0.57 A+0.16 S+0.07 O+0.15 N+0.47 D+0.13
- Tehuacán TN 2001–2024 (°C/década, * p < 0.05): E+0.70* F+0.33 M+0.49* A+0.66* M+0.51 J+0.50 J+0.19 A+0.41* S+0.26* O+0.39 N+0.99* D+0.66*
- Tehuacán TX 2001–2024 (°C/década, * p < 0.05): E+0.63* F+1.00 M+0.73* A+0.65* M+1.07 J+0.54 J+0.66 A+0.46* S+0.46 O+0.41 N+1.00* D+0.53
- La mínima se calienta en casi todos los meses; la señal es más fuerte en noviembre–diciembre (temporada seca).

### 7.5 Sensibilidad al año de inicio

- Puebla PRECTOTCORR (mm/década desde cada inicio hasta 2024): 1981: -7.3, 1985: -6.1, 1989: -15.2, 1993: +9.0, 1997: +42.5, 2001: +68.7, 2005: +102.1*, 2009: +67.4
- Puebla TN (°C/década): 1981: +0.33*, 1985: +0.37*, 1989: +0.39*, 1993: +0.42*, 1997: +0.48*, 2001: +0.52*, 2005: +0.60*, 2009: +0.86*
- Tehuacán PRECTOTCORR (mm/década desde cada inicio hasta 2024): 1981: -96.2*, 1985: -110.5*, 1989: -144.4*, 1993: -131.9, 1997: -85.1, 2001: -3.6, 2005: +10.2, 2009: -56.2
- Tehuacán TN (°C/década): 1981: +0.35*, 1985: +0.40*, 1989: +0.42*, 1993: +0.45*, 1997: +0.50*, 2001: +0.54*, 2005: +0.64*, 2009: +0.93*
- La temperatura conserva signo y significancia con cualquier inicio; la lluvia cambia de signo. En Tehuacán la caída 1981–2024 se debe a una década de 1990 muy húmeda (quiebre de Pettitt ≈ 1999) que puede ser también un cambio del sistema de observación del reanálisis.

### 7.6 Coherencia espacial (24 celdas, FDR de campo q < 0.10)

| Variable | Ventana | Celdas | Positivas | Significativas |
|---|---|---|---|---|
| T2M | 1981-2024 | 24 | 24 | 24 |
| T2M | 2001-2024 | 24 | 24 | 22 |
| PRECTOTCORR | 1981-2024 | 24 | 4 | 10 |
| PRECTOTCORR | 2001-2024 | 24 | 12 | 6 |
| QV2M | 1981-2024 | 24 | 22 | 14 |
| QV2M | 2001-2024 | 24 | 24 | 19 |
| RH2M | 1981-2024 | 24 | 1 | 15 |
| RH2M | 2001-2024 | 24 | 4 | 0 |
| TNN_MEAN | 1981-2024 | 24 | 24 | 24 |
| TNN_MEAN | 2001-2024 | 24 | 24 | 21 |
| TXX_MEAN | 1981-2024 | 24 | 24 | 24 |
| TXX_MEAN | 2001-2024 | 24 | 22 | 14 |

## 8. Validación con estaciones GHCN-Daily

Días emparejados: solo cuentan los días con dato válido en la estación (sin bandera de calidad); un mes entra con ≥ 80% de días.

| Estación | Variable | Meses | r mensual | r anomalías | r anual | Sesgo POWER − estación | % días húmedos POWER / estación | Años completos | Sen estación /déc | Sen POWER /déc | p diferencia |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aeropuerto de Puebla (Hermanos Serdán) | PRCP | 329 | 0.676 | 0.452 | 0.333 | -12.16 mm/mes | 43.7 / 22.4 | 1992–2024 | -79.781 | -95.7 | 0.5841 |
| Aeropuerto de Puebla (Hermanos Serdán) | TMAX | 3 | — | — | — | —  | — / — | — | — | — | — |
| Aeropuerto de Puebla (Hermanos Serdán) | TMIN | 24 | 0.929 | 0.698 | — | 2.02 °C | — / — | — | — | — | — |
| Tlaxcala | PRCP | 484 | 0.856 | 0.513 | 0.124 | 12.81 mm/mes | 46.5 / 23.1 | 1981–2019 | 0.759 | -47.482 | 0.2606 |
| Tlaxcala | TMAX | 363 | 0.867 | 0.706 | 0.76 | -3.81 °C | — / — | 1981–2005 | 0.68 | 0.769 | 0.8712 |
| Tlaxcala | TMIN | 363 | 0.929 | 0.724 | 0.708 | -0.25 °C | — / — | 1981–2005 | 0.828 | 0.21 | 0.0 |

Lectura: POWER es fiable para la **tendencia de la máxima**; para la **mínima** es conservador frente a una estación urbana; para la **lluvia** sirve como climatología, no para tendencias ni índices diarios. El sesgo de −3.8 °C en TMAX de Tlaxcala es mayor que el esperado por altitud (−1.9 °C).

## 9. Fuentes externas y cobertura verificada

| Fuente | Tipo | Prioridad | Acceso | Verificado | Producto | Cobertura | Uso recomendado | Limitaciones |
|---|---|---|---|---|---|---|---|---|
| NASA POWER | Producto + API | Integrada | API pública sin login | Sí: API v2.10.0, unidades, celdas | MERRA-2 (meteorología), GEWEX SRB/CERES (radiación) | 1981–2025; diario y mensual; regional 24 celdas | Línea base de temperatura. Lluvia solo como contexto. | Celda de ~55 km; T2M_MAX/MIN mensuales son extremos; llovizna en datos diarios. |
| Giovanni (GES DISC) | Herramienta | Alta | Earthdata Login | Parcial: versión 4.40; la página es una app que no expone su catálogo sin sesión | IMERG Final V07 mensual (GPM_3IMERGM.07) | 1998-01 a 2025-09 (CMR, 333 gránulos), 0.1° | Explorar y validar IMERG; series promediadas por área en CSV. | Registrar siempre el producto y versión, no “Giovanni”. 2025 incompleto. |
| Hydrology Time Series (antes Data Rods) | Herramienta | Media | Earthdata Login; API “Giovanni in the Cloud: Time Series Service” | Sí: ficha de herramienta GES DISC; el endpoint antiguo redirige a un aviso de retiro | GLDAS Noah 2.1 (global), NLDAS (solo EE. UU.) | GLDAS 2.1 mensual 2000-01 a 2026-07 (CMR), 0.25° | Contraste independiente de la humedad del suelo de POWER (GWETROOT). | Celdas de agua enmascaradas; NLDAS no cubre México. |
| AppEEARS | Herramienta | Alta | Earthdata Login (token de 48 h); catálogo y QA públicos | Sí: documentación de la API y catálogo de productos | MOD13Q1.061 / MOD13A3.061 (NDVI/EVI), MCD12Q1 (cobertura), MOD11A2 (LST), NASADEM_NC.001 | MODIS desde 2000-02; MCD12Q1 desde 2001; NASADEM 2000 | Vegetación con decodificación de VI Quality; máscara urbana con MCD12Q1. | Tareas asíncronas; resultados expiran ~30 días; límite 429. |
| NOAA NCEI Climate Data Online / GHCN-Daily | Producto + portal | Media | Archivos HTTPS sin token; API CDO con token | Sí: inventario y archivos por estación descargados | GHCN-Daily | Aeropuerto de Puebla y Tlaxcala útiles; Tehuacán sin estaciones después de 2009 | Validación: TMAX coincide, TMIN difiere (urbano), lluvia con poca habilidad interanual. | Huecos grandes; estaciones SYNOP con TMAX < 50% en el aeropuerto. |
| Acker et al., NTRS 20090042747 | Referencia | Referencia | PDF público | Sí: título y resumen extraídos del PDF | SeaWiFS clorofila vía Giovanni | — | Método: series de Giovanni, tendencia sobre anomalías y alerta de que el retrieval puede reflejar otra cosa (sedimentos/CDOM). | Caso costero; la lección es metodológica. |
| KNMI Climate Explorer | Herramienta | Auditoría | Web; verificación humana por equipo; cuenta para datos grandes | Sí: página principal | CRU TS, GPCC, ERA5/ERA5-Land, HadEX3, estaciones | Global | Auditoría manual con el dataset nombrado (p. ej. CRU TS para temperatura). | No automatizable desde el backend; no contar GHCN dos veces. |
| Medium: métodos para detectar tendencias | Referencia | Referencia | HTTP 403 a clientes automáticos | No: no se pudo leer | — | — | Se usaron las fuentes primarias: Mann (1945), Kendall (1975), Sen (1968), Hamed y Rao (1998), Yue et al. (2002), Pettitt (1979). | Contenido no verificado. |
| Statsig: guía de significancia | Referencia | Referencia | Público | Sí | — | — | p ≠ probabilidad de H0; reportar tamaño de efecto e IC; corregir pruebas múltiples. Aplicado con BH, IC y tendencia mínima detectable. | Orientado a experimentos A/B, no a series autocorrelacionadas. |
| RADARSAT Constellation Mission (datos abiertos ASC) | Producto | Fuera del MVP | Datos abiertos parciales + EODMS | Sí: ficha CKAN (licencia OGL-Canada) | SAR banda C | 2019 a la fecha; acceso diario al 90% del planeta | Ninguno en el MVP. | Serie corta, procesamiento SAR, subconjunto abierto limitado. |
| Geo.ca | Portal | No aplica | Público | Sí | Datos geoespaciales de Canadá | Canadá | Ninguno: no cubre México. | — |
| SWOT | Producto | Fuera del MVP | Público (PO.DAAC/Hydroweb) | Sí: ficha ASC | Elevación de lagos, ríos, embalses y océano | Lanzamiento 2022-12-16; ciencia desde 2023 | Caso futuro: niveles de la presa Valsequillo, no tendencias. | Menos de 3 años de datos. |
| ASC: monitoreo de ecosistemas | Referencia | Baja | Público | Sí | RADARSAT-2/RCM, SMOS, SWOT, Landsat 8 | — | SMOS (humedad de suelo global, 2010→) es un posible tercer contraste de GWETROOT. | Aplicaciones centradas en Canadá. |
| Tutorial SAR (GitHub asc-csa) | Referencia | No aplica | Público, licencia MIT modificada | Sí | Notebook Python (GDAL, cartopy) y guía QGIS | Ejemplo: incendio en Columbia Británica | Formativo; no aporta datos para Puebla. | Solo visualización. |

| Fuente | Producto | Inicio | Fin | Años completos | Resolución | Verificación | Papel |
|---|---|---|---|---|---|---|---|
| NASA POWER · meteorología (MERRA-2) | Monthly/Daily Point API v2.10.0 | 1981-01 | 2025-12 | 1981–2025 | 0.5° × 0.625° (celda nativa) | Respuesta de la API (header start/end) y comparación punto = celda regional | Integrada |
| NASA POWER · radiación y nubes (GEWEX SRB → CERES SYN1deg) | ALLSKY_SFC_SW_DWN, CLOUD_AMT | 1984-01 | 2025-12 | 1984–2025 | 1° × 1° | Valores −999 en 1981–1983 en la respuesta | Solo diagnóstico |
| GPM IMERG Final V07 mensual | GPM_3IMERGM.07 | 1998-01 | 2025-09 | 1998–2024 | 0.1° × 0.1° | CMR: 333 gránulos, último 2025-09 (consultado 2026-11-14) | Pendiente (prioridad 1) |
| MODIS Terra NDVI/EVI mensual | MOD13A3.061 | 2000-02 | 2026-10 | 2001–2025 | 1 km | CMR: 321 gránulos sobre Tehuacán, 2000-02 a 2026-10 | Pendiente (prioridad 2) |
| MODIS Terra NDVI/EVI 16 días | MOD13Q1.061 | 2000-02 | 2026-10 | 2001–2025 | 250 m | CMR: 614 compuestos sobre Tehuacán | Alternativa a MOD13A3 |
| GLDAS Noah 2.1 mensual (Hydrology Time Series) | GLDAS_NOAH025_M.2.1 | 2000-01 | 2026-07 | 2000–2025 | 0.25° | CMR: 319 gránulos, último 2026-07 | Contraste de humedad de suelo |
| VIIRS S-NPP NDVI/EVI mensual | VNP13A3.002 | 2012-01 | 2026-11 | 2012–2025 | 1 km | CMR (inicio) y aviso GES DISC: entrega de S-NPP terminó el 2026-11-02 | No empalmar con MODIS |
| GHCN-Daily · Aeropuerto de Puebla (MXM00076685) PRCP | by_station | 1988 | 2024 | 1992–1997, 2006–2008, 2011–2013, 2016, 2024 | estación (2244 m) | Años con 12 meses ≥80% de días válidos sin bandera de calidad | Validación de lluvia |
| GHCN-Daily · Tlaxcala (MXM00076683) PRCP | by_station | 1981 | 2024 | 1981–1986, 1988–2006, 2013–2014, 2016–2019 | estación (2230 m) | Mismo criterio | Validación de lluvia |
| GHCN-Daily · Tlaxcala (MXM00076683) TMAX/TMIN | by_station | 1981 | 2021 | 1981–1986, 1988–2005 | estación (2230 m) | Mismo criterio | Validación de temperatura |
| GHCN-Daily · 26 estaciones SMN en el valle de Tehuacán | ghcnd-inventory | 1942 | 2009 | ninguna después de 2009 | estaciones | Inventario NCEI, caja 18.2–18.8 N, 97.1–97.7 W | Sin validación posible 2001–2024 |
| SWOT (NASA/CNES/ASC) | Elevación de agua superficial | 2023-07 | vigente | 2023–2025 | franja ~120 km, píxeles decamétricos | ASC: lanzamiento 2022-12-16 | Fuera del MVP |
| RADARSAT Constellation Mission | SAR banda C (datos abiertos parciales) | 2019-06 | vigente | 2020–2025 | 3–100 m según modo | CKAN ASC: licencia OGL-Canada | Fuera del MVP |
| Ventana común calculada (POWER ∩ IMERG ∩ MOD13A3) | resolveCommonMonthlyWindow (código del repo) | 2001-01 | 2024-12 | 2001–2024 | — | Ejecutado con node sobre manifiestos reales; 2025 se excluye porque IMERG llega a 2025-09 | Ventana de comparación |

Ventana común POWER ∩ IMERG ∩ MOD13A3 calculada con `resolveCommonMonthlyWindow` del repositorio: **2001-01 a 2024-12** (24 años). Para comparar solo POWER e IMERG podría usarse 1998–2024 pasando `minimumStartYear = 1998`.

## 10. Contrato para la interfaz

### 10.1 Reglas de presentación

1. **Soporte:** mostrar “celda NASA POWER 0.5° × 0.625° (≈ 55 × 65 km), elevación media N m”. No decir “temperatura de Puebla”.
2. **Ventana:** toda pendiente lleva su ventana y su modo (`native`, `common`, `fixed`).
3. **Robustez:** no usar “robusta” ni “significativa” si `trend.autocorrelation.flagged === true`, si p ≥ 0.05 o si la variable no es apta. Mientras el backend no publique Hamed–Rao, mostrar el p de Mann–Kendall como “sin corregir”.
4. **No detectable ≠ sin cambio:** con p ≥ 0.05, decir “no se detecta tendencia con estos datos”. Cuando exista `minimumDetectableTrend`, mostrarlo.
5. **Lluvia:** no mostrar flecha de tendencia ni texto de aumento/disminución. Mostrar la serie y la advertencia de que el signo depende de la ventana.
6. **Máxima/mínima:** si se exponen, rotular “máxima media diaria” y “mínima media diaria” (endpoint diario) o “día más caluroso / noche más fría del mes” (endpoint mensual). Nunca “temperatura máxima” sin calificar.
7. **Años:** ubicar los puntos por año (no por índice) y escalar el eje al rango de datos (hoy el eje Y se fuerza a incluir 0).
8. **Texto de completitud:** el gráfico dice “at least 90% monthly coverage”; cuando el backend aplique 12/12 debe decir “years with all 12 months”.
9. Sin pronósticos, causalidad ni alertas.

### 10.2 Campos propuestos para el backend (no implementados)

```ts
type TrendResultV2 = TrendResult & {
  hamedRao: { pValue: number | null; varianceFactor: number | null }
  tfpw: { pValue: number | null; lag1: number | null }
  senConfidenceInterval95: [number, number] | null
  blockBootstrapInterval95: [number, number] | null
  minimumDetectableTrend: number | null      // misma unidad que slopePerYear
  family: 'primary' | 'exploratory'
  qValue: number | null                      // BH dentro de la familia
  robustness: { R1: boolean; R2: boolean; R3: boolean; R4: boolean; R5: boolean; score: number }
  verdict: 'robust' | 'probable' | 'weak' | 'not-detectable' | 'robust-but-not-fit'
}
type VariableDescriptor = {
  id: string; displayName: string; unit: string
  aggregation: 'day-weighted-mean' | 'sum' | 'max' | 'min' | 'count' | 'percent-days'
  fitness: 'core' | 'thermal-extreme' | 'support' | 'low-confidence' | 'unreliable' | 'suspect'
  sourceEndpoint: 'power-monthly' | 'power-daily'
}
type SpatialSupport = { type: 'grid-cell'; centerLat: number; centerLon: number; dLat: 0.5; dLon: 0.625; meanElevationM: number }
```

## 11. Prioridades backend revisadas

1. Corregir A1 (exigir 12/12) con su prueba, A5 (`Object.hasOwn`) y A6 (no ocultar 4xx). Actualizar `methodology.md`.
2. Integrar Guillermo en main para que la interfaz reciba `trend.autocorrelation`.
3. Añadir TX y TN desde el endpoint diario (no desde el mensual) y el diccionario de variables con clase de aptitud.
4. Hamed–Rao como p principal, TFPW como sensibilidad, IC de Sen e IC por bootstrap de bloques; publicar `minimumDetectableTrend`; exigir n ≥ 10.
5. Derivar el último año completo de `header.end`; manifiesto con inicio real por variable.
6. Adaptador IMERG Final V07 (1998-01 a 2025-09 hoy) y endpoint multi-fuente con `resolveCommonMonthlyWindow` y BH por familia declarada.
7. Validación de lluvia con GHCN (aeropuerto MXM00076685, Tlaxcala MXM00076683) en días emparejados; Tehuacán no tiene estaciones después de 2009.
8. AppEEARS MOD13Q1/MOD13A3 con VI Quality y máscara urbana MCD12Q1; no empalmar con VIIRS (entrega de S-NPP terminó el 2026-11-02).
9. Contraste de humedad de suelo con GLDAS 2.1 vía Hydrology Time Series.
10. Mostrar la huella de la celda y estratificar con NASADEM.

## 12. Correcciones respecto a la versión anterior

| # | Tema | Antes | Ahora |
|---|---|---|---|
| C1 | T2M_MAX / T2M_MIN | “Tmin Puebla +0.69 °C/década” con el T2M_MIN mensual de POWER. | Ese valor es el promedio de las noches más frías de cada mes. La mínima media diaria (TN) sube +0.52 °C/década en Puebla y +0.54 en Tehuacán. |
| C2 | Unidad de radiación | ALLSKY_SFC_SW_DWN en kWh/m²/día. | La API devuelve MJ/m²/día. |
| C3 | Cobertura de IMERG | IMERG desde 2000-06. | IMERG Final V07 mensual cubre 1998-01 a 2025-09 (333 gránulos en CMR). |
| C4 | Referencias de código | trend.ts:521 y route.ts:749. | lib/analysis/trend.ts:112 y app/api/series/route.ts:35. |
| C5 | Gravedad del umbral 11/12 | Error que hoy sesga la lluvia. | Error latente: no afecta a POWER hoy; se activa con MODIS 2000, IMERG 2025 o un diciembre no publicado. |
| C6 | Criterio de robustez | p compuesto ad hoc y una sola familia de 56 pruebas. | Familia primaria declarada (12 hipótesis) y exploratoria, con cinco criterios explícitos y aptitud de la variable. |
| C7 | Nubes y radiación | Salto atribuido al cambio de producto en 2001. | El cambio ocurre en 1996–1998 dentro de la era SRB/ISCCP; después de 2001 no hay tendencia. |
| C8 | Lluvia en Tehuacán | Marcada “robusta” en 1981–2024. | Depende del año de inicio (quiebre ~1999), las estaciones muestran poca habilidad interanual de POWER: no concluyente. |
| C9 | Viento, presión y nubes | Marcados “robustos”. | Clasificados como no aptos para afirmar tendencias. |
| C10 | Hydrology Data Rods | Tratado como servicio vigente. | Ahora se llama Hydrology Time Series; el endpoint antiguo redirige a un aviso de retiro. |
| C11 | Soporte del punto | “Celda aproximada”. | Verificado: el punto es exactamente la celda MERRA-2 más cercana. |
| C12 | Número de pruebas | “El handoff dice 12 y el commit 11”. | Ambos eran correctos en su commit: 26300d3 tenía 11 y 741fa44 añadió 1. |
| C13 | Validación con estaciones | Solo inventario de cobertura. | Comparación cuantitativa POWER–GHCN de lluvia, TMAX y TMIN. |

## 13. Reproducción

- Scripts: `docs/backend/analysis/` (`stats.py`, `analyze_v2.py`, `build_meta.py`, `build_report.py`), Python 3 estándar sin dependencias. Instrucciones y URL de descarga en `docs/backend/analysis/README.md`.
- Datos crudos (no versionados, ~7 MB más el inventario GHCN de ~35 MB): respuestas de NASA POWER y archivos de NOAA GHCN-Daily descargados el 2026-11-14.
- Las funciones del repositorio se ejecutaron sobre los mismos datos con Node 26 (copia fuera del proyecto) para producir la tabla de la sección 4; su resultado está en `data/ts_results.json` de la carpeta de trabajo.

