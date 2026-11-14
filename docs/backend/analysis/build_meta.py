"""Builds coverage, audit, sources and corrections datasets from verified facts and v2 results."""
import json, sys, gzip, os
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')
B = sys.argv[1]; OUT = f'{B}/v2/out'
def load(p): return json.load(open(p, encoding='utf-8'))
tests = {r['id']: r for r in load(f'{OUT}/tests.json')['rows']}
st = {r['key']: r for r in load(f'{OUT}/station_stats.json')['rows']}
ts = load(f'{B}/data/ts_results.json')
T = lambda s, v, w: tests[f'{s}|{v}|{w}']

# ---------------- GHCN coverage (years with 12 months at >=80% valid days, no QFLAG)
def years_ok(path, el):
    days = defaultdict(int)
    for line in gzip.open(path, 'rt'):
        p = line.split(',')
        if p[2] == el and p[5] == '': days[(int(p[1][:4]), int(p[1][4:6]))] += 1
    import calendar
    ok = [y for y in range(1981, 2025) if all(days[(y, m)] >= 0.8 * calendar.monthrange(y, m)[1] for m in range(1, 13))]
    return ok
def ranges(ys):
    out = [];
    for y in ys:
        if out and y == out[-1][1] + 1: out[-1][1] = y
        else: out.append([y, y])
    return ', '.join(f'{a}–{b}' if a != b else str(a) for a, b in out) or 'ninguno'
cov_ghcn = {(sid, el): years_ok(f'{B}/data/{sid}.csv.gz', el) for sid in ('MXM00076685', 'MXM00076683') for el in ('PRCP', 'TMAX', 'TMIN')}
inv = [l.split() for l in open(f'{B}/data/ghcnd-inventory.txt')]
teh = [r for r in inv if 18.2 < float(r[1]) < 18.8 and -97.7 < float(r[2]) < -97.1 and r[3] == 'PRCP']
teh_last = max(int(r[5]) for r in teh)

coverage = [
 dict(id='power_met', fuente='NASA POWER · meteorología (MERRA-2)', producto='Monthly/Daily Point API v2.10.0', inicio='1981-01', fin='2025-12', anios_completos='1981–2025', resolucion='0.5° × 0.625° (celda nativa)', verificado='Respuesta de la API (header start/end) y comparación punto = celda regional', papel='Integrada'),
 dict(id='power_sol', fuente='NASA POWER · radiación y nubes (GEWEX SRB → CERES SYN1deg)', producto='ALLSKY_SFC_SW_DWN, CLOUD_AMT', inicio='1984-01', fin='2025-12', anios_completos='1984–2025', resolucion='1° × 1°', verificado='Valores −999 en 1981–1983 en la respuesta', papel='Solo diagnóstico'),
 dict(id='imerg', fuente='GPM IMERG Final V07 mensual', producto='GPM_3IMERGM.07', inicio='1998-01', fin='2025-09', anios_completos='1998–2024', resolucion='0.1° × 0.1°', verificado='CMR: 333 gránulos, último 2025-09 (consultado 2026-11-14)', papel='Pendiente (prioridad 1)'),
 dict(id='mod13a3', fuente='MODIS Terra NDVI/EVI mensual', producto='MOD13A3.061', inicio='2000-02', fin='2026-10', anios_completos='2001–2025', resolucion='1 km', verificado='CMR: 321 gránulos sobre Tehuacán, 2000-02 a 2026-10', papel='Pendiente (prioridad 2)'),
 dict(id='mod13q1', fuente='MODIS Terra NDVI/EVI 16 días', producto='MOD13Q1.061', inicio='2000-02', fin='2026-10', anios_completos='2001–2025', resolucion='250 m', verificado='CMR: 614 compuestos sobre Tehuacán', papel='Alternativa a MOD13A3'),
 dict(id='gldas', fuente='GLDAS Noah 2.1 mensual (Hydrology Time Series)', producto='GLDAS_NOAH025_M.2.1', inicio='2000-01', fin='2026-07', anios_completos='2000–2025', resolucion='0.25°', verificado='CMR: 319 gránulos, último 2026-07', papel='Contraste de humedad de suelo'),
 dict(id='viirs', fuente='VIIRS S-NPP NDVI/EVI mensual', producto='VNP13A3.002', inicio='2012-01', fin='2026-11', anios_completos='2012–2025', resolucion='1 km', verificado='CMR (inicio) y aviso GES DISC: entrega de S-NPP terminó el 2026-11-02', papel='No empalmar con MODIS'),
 dict(id='ghcn_aero_prcp', fuente='GHCN-Daily · Aeropuerto de Puebla (MXM00076685) PRCP', producto='by_station', inicio='1988', fin='2024', anios_completos=ranges(cov_ghcn[('MXM00076685', 'PRCP')]), resolucion='estación (2244 m)', verificado='Años con 12 meses ≥80% de días válidos sin bandera de calidad', papel='Validación de lluvia'),
 dict(id='ghcn_tlax_prcp', fuente='GHCN-Daily · Tlaxcala (MXM00076683) PRCP', producto='by_station', inicio='1981', fin='2024', anios_completos=ranges(cov_ghcn[('MXM00076683', 'PRCP')]), resolucion='estación (2230 m)', verificado='Mismo criterio', papel='Validación de lluvia'),
 dict(id='ghcn_tlax_t', fuente='GHCN-Daily · Tlaxcala (MXM00076683) TMAX/TMIN', producto='by_station', inicio='1981', fin='2021', anios_completos=ranges(cov_ghcn[('MXM00076683', 'TMAX')]), resolucion='estación (2230 m)', verificado='Mismo criterio', papel='Validación de temperatura'),
 dict(id='ghcn_teh', fuente=f'GHCN-Daily · {len(teh)} estaciones SMN en el valle de Tehuacán', producto='ghcnd-inventory', inicio='1942', fin=str(teh_last), anios_completos=f'ninguna después de {teh_last}', resolucion='estaciones', verificado='Inventario NCEI, caja 18.2–18.8 N, 97.1–97.7 W', papel='Sin validación posible 2001–2024'),
 dict(id='swot', fuente='SWOT (NASA/CNES/ASC)', producto='Elevación de agua superficial', inicio='2023-07', fin='vigente', anios_completos='2023–2025', resolucion='franja ~120 km, píxeles decamétricos', verificado='ASC: lanzamiento 2022-12-16', papel='Fuera del MVP'),
 dict(id='rcm', fuente='RADARSAT Constellation Mission', producto='SAR banda C (datos abiertos parciales)', inicio='2019-06', fin='vigente', anios_completos='2020–2025', resolucion='3–100 m según modo', verificado='CKAN ASC: licencia OGL-Canada', papel='Fuera del MVP'),
 dict(id='common', fuente='Ventana común calculada (POWER ∩ IMERG ∩ MOD13A3)', producto='resolveCommonMonthlyWindow (código del repo)', inicio=ts['window']['startMonth'], fin=ts['window']['endMonth'], anios_completos=f"{ts['window']['startYear']}–{ts['window']['endYear']}", resolucion='—', verificado='Ejecutado con node sobre manifiestos reales; 2025 se excluye porque IMERG llega a 2025-09', papel='Ventana de comparación'),
]

em = {f"{r['site']}|{r['parameter']}": r for r in ts['elevenMonth']}
aud = [
 dict(id='A1', severidad='Alta', estado='Error latente', archivo='lib/analysis/trend.ts:112 · docs/science/methodology.md:14', area='Completitud anual',
      hallazgo='calculateTrend acepta años con completeness ≥ 0.9, o sea 11 de 12 meses. La suma anual de lluvia se hace solo con los meses presentes.',
      evidencia=f"Ejecutando el código del repo: si falta agosto de 2024, el año sigue entrando. Lluvia 2024 de Puebla pasa de {em['puebla|PRECTOTCORR']['year2024Full']:.0f} a {em['puebla|PRECTOTCORR']['year2024Without8']:.0f} mm y la pendiente 2001–2024 de {em['puebla|PRECTOTCORR']['slopeFull']*10:+.1f} a {em['puebla|PRECTOTCORR']['slopeWith11']*10:+.1f} mm/década. En Tehuacán, de {em['tehuacan|PRECTOTCORR']['slopeFull']*10:+.1f} a {em['tehuacan|PRECTOTCORR']['slopeWith11']*10:+.1f} mm/década.",
      impacto='Sin efecto hoy: POWER T2M y PRECTOTCORR están completos 1981–2025. Se activa con MODIS 2000 (11 meses), IMERG 2025 (9 meses), radiación 1983 o un diciembre aún no publicado.',
      accion='Exigir validObservationCount === 12. Añadir prueba 11/12. Corregir methodology.md y el texto “at least 90%” del gráfico en main.'),
 dict(id='A2', severidad='—', estado='Correcto', archivo='lib/analysis/trend.ts:85-109', area='Agregación anual',
      hallazgo='Media ponderada por días (temperatura) y suma mm/día × días (lluvia).', evidencia='Reproduce el anual YYYY13 de POWER: diferencia ≤ 0.006 °C y ≤ 1.8 mm/año (redondeo).',
      impacto='—', accion='Mantener.'),
 dict(id='A3', severidad='—', estado='Correcto', archivo='lib/nasa/client.ts:28-46', area='Relleno y registro anual',
      hallazgo='Excluye YYYY13, −999 y no numéricos; no imputa.', evidencia='Radiación y nubosidad traen −999 en 1981–1983 y salen del análisis.', impacto='—', accion='Mantener; la comparación value === -999 (línea 36) es redundante con fillValue.'),
 dict(id='A4', severidad='Alta', estado='Trampa de diseño', archivo='lib/nasa/client.ts:9-12 · lib/nasa/types.ts (NasaParameter)', area='Semántica de T2M_MAX/T2M_MIN',
      hallazgo='El endpoint mensual entrega T2M_MAX y T2M_MIN como extremos del mes (día más caluroso, noche más fría), no como medias.',
      evidencia='En 528 meses por sitio, T2M_MAX mensual = máximo de los diarios y T2M_MIN mensual = mínimo (diferencia 0.000). Con la media de los diarios difieren 3.3–4.2 °C.',
      impacto='Si se añaden al endpoint como están, aggregateAnnual promediaría extremos y la interfaz los rotularía como “temperatura máxima/mínima”.',
      accion='Para medias usar el endpoint diario y promediar. Si se usa el mensual, rotular TXx/TNn y agregar con máximo/mínimo.'),
 dict(id='A5', severidad='Baja', estado='Error activo', archivo='app/api/series/route.ts:35', area='Validación de variable',
      hallazgo='`variable in parameters` acepta claves heredadas (toString, constructor, __proto__).', evidencia='variable=toString pasa el filtro, se envía a POWER parameters=function… y la respuesta es 502 en vez de 400.',
      impacto='Petición externa inútil y código de error incorrecto.', accion='Object.hasOwn(parameters, variable).'),
 dict(id='A6', severidad='Baja', estado='Error activo', archivo='lib/nasa/client.ts:91-92', area='Mensajes de error',
      hallazgo='El rechazo HTTP 4xx de POWER (“request rejected…”) se reemplaza por “could not be reached after two attempts”.', evidencia='El catch externo solo relanza mensajes con “timed out”.',
      impacto='El usuario ve “sin conexión” cuando el problema es el periodo o la ubicación.', accion='Relanzar también los errores “request rejected”.'),
 dict(id='A7', severidad='Media', estado='Pendiente', archivo='lib/analysis/robust-trend.ts', area='Inferencia',
      hallazgo='Mann–Kendall sin corrección por autocorrelación; Sen sin intervalo; aproximación normal permitida desde n = 3.',
      evidencia=f"Con Hamed–Rao el p del viento en Puebla 1981–2024 pasa de {T('puebla','WS2M','1981-2024')['p_mk']:.4f} a {T('puebla','WS2M','1981-2024')['p_hamed_rao']:.4f} (factor de varianza {T('puebla','WS2M','1981-2024')['factor_hr']}).",
      impacto=f"p optimistas cuando r1 > 0.3 ({sum(1 for r in tests.values() if r['r1'] is not None and r['r1'] > 0.3)} de las {len(tests)} pruebas de esta auditoría).", accion='Hamed–Rao como p principal, TFPW como sensibilidad, IC de Sen (Gilbert) e IC por bootstrap de bloques. Exigir n ≥ 10 para publicar p.'),
 dict(id='A8', severidad='Media', estado='Advertencia', archivo='app/api/series/route.ts · lib/nasa/client.ts', area='Soporte espacial',
      hallazgo='El valor “punto” es exactamente la celda MERRA-2 más cercana (verificado: idéntico a la celda del endpoint regional).',
      evidencia='Elevación de celda: Puebla 2147 m (ciudad ≈2135 m), Tehuacán 2064 m (ciudad ≈1680 m), Tlaxcala 2517 m (estación 2230 m). En Tlaxcala, TMAX de POWER es 3.8 °C más fría que la estación.',
      impacto='“Tehuacán” en POWER representa la sierra, no el valle semiárido.', accion='Mostrar la huella de la celda (0.5° × 0.625°) y su elevación; usar IMERG 0.1° y NASADEM para estratificar.'),
 dict(id='A9', severidad='Media', estado='Advertencia', archivo='— (datos)', area='Homogeneidad de nubes y radiación',
      hallazgo='La caída de nubosidad y el aumento de radiación ocurren en 1996–1998 (Pettitt) y desaparecen después de 2001.',
      evidencia=f"Nubosidad Puebla: Pettitt {T('puebla','CLOUD_AMT','1981-2024')['pettitt_anio']} (p {T('puebla','CLOUD_AMT','1981-2024')['pettitt_p']}); tendencia 2001–2024 p_HR {T('puebla','CLOUD_AMT','2001-2024')['p_hamed_rao']:.2f}. Antes de 2001 POWER usa GEWEX SRB con nubes ISCCP, que tienen una caída espuria documentada.",
      impacto='Una “tendencia” 1981–2024 de CLOUD_AMT o ALLSKY sería un artefacto de producto.', accion='No publicar tendencias de esas variables antes de 2001; viento y presión solo como diagnóstico.'),
 dict(id='A10', severidad='Alta', estado='Limitación de datos', archivo='— (datos)', area='Fiabilidad de la precipitación',
      hallazgo='POWER reproduce el ciclo estacional de la lluvia pero poco su variación interanual, y su signo de tendencia depende del año de inicio.',
      evidencia=f"Contra GHCN: r anual {st['MXM00076685|PRCP']['r_anual']} (aeropuerto) y {st['MXM00076683|PRCP']['r_anual']} (Tlaxcala); días húmedos {st['MXM00076683|PRCP']['dias_humedos_power']}% en POWER vs {st['MXM00076683|PRCP']['dias_humedos_estacion']}% en la estación. Puebla: −22 mm/década desde 1990, +102 desde 2005.",
      impacto='Ninguna tendencia de lluvia de POWER es publicable por sí sola; CDD, CWD y SDII diarios no son fiables.', accion='Integrar IMERG (1998–2024) y validar con estaciones antes de afirmar algo sobre lluvia.'),
 dict(id='A11', severidad='Media', estado='Advertencia', archivo='— (datos)', area='Temperatura mínima frente a estación',
      hallazgo='POWER subestima el calentamiento nocturno medido en Tlaxcala; la máxima coincide.',
      evidencia=f"1981–2005: TMIN estación {st['MXM00076683|TMIN']['sen_estacion_decada']:+.2f} vs POWER {st['MXM00076683|TMIN']['sen_power_decada']:+.2f} °C/década (diferencia p {st['MXM00076683|TMIN']['p_hr_diferencia']}); TMAX {st['MXM00076683|TMAX']['sen_estacion_decada']:+.2f} vs {st['MXM00076683|TMAX']['sen_power_decada']:+.2f} (p {st['MXM00076683|TMAX']['p_hr_diferencia']}).",
      impacto='La TN de POWER es una estimación regional conservadora; la estación puede incluir efecto urbano.', accion='Presentar TN de POWER como señal regional y la diferencia con la estación como contexto.'),
 dict(id='A12', severidad='Media', estado='Advertencia', archivo='origin/main vs origin/Guillermo', area='Ramas',
      hallazgo='main (2996ebc) no contiene 26300d3 ni 741fa44: le faltan autocorrelación, ventana común y BH.', evidencia='git diff origin/Guillermo origin/main -- lib: 508 líneas eliminadas en main.',
      impacto='El tipo TrendResult del frontend en main no tiene el campo autocorrelation.', accion='Integrar Guillermo en main antes de que la interfaz use los campos nuevos.'),
 dict(id='A13', severidad='Media', estado='Nota para frontend', archivo='components/trend-chart.tsx (main) · components/evidence-panel.tsx (main)', area='Presentación (no modificado)',
      hallazgo='El eje Y del gráfico siempre incluye 0 y el eje X usa el índice, no el año. El texto dice “at least 90% monthly coverage”.',
      evidencia='minValue = Math.min(..., 0): una serie de 16–18 °C se dibuja sobre 0–18 °C y se ve plana. Un año faltante desplazaría los puntos.',
      impacto='Tendencias reales se ven planas; el texto quedará desactualizado con A1.', accion='Informativo para el agente de interfaz: escalar al rango de datos, ubicar por año, actualizar el texto.'),
 dict(id='A14', severidad='Baja', estado='Pendiente', archivo='tests/analysis/trend.test.ts', area='Pruebas',
      hallazgo='Hay 12 pruebas; ninguna cubre el caso 11/12 ni el umbral exacto.', evidencia='La prueba de completitud usa 10/12 (0.83).', impacto='El error A1 no se detecta.', accion='Añadir pruebas 11/12 y 12/12.'),
 dict(id='A15', severidad='—', estado='Correcto', archivo='lib/analysis/common-window.ts:66', area='Ventana común',
      hallazgo='resolveCommonMonthlyWindow devuelve 2001-01 a 2024-12 con los manifiestos reales de POWER, IMERG y MOD13A3.', evidencia='Ejecutado con node sobre una copia del código fuera del repositorio.',
      impacto='minimumStartYear = 2001 por defecto oculta que POWER–IMERG solo podría usar 1998–2024.', accion='Pasar minimumStartYear explícito según la familia de fuentes.'),
 dict(id='A16', severidad='Media', estado='Pendiente', archivo='lib/analysis/trend.ts (TrendResult)', area='Detectabilidad',
      hallazgo='La API no informa qué tendencia podría detectarse con los datos disponibles.',
      evidencia=f"Con 24 años, la tendencia mínima detectable de lluvia es {T('puebla','PRECTOTCORR','2001-2024')['tendencia_minima_detectable']:.0f} mm/década en Puebla y {T('tehuacan','PRECTOTCORR','2001-2024')['tendencia_minima_detectable']:.0f} en Tehuacán (~10% de la media por década).",
      impacto='“p ≥ 0.05” se lee como “no cambió”.', accion='Añadir minimumDetectableTrend al TrendResult.'),
 dict(id='A17', severidad='Baja', estado='Advertencia', archivo='app/api/series/route.ts:27', area='Último año completo',
      hallazgo='El último año permitido sale del reloj (año actual − 1), no de la cobertura real.', evidencia='La respuesta de POWER incluye header.start y header.end (hoy 19810101–20251231).',
      impacto='En enero puede pedirse un año sin diciembre publicado, lo que activa A1.', accion='Derivar el último año completo de header.end o del manifiesto.'),
]

src = [
 dict(id='S1', fuente='NASA POWER', tipo='Producto + API', acceso='API pública sin login', verificado='Sí: API v2.10.0, unidades, celdas', producto='MERRA-2 (meteorología), GEWEX SRB/CERES (radiación)', cobertura='1981–2025; diario y mensual; regional 24 celdas', uso='Línea base de temperatura. Lluvia solo como contexto.', limitaciones='Celda de ~55 km; T2M_MAX/MIN mensuales son extremos; llovizna en datos diarios.', prioridad='Integrada'),
 dict(id='S2', fuente='Giovanni (GES DISC)', tipo='Herramienta', acceso='Earthdata Login', verificado='Parcial: versión 4.40; la página es una app que no expone su catálogo sin sesión', producto='IMERG Final V07 mensual (GPM_3IMERGM.07)', cobertura='1998-01 a 2025-09 (CMR, 333 gránulos), 0.1°', uso='Explorar y validar IMERG; series promediadas por área en CSV.', limitaciones='Registrar siempre el producto y versión, no “Giovanni”. 2025 incompleto.', prioridad='Alta'),
 dict(id='S3', fuente='Hydrology Time Series (antes Data Rods)', tipo='Herramienta', acceso='Earthdata Login; API “Giovanni in the Cloud: Time Series Service”', verificado='Sí: ficha de herramienta GES DISC; el endpoint antiguo redirige a un aviso de retiro', producto='GLDAS Noah 2.1 (global), NLDAS (solo EE. UU.)', cobertura='GLDAS 2.1 mensual 2000-01 a 2026-07 (CMR), 0.25°', uso='Contraste independiente de la humedad del suelo de POWER (GWETROOT).', limitaciones='Celdas de agua enmascaradas; NLDAS no cubre México.', prioridad='Media'),
 dict(id='S4', fuente='AppEEARS', tipo='Herramienta', acceso='Earthdata Login (token de 48 h); catálogo y QA públicos', verificado='Sí: documentación de la API y catálogo de productos', producto='MOD13Q1.061 / MOD13A3.061 (NDVI/EVI), MCD12Q1 (cobertura), MOD11A2 (LST), NASADEM_NC.001', cobertura='MODIS desde 2000-02; MCD12Q1 desde 2001; NASADEM 2000', uso='Vegetación con decodificación de VI Quality; máscara urbana con MCD12Q1.', limitaciones='Tareas asíncronas; resultados expiran ~30 días; límite 429.', prioridad='Alta'),
 dict(id='S5', fuente='NOAA NCEI Climate Data Online / GHCN-Daily', tipo='Producto + portal', acceso='Archivos HTTPS sin token; API CDO con token', verificado='Sí: inventario y archivos por estación descargados', producto='GHCN-Daily', cobertura='Aeropuerto de Puebla y Tlaxcala útiles; Tehuacán sin estaciones después de 2009', uso='Validación: TMAX coincide, TMIN difiere (urbano), lluvia con poca habilidad interanual.', limitaciones='Huecos grandes; estaciones SYNOP con TMAX < 50% en el aeropuerto.', prioridad='Media'),
 dict(id='S6', fuente='Acker et al., NTRS 20090042747', tipo='Referencia', acceso='PDF público', verificado='Sí: título y resumen extraídos del PDF', producto='SeaWiFS clorofila vía Giovanni', cobertura='—', uso='Método: series de Giovanni, tendencia sobre anomalías y alerta de que el retrieval puede reflejar otra cosa (sedimentos/CDOM).', limitaciones='Caso costero; la lección es metodológica.', prioridad='Referencia'),
 dict(id='S7', fuente='KNMI Climate Explorer', tipo='Herramienta', acceso='Web; verificación humana por equipo; cuenta para datos grandes', verificado='Sí: página principal', producto='CRU TS, GPCC, ERA5/ERA5-Land, HadEX3, estaciones', cobertura='Global', uso='Auditoría manual con el dataset nombrado (p. ej. CRU TS para temperatura).', limitaciones='No automatizable desde el backend; no contar GHCN dos veces.', prioridad='Auditoría'),
 dict(id='S8', fuente='Medium: métodos para detectar tendencias', tipo='Referencia', acceso='HTTP 403 a clientes automáticos', verificado='No: no se pudo leer', producto='—', cobertura='—', uso='Se usaron las fuentes primarias: Mann (1945), Kendall (1975), Sen (1968), Hamed y Rao (1998), Yue et al. (2002), Pettitt (1979).', limitaciones='Contenido no verificado.', prioridad='Referencia'),
 dict(id='S9', fuente='Statsig: guía de significancia', tipo='Referencia', acceso='Público', verificado='Sí', producto='—', cobertura='—', uso='p ≠ probabilidad de H0; reportar tamaño de efecto e IC; corregir pruebas múltiples. Aplicado con BH, IC y tendencia mínima detectable.', limitaciones='Orientado a experimentos A/B, no a series autocorrelacionadas.', prioridad='Referencia'),
 dict(id='S10', fuente='RADARSAT Constellation Mission (datos abiertos ASC)', tipo='Producto', acceso='Datos abiertos parciales + EODMS', verificado='Sí: ficha CKAN (licencia OGL-Canada)', producto='SAR banda C', cobertura='2019 a la fecha; acceso diario al 90% del planeta', uso='Ninguno en el MVP.', limitaciones='Serie corta, procesamiento SAR, subconjunto abierto limitado.', prioridad='Fuera del MVP'),
 dict(id='S11', fuente='Geo.ca', tipo='Portal', acceso='Público', verificado='Sí', producto='Datos geoespaciales de Canadá', cobertura='Canadá', uso='Ninguno: no cubre México.', limitaciones='—', prioridad='No aplica'),
 dict(id='S12', fuente='SWOT', tipo='Producto', acceso='Público (PO.DAAC/Hydroweb)', verificado='Sí: ficha ASC', producto='Elevación de lagos, ríos, embalses y océano', cobertura='Lanzamiento 2022-12-16; ciencia desde 2023', uso='Caso futuro: niveles de la presa Valsequillo, no tendencias.', limitaciones='Menos de 3 años de datos.', prioridad='Fuera del MVP'),
 dict(id='S13', fuente='ASC: monitoreo de ecosistemas', tipo='Referencia', acceso='Público', verificado='Sí', producto='RADARSAT-2/RCM, SMOS, SWOT, Landsat 8', cobertura='—', uso='SMOS (humedad de suelo global, 2010→) es un posible tercer contraste de GWETROOT.', limitaciones='Aplicaciones centradas en Canadá.', prioridad='Baja'),
 dict(id='S14', fuente='Tutorial SAR (GitHub asc-csa)', tipo='Referencia', acceso='Público, licencia MIT modificada', verificado='Sí', producto='Notebook Python (GDAL, cartopy) y guía QGIS', cobertura='Ejemplo: incendio en Columbia Británica', uso='Formativo; no aporta datos para Puebla.', limitaciones='Solo visualización.', prioridad='No aplica'),
]

corr = [
 dict(id='C1', tema='T2M_MAX / T2M_MIN', antes='“Tmin Puebla +0.69 °C/década” con el T2M_MIN mensual de POWER.', ahora=f"Ese valor es el promedio de las noches más frías de cada mes. La mínima media diaria (TN) sube {T('puebla','TN','2001-2024')['pendiente_decada']:+.2f} °C/década en Puebla y {T('tehuacan','TN','2001-2024')['pendiente_decada']:+.2f} en Tehuacán."),
 dict(id='C2', tema='Unidad de radiación', antes='ALLSKY_SFC_SW_DWN en kWh/m²/día.', ahora='La API devuelve MJ/m²/día.'),
 dict(id='C3', tema='Cobertura de IMERG', antes='IMERG desde 2000-06.', ahora='IMERG Final V07 mensual cubre 1998-01 a 2025-09 (333 gránulos en CMR).'),
 dict(id='C4', tema='Referencias de código', antes='trend.ts:521 y route.ts:749.', ahora='lib/analysis/trend.ts:112 y app/api/series/route.ts:35.'),
 dict(id='C5', tema='Gravedad del umbral 11/12', antes='Error que hoy sesga la lluvia.', ahora='Error latente: no afecta a POWER hoy; se activa con MODIS 2000, IMERG 2025 o un diciembre no publicado.'),
 dict(id='C6', tema='Criterio de robustez', antes='p compuesto ad hoc y una sola familia de 56 pruebas.', ahora='Familia primaria declarada (12 hipótesis) y exploratoria, con cinco criterios explícitos y aptitud de la variable.'),
 dict(id='C7', tema='Nubes y radiación', antes='Salto atribuido al cambio de producto en 2001.', ahora='El cambio ocurre en 1996–1998 dentro de la era SRB/ISCCP; después de 2001 no hay tendencia.'),
 dict(id='C8', tema='Lluvia en Tehuacán', antes='Marcada “robusta” en 1981–2024.', ahora='Depende del año de inicio (quiebre ~1999), las estaciones muestran poca habilidad interanual de POWER: no concluyente.'),
 dict(id='C9', tema='Viento, presión y nubes', antes='Marcados “robustos”.', ahora='Clasificados como no aptos para afirmar tendencias.'),
 dict(id='C10', tema='Hydrology Data Rods', antes='Tratado como servicio vigente.', ahora='Ahora se llama Hydrology Time Series; el endpoint antiguo redirige a un aviso de retiro.'),
 dict(id='C11', tema='Soporte del punto', antes='“Celda aproximada”.', ahora='Verificado: el punto es exactamente la celda MERRA-2 más cercana.'),
 dict(id='C12', tema='Número de pruebas', antes='“El handoff dice 12 y el commit 11”.', ahora='Ambos eran correctos en su commit: 26300d3 tenía 11 y 741fa44 añadió 1.'),
 dict(id='C13', tema='Validación con estaciones', antes='Solo inventario de cobertura.', ahora='Comparación cuantitativa POWER–GHCN de lluvia, TMAX y TMIN.'),
]
meta = [{'label': 'Fuentes', 'value': 'CMR (cmr.earthdata.nasa.gov) consultado 2026-11-14; código de origin/Guillermo @741fa44 y origin/main @2996ebc; resultados de analyze_v2.py.'},
        {'label': 'build_meta.py', 'value': open(__file__, encoding='utf-8').read(), 'type': 'code', 'lang': 'python'}]
for name, rows in (('coverage', coverage), ('audit', aud), ('sources', src), ('corrections', corr)):
    json.dump({'rows': rows, 'meta': meta}, open(f'{OUT}/{name}.json', 'w', encoding='utf-8'), ensure_ascii=False)
print({k: ranges(v) for k, v in cov_ghcn.items()}, len(teh), teh_last)
print(sum(1 for r in tests.values() if r['r1'] is not None and r['r1'] > 0.3))
