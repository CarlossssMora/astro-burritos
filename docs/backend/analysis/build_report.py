"""Generates frontend-data-handoff.md (v2) from the analysis outputs so every number matches the data."""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
B = sys.argv[1]; OUT = f'{B}/v2/out'; DEST = sys.argv[2]
L = lambda n: json.load(open(f'{OUT}/{n}.json', encoding='utf-8'))['rows']
tests = L('tests'); T = {r['id']: r for r in tests}; cat = L('catalog'); aud = L('audit'); src = L('sources'); cov = L('coverage'); corr = L('corrections')
st = L('station_stats'); sp = L('spatial'); mt = L('monthly_trends'); sw = L('sweep')
summ = json.load(open(f'{OUT}/_summary.json', encoding='utf-8'))
ts = json.load(open(f'{B}/data/ts_results.json', encoding='utf-8'))
def f(v, d=2, sign=False):
    if v is None: return '—'
    if d == 'p': return '<0.0001' if v < 0.0001 else f'{v:.4f}'
    s = f'{v:.{d}f}'; return ('+' + s) if sign and v > 0 else s
def cell(s): return str(s).replace('|', '\\|').replace('\n', ' ')
def table(headers, rows):
    out = ['| ' + ' | '.join(headers) + ' |', '|' + '|'.join(['---'] * len(headers)) + '|']
    out += ['| ' + ' | '.join(cell(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)
t = lambda s, v, w: T[f'{s}|{v}|{w}']
S = {r['key']: r for r in st}
md = []
A = md.append

A('# EarthScope · handoff de datos y backend (v2)')
A('')
A('Corte: 2026-11-14. Base de código revisada: `origin/Guillermo @741fa44` (backend) y `origin/main @2996ebc` (frontend; revalidado en `477e99a`, que solo cambia el globo, CSS y el lockfile). Este documento sustituye al handoff de `26300d3`/`741fa44` y a la versión 1 de esta auditoría.')
A('')
A('**Para el agente de interfaz:** empezar por la sección 2 (dónde está cada archivo) y seguir con 1, 5, 6 y 10: qué significa cada campo, cómo rotularlo y qué no afirmar. **Para el backend:** las secciones 2, 3, 4, 7, 8, 9 y 11 son la referencia de qué está bien, qué falla y en qué orden integrar. La sección 12 lista lo que se corrigió de la versión anterior.')
A('')
A('Dashboard interactivo con los mismos datos (privado; pedir acceso al dueño del enlace): https://claude.ai/artifact/455m7zHPzENf2CJSE6e2Sc')
A('')
A('## 1. Resumen ejecutivo')
A('')
prim = [r for r in tests if r['familia'] == 'primaria']
rob = [r for r in prim if r['veredicto'] == 'Robusta']
A(f"- En la ventana común **2001–2024**, **{len(rob)} de {len(prim)}** hipótesis primarias son robustas y **todas son de temperatura**: " + ', '.join(f"{r['sitio']} {r['variable']} {f(r['pendiente_decada'],2,True)} °C/década" for r in rob) + '.')
A(f"- **Ninguna tendencia de precipitación es publicable.** Puebla anual {f(t('puebla','PRECTOTCORR','2001-2024')['pendiente_decada'],0,True)} mm/década (q = {f(t('puebla','PRECTOTCORR','2001-2024')['q_bh'],3)}), con tendencia mínima detectable de {f(t('puebla','PRECTOTCORR','2001-2024')['tendencia_minima_detectable'],0)} mm/década; el signo cambia según el año de inicio y POWER casi no reproduce la variación interanual de las estaciones (r anual {S['MXM00076685|PRCP']['r_anual']} y {S['MXM00076683|PRCP']['r_anual']}).")
A('- **Hallazgo crítico de semántica:** `T2M_MAX` y `T2M_MIN` del endpoint mensual de POWER son el **extremo absoluto del mes**, no la media. La “Tmin +0.69 °C/década” de la versión anterior era el promedio de las noches más frías de cada mes. Las medias diarias (TX, TN) se calculan con el endpoint diario.')
A(f"- El pipeline actual (POWER → agregación anual → OLS/MK/Sen) es **correcto en sus cálculos**: el código del repositorio ejecutado sobre datos reales coincide con una implementación independiente y el agregado anual reproduce el anual `YYYY13` de POWER. Hay un **error latente** (umbral 11/12 meses), dos errores menores activos y varias limitaciones de inferencia.")
A(f"- Coherencia regional: en 2001–2024 la temperatura media sube en las **24 de 24** celdas MERRA-2 alrededor de Puebla; la lluvia sube en 12 y baja en 12.")
A(f"- Validación con estaciones (Tlaxcala, 1981–2005): la máxima de POWER reproduce la tendencia de la estación ({f(S['MXM00076683|TMAX']['sen_power_decada'],2,True)} vs {f(S['MXM00076683|TMAX']['sen_estacion_decada'],2,True)} °C/década); la mínima sube cuatro veces más rápido en la estación ({f(S['MXM00076683|TMIN']['sen_estacion_decada'],2,True)} vs {f(S['MXM00076683|TMIN']['sen_power_decada'],2,True)}).")
A('')
A('## 2. Dónde está cada archivo')
A('')
A('### 2.1 Incluidos en este commit')
A('')
A(table(['Ruta', 'Qué contiene', 'Uso en la interfaz'], [['docs/backend/frontend-data-handoff.md', 'Este documento', 'Contrato, reglas de presentación y estado del backend'], ['docs/backend/data/README.md', 'Esquema de cada archivo JSON: clave de fila y significado de cada columna', 'Leer antes de usar cualquier JSON'], ['docs/backend/data/catalog.json', 'Diccionario de las 35 variables: nombre, unidad, agregación, clase de aptitud y definición', 'Rotular variables y decidir cuáles se pueden presentar como tendencia'], ['docs/backend/data/tests.json', '138 pruebas (sitio × variable × ventana) con pendiente, IC, p, q, tendencia mínima detectable y veredicto', 'Indicadores, matriz de variables y textos de robustez'], ['docs/backend/data/annual.json', 'Series anuales de las 35 variables por celda, 1981–2025', 'Gráficas de series y datos de ejemplo'], ['docs/backend/data/monthly_trends.json', 'Tendencia por mes calendario de TN, TX, T2M y lluvia', 'Vista estacional'], ['docs/backend/data/sweep.json', 'Pendiente según el año de inicio (1981–2009 a 2024)', 'Vista de sensibilidad a la ventana'], ['docs/backend/data/spatial.json', 'Pendiente y q de campo de las 24 celdas MERRA-2 alrededor de Puebla', 'Mapa de coherencia regional'], ['docs/backend/data/station_stats.json', 'Comparación POWER–GHCN (correlaciones, sesgos, tendencias)', 'Panel de validación'], ['docs/backend/data/station_pairs.json', 'Pares mensuales estación–POWER', 'Dispersión de validación'], ['docs/backend/data/climatology.json', 'Climatología 1991–2020 de cada celda', 'Contexto estacional'], ['docs/backend/data/coverage.json', 'Cobertura verificada de cada fuente y ventana común', 'Línea de tiempo de fuentes'], ['docs/backend/data/audit.json', 'Hallazgos del pipeline (sección 4)', 'Referencia; no se muestra al usuario final'], ['docs/backend/data/sources.json', 'Evaluación de las fuentes externas (sección 9)', 'Panel de procedencia'], ['docs/backend/data/corrections.json', 'Correcciones respecto a la versión 1 de la auditoría', 'Referencia'], ['docs/backend/analysis/', 'Scripts en Python estándar que generan los JSON y este documento', 'No se usa en la interfaz; implementación de referencia para el backend']]))
A('')
A('Los JSON son una instantánea del 2026-11-14 con la forma `{rows, meta}`. Sirven de referencia y de datos de ejemplo; la interfaz en producción debe consumir la API, no estos archivos.')
A('')
A('### 2.2 Código que define o consume el contrato')
A('')
A(table(['Ruta', 'Rama', 'Para qué'], [['lib/nasa/types.ts', 'Guillermo (en main falta autocorrelation)', 'Tipos NasaPowerResult, AnnualObservation, TrendResult (incluye autocorrelation) y ClimateAnalysis: forma exacta de la respuesta'], ['app/api/series/route.ts', 'Guillermo y main', 'Endpoint GET /api/series: parámetros, validación y códigos 400/502'], ['app/api/climate/route.ts', 'Guillermo y main', 'Alias del mismo endpoint'], ['lib/nasa/client.ts', 'Guillermo y main', 'Consulta a POWER, filtro de relleno y processingNotes'], ['lib/analysis/trend.ts', 'Guillermo y main', 'Agregación anual y OLS: significado de annual[] y de los campos de trend'], ['lib/analysis/robust-trend.ts', 'Guillermo (en main falta el diagnóstico de autocorrelación)', 'Mann–Kendall, Sen y diagnóstico de autocorrelación'], ['lib/analysis/common-window.ts', 'Solo Guillermo', 'Ventana común entre fuentes (native, common, fixed)'], ['lib/analysis/multiple-testing.ts', 'Solo Guillermo', 'Benjamini–Hochberg'], ['lib/analysis/types.ts', 'Guillermo (en main falta TemporalWindow)', 'Contrato futuro multi-fuente: EarthScopeDataBundle, CanonicalSeries, TemporalWindow'], ['components/app-shell.tsx', 'main (vigente)', 'Llama a /api/series con SWR'], ['components/trend-chart.tsx', 'main (vigente)', 'Gráfica anual: usa annual[], slopePerYear e intercept (ver notas en 10.1)'], ['components/evidence-panel.tsx', 'main (vigente)', 'Panel estadístico y de procedencia'], ['components/variable-selector.tsx, period-picker.tsx, location-selector.tsx', 'main (vigente)', 'Controles de variable, periodo (2001–2024) y ubicación'], ['lib/geo.ts', 'Solo main', 'Fronteras Natural Earth y proyección del mapa 2D (no sirven para agregación científica)'], ['docs/science/methodology.md, docs/science/validation-protocol.md', 'Guillermo', 'Protocolo científico (methodology.md aún dice 90%, ver A1)']]))
A('')
A('La interfaz vigente está en `main`; los componentes de la rama Guillermo son una versión anterior. Los tipos con `autocorrelation`, la ventana común y BH solo existen en Guillermo.')
A('')
A('## 3. Estado del código')
A('')
A('### 3.1 Ramas')
A('')
A('- `origin/Guillermo` (741fa44) contiene el backend completo: `lib/analysis/{trend,robust-trend,common-window,multiple-testing,types}.ts`, `lib/nasa/{client,types}.ts`, `app/api/series/route.ts`, 12 pruebas.')
A('- `origin/main` (2996ebc) **no** contiene 26300d3 ni 741fa44: le faltan `common-window.ts`, `multiple-testing.ts`, el diagnóstico de autocorrelación y el campo `trend.autocorrelation`. main sí tiene la interfaz nueva (globo, `lib/geo.ts`, selector país/estado).')
A('- Antes de que la interfaz consuma `trend.autocorrelation` hay que integrar Guillermo en main.')
A('- Revalidado el 2026-11-14: `origin/main` avanzó a `477e99a` (globo, CSS y lockfile). Sigue sin contener 26300d3 ni 741fa44, y `components/trend-chart.tsx` y `components/evidence-panel.tsx` no cambiaron.')
A('')
A('### 3.2 Endpoint vigente')
A('')
A('```text\nGET /api/series?latitude={lat}&longitude={lon}&startYear={yyyy}&endYear={yyyy}&variable=temperature|precipitation\n```')
A('')
A('Consulta POWER Monthly Point (`community=AG`, `time-standard=LST`), descarta `YYYY13`, −999 y no numéricos, agrega por año (media ponderada por días o suma mm/día × días) y calcula OLS, IC 95%, p de t, Mann–Kendall con empates, Sen y autocorrelación lag-1 de residuos. `/api/climate` reexporta el mismo handler.')
A('')
A('### 3.3 Campos que la interfaz en main consume hoy')
A('')
A('`analysis.annual[]` (año, valor, unidad, conteo, completitud), `analysis.observations[]` (exportación CSV), `trend.slopePerYear`, `trend.intercept`, `trend.senSlopePerYear`, `trend.confidenceInterval95`, `trend.pValue`, `trend.mannKendall.pValue/significantAt05`, `trend.significantAt05`, `trend.nYears`, `trend.completeness`, `trend.method`, `trend.warnings`, `productVersion`, `sourceModel`, `timeStandard`, `retrievedAt`, `coverage`, `missingCount`, `period`.')
A('')
A('## 4. Verificación del pipeline')
A('')
A('Método: lectura del código y ejecución de las funciones del repositorio (copia fuera del proyecto, Node 26 con eliminación de tipos) sobre las respuestas reales de POWER, comparando con una implementación independiente en Python.')
A('')
cmp = [(r['site'], r['parameter'], r['window'], r['slope'], r['p'], r['mkP']) for r in ts['trends']]
A(table(['Sitio', 'Parámetro', 'Ventana', 'Pendiente/año (repo)', 'p OLS (repo)', 'p MK (repo)', 'Pendiente/año (auditoría)', 'p OLS (auditoría)'],
        [[s, p, w, f(sl, 5), f(pv, 'p'), f(mk, 'p'), f(T[f"{s}|{'T2M' if p=='T2M' else 'PRECTOTCORR'}|{w}"]['pendiente_decada']/10, 5), f(T[f"{s}|{'T2M' if p=='T2M' else 'PRECTOTCORR'}|{w}"]['p_ols'], 'p')] for s, p, w, sl, pv, mk in cmp]))
A('')
A('Coinciden. Hallazgos:')
A('')
A(table(['#', 'Severidad', 'Estado', 'Archivo', 'Hallazgo', 'Evidencia', 'Impacto actual', 'Acción'],
        [[r['id'], r['severidad'], r['estado'], r['archivo'], r['hallazgo'], r['evidencia'], r['impacto'], r['accion']] for r in aud]))
A('')
A('## 5. Semántica de NASA POWER (verificada)')
A('')
A('| Hecho | Evidencia | Consecuencia |')
A('|---|---|---|')
A('| El “punto” es la celda MERRA-2 nativa más cercana (0.5° lat × 0.625° lon), sin interpolación. | Los valores del endpoint de punto son idénticos a los de la celda (19.0 N, −98.125 W) del endpoint regional. | Rotular “celda POWER ≈ 55 × 65 km”, nunca “la ciudad”. |')
A('| Elevación de celda: Puebla 2147 m, Tehuacán 2064 m, Tlaxcala 2517 m. | `geometry.coordinates[2]` de la respuesta. | Tehuacán (≈1680 m) queda 380 m por debajo de su celda: la celda describe la sierra. |')
A('| `T2M_MAX`/`T2M_MIN` mensuales = máximo/mínimo absoluto del mes. | 528 meses por sitio: diferencia 0.000 con el extremo diario y 3.3–4.2 °C con la media diaria. | Para medias usar el endpoint diario. Si se usa el mensual, rotular TXx/TNn. |')
A('| `T2M_RANGE` mensual = media del rango diario (máx − mín). | Coincide con la media de (T2M_MAX − T2M_MIN) diarios. | Es una media; se puede agregar con ponderación por días. |')
A('| `YYYY13` de `T2M_MAX`/`T2M_MIN` es el extremo anual. | Igual al máximo/mínimo de los 12 meses. | Nunca usarlo como media anual. |')
A('| Unidades reales: T en C, lluvia en mm/day, radiación en **MJ/m^2/day**, humedad de suelo en fracción 1. | `parameters[*].units`. | Leer la unidad de la respuesta, no fijarla en código. |')
A('| Radiación y nubes empiezan en 1984 (−999 en 1981–1983). Fuentes del encabezado: SRB, SYN1DEG, MERRA2. | Respuesta mensual. | El manifiesto debe declarar el inicio real por variable. |')
A('| La respuesta incluye `header.start` y `header.end` (hoy 19810101–20251231). | Encabezado. | Derivar el último año completo de ahí, no del reloj. |')
A('| POWER mensual ya trae los 12 meses de 2025. | Respuesta. | Para comparar con IMERG la ventana termina en 2024 (IMERG llega a 2025-09). |')
A('')
A('## 6. Diccionario de variables')
A('')
A('Clases: **Núcleo** (publicables), **Extremo térmico** (publicables con su definición), **Apoyo** (contexto), **Estacional/Lluvia diaria (baja confianza)**, **Lluvia diaria (no fiable)** (POWER registra el doble de días húmedos que las estaciones) y **Sospechosa** (cambio de producto o reanálisis sin homogeneizar). Solo Núcleo, Extremo térmico y Apoyo son “aptas”.')
A('')
A(table(['Id', 'Nombre', 'Clase', 'Unidad', 'Fuente', 'Agregado anual', 'Definición'], [[c['id'], c['nombre'], c['clase'], c['unidad'], c['fuente'], c['agregado_anual'], c['definicion']] for c in cat]))
A('')
A('## 7. Resultados')
A('')
A('### 7.1 Protocolo')
A('')
A('- Familia **primaria** declarada antes de calcular: 2 sitios × {T2M, TX, TN, T2M_RANGE, PRECTOTCORR, PREC_MJJASO} × 2001–2024 = 12 hipótesis. Familia **exploratoria**: el resto (126 pruebas). Benjamini–Hochberg por separado sobre el p de Hamed–Rao.')
A('- **Robusta** = R1 q < 0.05 · R2 IC por bootstrap de bloques excluye 0 · R3 TFPW p < 0.05 · R4 jackknife conserva el signo siempre y p < 0.05 en ≥ 90% · R5 mismo signo y p < 0.10 en la otra ventana · variable apta.')
A('- Tendencia mínima detectable (80% de potencia, α = 0.05, inflada por AR(1)).')
A('')
A('### 7.2 Familia primaria (2001–2024)')
A('')
A(table(['Sitio', 'Variable', 'Pendiente/década', 'IC bloque 95%', 'Sen [IC]', 'p OLS', 'p Hamed–Rao', 'p TFPW', 'q BH', 'Mín. detectable', 'Criterios', 'Veredicto'],
        [[r['sitio'], r['variable'], f"{f(r['pendiente_decada'],3,True)} {r['unidad']}", f"[{f(r['ic_bloque_lo'],3,True)}, {f(r['ic_bloque_hi'],3,True)}]", f"{f(r['sen_decada'],3,True)} [{f(r['ic_sen_lo'],3,True)}, {f(r['ic_sen_hi'],3,True)}]",
          f(r['p_ols'],'p'), f(r['p_hamed_rao'],'p'), f(r['p_tfpw'],'p'), f(r['q_bh'],'p'), f(r['tendencia_minima_detectable'],3), r['criterios'], r['veredicto']] for r in sorted(prim, key=lambda r: (r['sitio'], r['variable']))]))
A('')
A('### 7.3 Señales robustas en la familia exploratoria (variables aptas)')
A('')
expl = [r for r in tests if r['familia'] == 'exploratoria' and r['veredicto'] == 'Robusta']
A(table(['Sitio', 'Variable', 'Ventana', 'Pendiente/década', 'IC bloque', 'q BH'],
        [[r['sitio'], f"{r['variable']} · {r['nombre']}", r['ventana'], f"{f(r['pendiente_decada'],3,True)} {r['unidad']}", f"[{f(r['ic_bloque_lo'],3,True)}, {f(r['ic_bloque_hi'],3,True)}]", f(r['q_bh'],'p')] for r in sorted(expl, key=lambda r: (r['ventana'], r['sitio'], r['variable']))]))
A('')
noapt = [r for r in tests if r['veredicto'].startswith('Robusta estad')]
A('Pasan los cinco criterios pero **no son aptas** (no presentarlas como tendencia climática): ' + '; '.join(f"{r['sitio']} {r['variable']} {r['ventana']}" for r in noapt) + '.')
A('')
A('### 7.4 ¿En qué meses?')
A('')
def mline(site, var):
    rows = sorted([r for r in mt if r['sitio'] == site and r['variable'] == var and r['ventana'] == '2001-2024'], key=lambda r: r['mes'])
    return ' '.join(f"{'EFMAMJJASOND'[r['mes']-1]}{f(r['sen_decada'],2,True)}{'*' if r['p_hamed_rao'] < 0.05 else ''}" for r in rows)
for s in ('Puebla', 'Tehuacán'):
    for v in ('TN', 'TX'):
        A(f'- {s} {v} 2001–2024 (°C/década, * p < 0.05): {mline(s, v)}')
A('- La mínima se calienta en casi todos los meses; la señal es más fuerte en noviembre–diciembre (temporada seca).')
A('')
A('### 7.5 Sensibilidad al año de inicio')
A('')
def sline(site, var, unit):
    rows = sorted([r for r in sw if r['sitio'] == site and r['variable'] == var], key=lambda r: r['inicio'])[::4]
    return ', '.join(f"{r['inicio']}: {f(r['pendiente_decada'],1 if unit=='mm' else 2,True)}{'*' if r['p_hamed_rao'] < 0.05 else ''}" for r in rows)
for s in ('Puebla', 'Tehuacán'):
    A(f'- {s} PRECTOTCORR (mm/década desde cada inicio hasta 2024): {sline(s, "PRECTOTCORR", "mm")}')
    A(f'- {s} TN (°C/década): {sline(s, "TN", "C")}')
A('- La temperatura conserva signo y significancia con cualquier inicio; la lluvia cambia de signo. En Tehuacán la caída 1981–2024 se debe a una década de 1990 muy húmeda (quiebre de Pettitt ≈ 1999) que puede ser también un cambio del sistema de observación del reanálisis.')
A('')
A('### 7.6 Coherencia espacial (24 celdas, FDR de campo q < 0.10)')
A('')
A(table(['Variable', 'Ventana', 'Celdas', 'Positivas', 'Significativas'], [[r['variable'], r['ventana'], r['celdas'], r['positivas'], r['significativas_fdr10']] for r in summ['spatial_summary']]))
A('')
A('## 8. Validación con estaciones GHCN-Daily')
A('')
A('Días emparejados: solo cuentan los días con dato válido en la estación (sin bandera de calidad); un mes entra con ≥ 80% de días.')
A('')
A(table(['Estación', 'Variable', 'Meses', 'r mensual', 'r anomalías', 'r anual', 'Sesgo POWER − estación', '% días húmedos POWER / estación', 'Años completos', 'Sen estación /déc', 'Sen POWER /déc', 'p diferencia'],
        [[r['estacion'], r['elemento'], r['meses_validos'], r.get('r_mensual', '—'), r.get('r_anomalias', '—'), r.get('r_anual', '—'), f"{r.get('sesgo_medio','—')} {r.get('unidad','')}",
          f"{r.get('dias_humedos_power','—')} / {r.get('dias_humedos_estacion','—')}", r.get('anios', '—'), r.get('sen_estacion_decada', '—'), r.get('sen_power_decada', '—'), r.get('p_hr_diferencia', '—')] for r in st]))
A('')
A('Lectura: POWER es fiable para la **tendencia de la máxima**; para la **mínima** es conservador frente a una estación urbana; para la **lluvia** sirve como climatología, no para tendencias ni índices diarios. El sesgo de −3.8 °C en TMAX de Tlaxcala es mayor que el esperado por altitud (−1.9 °C).')
A('')
A('## 9. Fuentes externas y cobertura verificada')
A('')
A(table(['Fuente', 'Tipo', 'Prioridad', 'Acceso', 'Verificado', 'Producto', 'Cobertura', 'Uso recomendado', 'Limitaciones'],
        [[r['fuente'], r['tipo'], r['prioridad'], r['acceso'], r['verificado'], r['producto'], r['cobertura'], r['uso'], r['limitaciones']] for r in src]))
A('')
A(table(['Fuente', 'Producto', 'Inicio', 'Fin', 'Años completos', 'Resolución', 'Verificación', 'Papel'],
        [[r['fuente'], r['producto'], r['inicio'], r['fin'], r['anios_completos'], r['resolucion'], r['verificado'], r['papel']] for r in cov]))
A('')
A(f"Ventana común POWER ∩ IMERG ∩ MOD13A3 calculada con `resolveCommonMonthlyWindow` del repositorio: **{ts['window']['startMonth']} a {ts['window']['endMonth']}** ({len(ts['window']['completeYears'])} años). Para comparar solo POWER e IMERG podría usarse 1998–2024 pasando `minimumStartYear = 1998`.")
A('')
A('## 10. Contrato para la interfaz')
A('')
A('### 10.1 Reglas de presentación')
A('')
A('1. **Soporte:** mostrar “celda NASA POWER 0.5° × 0.625° (≈ 55 × 65 km), elevación media N m”. No decir “temperatura de Puebla”.')
A('2. **Ventana:** toda pendiente lleva su ventana y su modo (`native`, `common`, `fixed`).')
A('3. **Robustez:** no usar “robusta” ni “significativa” si `trend.autocorrelation.flagged === true`, si p ≥ 0.05 o si la variable no es apta. Mientras el backend no publique Hamed–Rao, mostrar el p de Mann–Kendall como “sin corregir”.')
A('4. **No detectable ≠ sin cambio:** con p ≥ 0.05, decir “no se detecta tendencia con estos datos”. Cuando exista `minimumDetectableTrend`, mostrarlo.')
A('5. **Lluvia:** no mostrar flecha de tendencia ni texto de aumento/disminución. Mostrar la serie y la advertencia de que el signo depende de la ventana.')
A('6. **Máxima/mínima:** si se exponen, rotular “máxima media diaria” y “mínima media diaria” (endpoint diario) o “día más caluroso / noche más fría del mes” (endpoint mensual). Nunca “temperatura máxima” sin calificar.')
A('7. **Años:** ubicar los puntos por año (no por índice) y escalar el eje al rango de datos (hoy el eje Y se fuerza a incluir 0).')
A('8. **Texto de completitud:** el gráfico dice “at least 90% monthly coverage”; cuando el backend aplique 12/12 debe decir “years with all 12 months”.')
A('9. Sin pronósticos, causalidad ni alertas.')
A('')
A('### 10.2 Campos propuestos para el backend (no implementados)')
A('')
A('```ts\ntype TrendResultV2 = TrendResult & {\n  hamedRao: { pValue: number | null; varianceFactor: number | null }\n  tfpw: { pValue: number | null; lag1: number | null }\n  senConfidenceInterval95: [number, number] | null\n  blockBootstrapInterval95: [number, number] | null\n  minimumDetectableTrend: number | null      // misma unidad que slopePerYear\n  family: \'primary\' | \'exploratory\'\n  qValue: number | null                      // BH dentro de la familia\n  robustness: { R1: boolean; R2: boolean; R3: boolean; R4: boolean; R5: boolean; score: number }\n  verdict: \'robust\' | \'probable\' | \'weak\' | \'not-detectable\' | \'robust-but-not-fit\'\n}\ntype VariableDescriptor = {\n  id: string; displayName: string; unit: string\n  aggregation: \'day-weighted-mean\' | \'sum\' | \'max\' | \'min\' | \'count\' | \'percent-days\'\n  fitness: \'core\' | \'thermal-extreme\' | \'support\' | \'low-confidence\' | \'unreliable\' | \'suspect\'\n  sourceEndpoint: \'power-monthly\' | \'power-daily\'\n}\ntype SpatialSupport = { type: \'grid-cell\'; centerLat: number; centerLon: number; dLat: 0.5; dLon: 0.625; meanElevationM: number }\n```')
A('')
A('## 11. Prioridades backend revisadas')
A('')
for i, s in enumerate([
    'Corregir A1 (exigir 12/12) con su prueba, A5 (`Object.hasOwn`) y A6 (no ocultar 4xx). Actualizar `methodology.md`.',
    'Integrar Guillermo en main para que la interfaz reciba `trend.autocorrelation`.',
    'Añadir TX y TN desde el endpoint diario (no desde el mensual) y el diccionario de variables con clase de aptitud.',
    'Hamed–Rao como p principal, TFPW como sensibilidad, IC de Sen e IC por bootstrap de bloques; publicar `minimumDetectableTrend`; exigir n ≥ 10.',
    'Derivar el último año completo de `header.end`; manifiesto con inicio real por variable.',
    'Adaptador IMERG Final V07 (1998-01 a 2025-09 hoy) y endpoint multi-fuente con `resolveCommonMonthlyWindow` y BH por familia declarada.',
    'Validación de lluvia con GHCN (aeropuerto MXM00076685, Tlaxcala MXM00076683) en días emparejados; Tehuacán no tiene estaciones después de 2009.',
    'AppEEARS MOD13Q1/MOD13A3 con VI Quality y máscara urbana MCD12Q1; no empalmar con VIIRS (entrega de S-NPP terminó el 2026-11-02).',
    'Contraste de humedad de suelo con GLDAS 2.1 vía Hydrology Time Series.',
    'Mostrar la huella de la celda y estratificar con NASADEM.']):
    A(f'{i+1}. {s}')
A('')
A('## 12. Correcciones respecto a la versión anterior')
A('')
A(table(['#', 'Tema', 'Antes', 'Ahora'], [[r['id'], r['tema'], r['antes'], r['ahora']] for r in corr]))
A('')
A('## 13. Reproducción')
A('')
A('- Scripts: `docs/backend/analysis/` (`stats.py`, `analyze_v2.py`, `build_meta.py`, `build_report.py`), Python 3 estándar sin dependencias. Instrucciones y URL de descarga en `docs/backend/analysis/README.md`.')
A('- Datos crudos (no versionados, ~7 MB más el inventario GHCN de ~35 MB): respuestas de NASA POWER y archivos de NOAA GHCN-Daily descargados el 2026-11-14.')
A('- Las funciones del repositorio se ejecutaron sobre los mismos datos con Node 26 (copia fuera del proyecto) para producir la tabla de la sección 4; su resultado está en `data/ts_results.json` de la carpeta de trabajo.')
A('')
open(DEST, 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print('written', DEST, len('\n'.join(md)))
