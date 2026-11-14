# Datos de referencia del backend (instantánea 2026-11-14)

Archivos JSON con la forma `{"rows": [...], "meta": [...]}`. `rows` es una lista de objetos; `meta` indica fuente y método. Los generan los scripts de `docs/backend/analysis/` a partir de NASA POWER (API v2.10.0) y NOAA GHCN-Daily.

Son referencia y datos de ejemplo para construir la interfaz. En producción la interfaz consume `GET /api/series`; estos archivos no se sirven desde `public/`.

Convenciones: pendientes por década; valores `null` cuando no son estimables; p-valores entre 0 y 1; texto en español.

## `catalog.json` · Diccionario de variables

Definición, fuente, agregación anual, unidad y clase de aptitud de las 35 variables.

Filas: 35. Clave: `id`.

| Columna | Significado |
|---|---|
| `id` | Clave de fila |
| `nombre` | Nombre para mostrar |
| `fuente` | Fuente o endpoint |
| `resolucion_nativa` | Resolución temporal nativa |
| `agregado_anual` | Regla de agregación anual |
| `unidad` | Unidad de la variable; las pendientes van en unidad por década |
| `clase` | Clase de aptitud (Núcleo, Extremo térmico, Apoyo, baja confianza, no fiable, Sospechosa) |
| `definicion` | Definición y advertencias |
| `inicio` | Primer año/periodo |
| `fin` | Último año/periodo |

## `tests.json` · Pruebas de tendencia

Una fila por sitio × variable × ventana (138). Pendientes por década en la unidad de la variable.

Filas: 138. Clave: `id`.

| Columna | Significado |
|---|---|
| `id` | Clave de fila |
| `sitio` | Puebla o Tehuacán (celda POWER) |
| `variable` | Id del diccionario (catalog.json) |
| `nombre` | Nombre para mostrar |
| `clase` | Clase de aptitud (Núcleo, Extremo térmico, Apoyo, baja confianza, no fiable, Sospechosa) |
| `unidad` | Unidad de la variable; las pendientes van en unidad por década |
| `ventana` | 1981-2024 o 2001-2024 |
| `familia` | primaria (12 hipótesis declaradas) o exploratoria |
| `n` | Años usados |
| `media` | Media de la serie |
| `de` | Desviación estándar interanual |
| `pendiente_decada` | Pendiente OLS por década |
| `ic_ols_lo` | IC 95% OLS clásico (inferior) |
| `ic_ols_hi` | IC 95% OLS clásico (superior) |
| `ic_bloque_lo` | IC 95% por bootstrap de bloques móviles (inferior) |
| `ic_bloque_hi` | IC 95% por bootstrap de bloques móviles (superior) |
| `bloque` | Longitud del bloque (años) |
| `sen_decada` | Pendiente de Sen por década |
| `ic_sen_lo` | IC 95% de Sen (Gilbert, inferior) |
| `ic_sen_hi` | IC 95% de Sen (Gilbert, superior) |
| `tau` | Tau de Kendall |
| `p_ols` | p de t para la pendiente OLS (supone independencia) |
| `p_mk` | p de Mann–Kendall sin corregir |
| `p_hamed_rao` | p de Mann–Kendall modificado (Hamed y Rao): p principal |
| `factor_hr` | Factor de inflación de varianza de Hamed–Rao |
| `p_tfpw` | p con pre-blanqueo libre de tendencia (Yue et al.) |
| `q_bh` | q de Benjamini–Hochberg dentro de la familia |
| `r1` | Autocorrelación lag-1 de los residuos OLS |
| `r2` | R² de la recta |
| `cambio_estandar` | Pendiente × (n − 1) ÷ σ de residuos |
| `tendencia_minima_detectable` | Pendiente por década detectable con 80% de potencia (α = 0.05, AR(1)) |
| `razon_detectabilidad` | |pendiente| ÷ tendencia mínima detectable |
| `pettitt_anio` | Primer año del nuevo nivel según Pettitt (sensible a tendencias) |
| `pettitt_p` | p de Pettitt |
| `pettitt_antes` | Media antes del cambio |
| `pettitt_despues` | Media después del cambio |
| `quiebre_residual_anio` | Año del cambio de nivel en los residuos (salto no explicado por la tendencia) |
| `quiebre_residual_p` | p de Pettitt sobre residuos |
| `jackknife_signo` | Fracción de eliminaciones de un año que conservan el signo |
| `jackknife_sig` | Fracción de eliminaciones con p Hamed–Rao < 0.05 |
| `jackknife_min_decada` | Pendiente mínima al eliminar un año |
| `jackknife_max_decada` | Pendiente máxima al eliminar un año |
| `sin_ultimo_anio_decada` | Pendiente sin el último año |
| `sin_ultimo_anio_p_hr` | p Hamed–Rao sin el último año |
| `R1_q` | Criterio R1: q < 0.05 |
| `R2_bloque` | Criterio R2: IC por bloques excluye 0 |
| `R3_tfpw` | Criterio R3: TFPW p < 0.05 |
| `R4_jackknife` | Criterio R4: jackknife estable |
| `R5_otra_ventana` | Criterio R5: mismo signo y p < 0.10 en la otra ventana |
| `criterios` | Criterios cumplidos (0–5) |
| `apta` | La variable es apta para afirmar tendencias |
| `veredicto` | Robusta, Probable, Débil, Sin tendencia detectable o Robusta estadísticamente, variable no apta |

## `annual.json` · Series anuales

Valor anual de cada variable por celda (Puebla, Tehuacán), 1981–2025. Solo años completos.

Filas: 3096. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `sitio` | Puebla o Tehuacán (celda POWER) |
| `variable` | Id del diccionario (catalog.json) |
| `anio` | Año |
| `valor` | Valor anual |
| `unidad` | Unidad de la variable; las pendientes van en unidad por década |

## `monthly_trends.json` · Tendencia por mes calendario

Pendiente de Sen por década de cada mes (TN, TX, T2M, PRECTOTCORR).

Filas: 192. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `sitio` | Puebla o Tehuacán (celda POWER) |
| `variable` | Id del diccionario (catalog.json) |
| `ventana` | 1981-2024 o 2001-2024 |
| `mes` | Mes (1–12) o YYYY-MM |
| `n` | Años usados |
| `sen_decada` | Pendiente de Sen por década |
| `ic_lo` | IC 95% inferior por década |
| `ic_hi` | IC 95% superior por década |
| `p_hamed_rao` | p de Mann–Kendall modificado (Hamed y Rao): p principal |
| `unidad` | Unidad de la variable; las pendientes van en unidad por década |

## `sweep.json` · Sensibilidad al año de inicio

Pendiente OLS desde cada año de inicio (1981–2009) hasta 2024.

Filas: 696. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `sitio` | Puebla o Tehuacán (celda POWER) |
| `variable` | Id del diccionario (catalog.json) |
| `inicio` | Primer año/periodo |
| `fin` | Último año/periodo |
| `n` | Años usados |
| `pendiente_decada` | Pendiente OLS por década |
| `ic_lo` | IC 95% inferior por década |
| `ic_hi` | IC 95% superior por década |
| `p_hamed_rao` | p de Mann–Kendall modificado (Hamed y Rao): p principal |
| `unidad` | Unidad de la variable; las pendientes van en unidad por década |

## `spatial.json` · Coherencia espacial

Pendiente por celda MERRA-2 (24 celdas, 17.75–20.75 N, 96.75–99.25 W).

Filas: 288. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `variable` | Id del diccionario (catalog.json) |
| `ventana` | 1981-2024 o 2001-2024 |
| `lat` | Latitud del centro de la celda |
| `lon` | Longitud del centro de la celda |
| `elevacion` | Elevación media de la celda (m) |
| `ciudad` | Ciudad que cae en la celda |
| `media` | Media de la serie |
| `sen_decada` | Pendiente de Sen por década |
| `ols_decada` | Pendiente OLS por década |
| `p_hamed_rao` | p de Mann–Kendall modificado (Hamed y Rao): p principal |
| `q_campo` | q de BH entre las 24 celdas (significativa si < 0.10) |

## `station_stats.json` · Comparación con estaciones

POWER frente a GHCN-Daily en días emparejados (meses con ≥ 80% de días válidos).

Filas: 6. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `estacion` | Nombre de la estación |
| `ghcn` | Id GHCN-Daily |
| `elemento` | PRCP, TMAX o TMIN |
| `celda` | Celda POWER comparada |
| `elev_estacion` | Elevación de la estación (m) |
| `elev_celda` | Elevación de la celda (m) |
| `meses_validos` | Meses con ≥ 80% de días válidos |
| `primer_mes` | Primer mes válido |
| `ultimo_mes` | Último mes válido |
| `r_mensual` | Correlación de valores mensuales |
| `r_anomalias` | Correlación de anomalías mensuales |
| `r_diario` | Correlación diaria |
| `razon_power_estacion` | Suma POWER ÷ suma estación |
| `sesgo_medio` | Media de POWER − estación |
| `unidad` | Unidad de la variable; las pendientes van en unidad por década |
| `dias_humedos_estacion` | % de días ≥ 1 mm en la estación |
| `dias_humedos_power` | % de días ≥ 1 mm en POWER |
| `anios_completos` | Años con 12 meses válidos |
| `anios` | Rango de años completos |
| `sen_estacion_decada` | Sen de la estación por década |
| `p_hr_estacion` | p Hamed–Rao de la estación |
| `sen_power_decada` | Sen de POWER por década |
| `p_hr_power` | p Hamed–Rao de POWER |
| `sen_diferencia_decada` | Sen de (POWER − estación) por década |
| `p_hr_diferencia` | p de la tendencia de la diferencia |
| `r_anual` | Correlación anual |
| `nota` | Observación |
| `sesgo_esperado_altitud` | Sesgo esperado por gradiente de 6.5 °C/km |

## `station_pairs.json` · Pares mensuales estación–POWER

Valores mensuales emparejados de PRCP y TMIN.

Filas: 1200. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `estacion` | Nombre de la estación |
| `elemento` | PRCP, TMAX o TMIN |
| `mes` | Mes (1–12) o YYYY-MM |
| `estacion_valor` | Valor mensual de la estación |
| `power_valor` | Valor mensual de POWER en los mismos días |

## `climatology.json` · Climatología 1991–2020

Medias mensuales por celda.

Filas: 24. Clave: `key`.

| Columna | Significado |
|---|---|
| `key` | Clave de fila (campos unidos con |) |
| `sitio` | Puebla o Tehuacán (celda POWER) |
| `mes` | Mes (1–12) o YYYY-MM |
| `T2M` | Temperatura media (°C) |
| `TX` | Máxima media diaria (°C) |
| `TN` | Mínima media diaria (°C) |
| `PREC` | Lluvia media mensual (mm) |
| `TXx_mes` | Promedio del máximo absoluto mensual (°C) |
| `TNn_mes` | Promedio del mínimo absoluto mensual (°C) |

## `coverage.json` · Cobertura de fuentes

Periodo verificado de cada fuente y ventana común calculada con el código del repositorio.

Filas: 14. Clave: `id`.

| Columna | Significado |
|---|---|
| `id` | Clave de fila |
| `fuente` | Fuente o endpoint |
| `producto` | Producto y versión |
| `inicio` | Primer año/periodo |
| `fin` | Último año/periodo |
| `anios_completos` | Años con 12 meses válidos |
| `resolucion` | Resolución espacial |
| `verificado` | Cómo se verificó |
| `papel` | Papel en EarthScope |

## `audit.json` · Revisión del pipeline

Hallazgos sobre el código con archivo, evidencia, impacto y acción.

Filas: 17. Clave: `id`.

| Columna | Significado |
|---|---|
| `id` | Clave de fila |
| `severidad` | Alta, Media, Baja o — |
| `estado` | Error activo, Error latente, Trampa de diseño, Advertencia, Pendiente, Correcto… |
| `archivo` | Archivo y línea |
| `area` | Área |
| `hallazgo` | Hallazgo |
| `evidencia` | Evidencia |
| `impacto` | Impacto actual |
| `accion` | Acción recomendada |

## `sources.json` · Fuentes evaluadas

Evaluación de cada fuente o herramienta externa.

Filas: 14. Clave: `id`.

| Columna | Significado |
|---|---|
| `id` | Clave de fila |
| `fuente` | Fuente o endpoint |
| `tipo` | Producto, herramienta o referencia |
| `acceso` | Cómo se accede |
| `verificado` | Cómo se verificó |
| `producto` | Producto y versión |
| `cobertura` | Cobertura temporal/espacial |
| `uso` | Uso recomendado |
| `limitaciones` | Limitaciones |
| `prioridad` | Prioridad |

## `corrections.json` · Correcciones

Errores de la versión 1 de la auditoría y su corrección.

Filas: 13. Clave: `id`.

| Columna | Significado |
|---|---|
| `id` | Clave de fila |
| `tema` | Tema |
| `antes` | Lo que decía la versión 1 |
| `ahora` | Corrección |
