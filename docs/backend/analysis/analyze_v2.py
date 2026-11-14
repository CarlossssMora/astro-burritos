"""EarthScope data audit v2.

Inputs (all downloaded 2026-11-14, kept outside the repository):
  data/{puebla,tehuacan}.json            NASA POWER monthly point, 13 parameters, 1981-2025
  data/{puebla,tehuacan,tlaxcala}_daily.json  NASA POWER daily point, 1981-2024
  data/reg_*.json                        NASA POWER monthly regional grid (24 MERRA-2 cells)
  data/MXM0007668{3,5}.csv.gz            NOAA GHCN-Daily station files
Run:  python -I v2/analyze_v2.py <scratchpad>
"""
import json, math, sys, gzip, calendar, os
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stats as S
sys.stdout.reconfigure(encoding="utf-8")

B = sys.argv[1]
DATA = f'{B}/data'
OUT = f'{B}/v2/out'
os.makedirs(OUT, exist_ok=True)
SITES = {'puebla': 'Puebla', 'tehuacan': 'Tehuacán'}
WINDOWS = {'1981-2024': (1981, 2024), '2001-2024': (2001, 2024)}
BASE = (1991, 2020)

def load(p): return json.load(open(p, encoding='utf-8'))

# ------------------------------------------------------------------ catalog
CAT = [
 # id, name, source, native, how annual, unit, class, definition
 ('T2M','Temperatura media del aire (2 m)','POWER mensual','media mensual','media ponderada por días','°C','Núcleo','Media mensual de T2M (MERRA-2).'),
 ('TX','Temperatura máxima media diaria','POWER diario (T2M_MAX)','máximo diario','media de los máximos diarios','°C','Núcleo','Promedio anual de la máxima de cada día. No es el T2M_MAX mensual de POWER.'),
 ('TN','Temperatura mínima media diaria','POWER diario (T2M_MIN)','mínimo diario','media de los mínimos diarios','°C','Núcleo','Promedio anual de la mínima de cada día. No es el T2M_MIN mensual de POWER.'),
 ('T2M_RANGE','Rango térmico diurno (DTR)','POWER mensual','media mensual de (máx − mín) diario','media ponderada por días','°C','Núcleo','Promedio de la diferencia diaria máxima − mínima (verificado contra los datos diarios).'),
 ('PRECTOTCORR','Precipitación anual','POWER mensual','tasa media mm/día','suma mm/día × días del mes','mm/año','Núcleo','MERRA-2 corregida con observaciones. Total anual.'),
 ('PREC_MJJASO','Precipitación de temporada de lluvias (may–oct)','POWER mensual','tasa media mm/día','suma may–oct','mm','Núcleo','Total de mayo a octubre; concentra ~88% de la lluvia anual.'),
 ('PREC_NDJFMA','Precipitación de temporada seca (nov–abr)','POWER mensual','tasa media mm/día','suma nov (año−1) a abr','mm','Extremos/estacional','Total de noviembre del año anterior a abril.'),
 ('TXx','Máxima absoluta anual (TXx)','POWER diario','máximo diario','máximo del año','°C','Extremos/estacional','Día más caluroso del año (ETCCDI TXx).'),
 ('TNn','Mínima absoluta anual (TNn)','POWER diario','mínimo diario','mínimo del año','°C','Extremos/estacional','Noche más fría del año (ETCCDI TNn).'),
 ('TXX_MEAN','Promedio de los máximos mensuales (T2M_MAX mensual)','POWER mensual','máximo absoluto del mes','media anual de los 12 máximos','°C','Extremos/estacional','Lo que entrega el endpoint mensual como T2M_MAX: el día más caluroso de cada mes.'),
 ('TNN_MEAN','Promedio de los mínimos mensuales (T2M_MIN mensual)','POWER mensual','mínimo absoluto del mes','media anual de los 12 mínimos','°C','Extremos/estacional','Lo que entrega el endpoint mensual como T2M_MIN: la noche más fría de cada mes.'),
 ('TX90p','Días cálidos (TX90p)','POWER diario','máximo diario','% de días > p90 1991–2020','% días','Extremos/estacional','Percentil 90 por día del calendario (ventana de 5 días), base 1991–2020, sin bootstrap dentro de la base.'),
 ('TN90p','Noches cálidas (TN90p)','POWER diario','mínimo diario','% de días > p90 1991–2020','% días','Extremos/estacional','Igual que TX90p con la mínima diaria.'),
 ('TX10p','Días frescos (TX10p)','POWER diario','máximo diario','% de días < p10 1991–2020','% días','Extremos/estacional','Percentil 10 por día del calendario, base 1991–2020.'),
 ('TN10p','Noches frías (TN10p)','POWER diario','mínimo diario','% de días < p10 1991–2020','% días','Extremos/estacional','Percentil 10 de la mínima diaria, base 1991–2020.'),
 ('FD','Días con helada (FD)','POWER diario','mínimo diario','conteo TN < 0 °C','días','Extremos/estacional','Número de días con mínima bajo 0 °C en la celda.'),
 ('SU25','Días de verano (SU25)','POWER diario','máximo diario','conteo TX > 25 °C','días','Extremos/estacional','Número de días con máxima sobre 25 °C.'),
 ('Rx1day','Lluvia máxima en 1 día','POWER diario','lluvia diaria','máximo anual','mm','Extremos/estacional','Mayor acumulado diario del año.'),
 ('Rx5day','Lluvia máxima en 5 días','POWER diario','lluvia diaria','máximo anual de 5 días consecutivos','mm','Extremos/estacional','Mayor acumulado de 5 días consecutivos.'),
 ('R10mm','Días con lluvia ≥ 10 mm','POWER diario','lluvia diaria','conteo','días','Extremos/estacional','Días de lluvia intensa.'),
 ('R20mm','Días con lluvia ≥ 20 mm','POWER diario','lluvia diaria','conteo','días','Extremos/estacional','Días de lluvia muy intensa.'),
 ('SDII','Intensidad diaria (SDII)','POWER diario','lluvia diaria','total en días ≥1 mm ÷ número de días ≥1 mm','mm/día','Extremos/estacional','Lluvia media de un día húmedo.'),
 ('CDD','Racha seca máxima (CDD)','POWER diario','lluvia diaria','racha más larga < 1 mm que termina en el año','días','Extremos/estacional','Las rachas pueden empezar el año anterior (la temporada seca cruza diciembre).'),
 ('CWD','Racha húmeda máxima (CWD)','POWER diario','lluvia diaria','racha más larga ≥ 1 mm','días','Extremos/estacional','Afectada por la llovizna del reanálisis.'),
 ('R95p','Lluvia en días muy húmedos (R95p)','POWER diario','lluvia diaria','suma de días > p95 húmedo 1991–2020','mm','Extremos/estacional','Total anual de los días por encima del percentil 95 de días húmedos.'),
 ('R1mm','Días húmedos (≥ 1 mm)','POWER diario','lluvia diaria','conteo','días','Diagnóstico','Frecuencia de días húmedos; MERRA-2 tiende a sobreestimarla.'),
 ('DRIZZLE','Días de llovizna (0.1–1 mm)','POWER diario','lluvia diaria','% de días','% días','Diagnóstico','Indicador de llovizna espuria del reanálisis.'),
 ('RH2M','Humedad relativa (2 m)','POWER mensual','media mensual','media ponderada por días','%','Apoyo','Depende de T y de la humedad absoluta; no es independiente de T2M.'),
 ('QV2M','Humedad específica (2 m)','POWER mensual','media mensual','media ponderada por días','g/kg','Apoyo','Humedad absoluta.'),
 ('GWETROOT','Humedad del suelo, zona radicular','POWER mensual','media mensual','media ponderada por días','fracción 0–1','Apoyo','Variable del modelo de superficie de MERRA-2, no medición.'),
 ('GWETTOP','Humedad del suelo, superficie','POWER mensual','media mensual','media ponderada por días','fracción 0–1','Apoyo','Capa superficial del modelo de MERRA-2.'),
 ('WS2M','Viento a 2 m','POWER mensual','media mensual','media ponderada por días','m/s','Sospechosa','Reanálisis sin homogeneizar; sensible a cambios en el sistema de observación.'),
 ('PS','Presión superficial','POWER mensual','media mensual','media ponderada por días','kPa','Sospechosa','Una tendencia de presión en una celda fija suele ser artefacto del reanálisis.'),
 ('CLOUD_AMT','Nubosidad','POWER mensual (SRB→CERES)','media mensual','media ponderada por días','%','Sospechosa','Dos productos satelitales distintos antes y después de 2001; celda de 1°.'),
 ('ALLSKY_SFC_SW_DWN','Radiación solar en superficie','POWER mensual (SRB→CERES)','media mensual','media ponderada por días','MJ/m²/día','Sospechosa','Unidad real de la API: MJ/m²/día. Cambio de producto en 2001; celda de 1°.'),
]
# Classes revised with the station evidence (POWER wet-day frequency ≈ 2× GHCN; annual precipitation r ≤ 0.33).
RECLASS = {'PREC_NDJFMA': 'Estacional (baja confianza)',
           **{k: 'Extremo térmico' for k in ('TXx', 'TNn', 'TXX_MEAN', 'TNN_MEAN', 'TX90p', 'TN90p', 'TX10p', 'TN10p', 'FD', 'SU25')},
           **{k: 'Lluvia diaria (baja confianza)' for k in ('Rx1day', 'Rx5day', 'R10mm', 'R20mm', 'R95p')},
           **{k: 'Lluvia diaria (no fiable)' for k in ('SDII', 'CDD', 'CWD', 'R1mm', 'DRIZZLE')}}
CAT = [c[:6] + (RECLASS.get(c[0], c[6]),) + c[7:] for c in CAT]
CAT = [c if c[0] != 'CLOUD_AMT' else c[:7] + ('Antes de 2001 proviene de GEWEX SRB, que usa nubes ISCCP con una caída espuria documentada por cambios de geometría de observación; desde 2001, CERES SYN1deg. Celda de 1°.',) for c in CAT]
CAT = [c if c[0] != 'ALLSKY_SFC_SW_DWN' else c[:7] + ('Unidad real de la API: MJ/m²/día (no kWh). Mismo cambio de producto SRB→CERES en 2001; celda de 1°.',) for c in CAT]
APTAS = ('Núcleo', 'Extremo térmico', 'Apoyo')
CATD = {c[0]: c for c in CAT}
PRIMARY_VARS = ['T2M', 'TX', 'TN', 'T2M_RANGE', 'PRECTOTCORR', 'PREC_MJJASO']

# ------------------------------------------------------------------ annual series
def monthly_dict(param_series):
    out = {}
    for k, v in param_series.items():
        y, m = int(k[:4]), int(k[4:])
        if m == 13 or v is None or v == -999: continue
        out[(y, m)] = v
    return out

def dim(y, m): return calendar.monthrange(y, m)[1]

def build_monthly_annual(mp):
    series = {}
    for v, ser in mp.items():
        mon = monthly_dict(ser)
        full = [y for y in range(1981, 2026) if all((y, m) in mon for m in range(1, 13))]
        if v == 'PRECTOTCORR':
            series['PRECTOTCORR'] = {y: sum(mon[(y, m)] * dim(y, m) for m in range(1, 13)) for y in full}
            series['PREC_MJJASO'] = {y: sum(mon[(y, m)] * dim(y, m) for m in range(5, 11)) for y in full}
            series['PREC_NDJFMA'] = {y: sum(mon[(y - 1, m)] * dim(y - 1, m) for m in (11, 12)) + sum(mon[(y, m)] * dim(y, m) for m in range(1, 5))
                                     for y in full if (y - 1) in full}
        elif v == 'T2M_MAX':
            series['TXX_MEAN'] = {y: sum(mon[(y, m)] * dim(y, m) for m in range(1, 13)) / (366 if calendar.isleap(y) else 365) for y in full}
        elif v == 'T2M_MIN':
            series['TNN_MEAN'] = {y: sum(mon[(y, m)] * dim(y, m) for m in range(1, 13)) / (366 if calendar.isleap(y) else 365) for y in full}
        else:
            series[v] = {y: sum(mon[(y, m)] * dim(y, m) for m in range(1, 13)) / (366 if calendar.isleap(y) else 365) for y in full}
    return series

def daily_by_year(dp):
    by = defaultdict(lambda: defaultdict(list))
    for v, ser in dp.items():
        for k, x in sorted(ser.items()):
            if x is None or x == -999: continue
            by[v][int(k[:4])].append((int(k[4:6]), int(k[6:8]), x))
    return by

def doy_key(m, d): return (2, 28) if (m, d) == (2, 29) else (m, d)

def percentile(vals, q):
    s = sorted(vals); pos = (len(s) - 1) * q; lo = math.floor(pos); hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)

def calendar_thresholds(series_by_year, q):
    """Calendar-day percentile with a 5-day centred window over the base period."""
    import datetime
    pool = defaultdict(list)
    for y in range(BASE[0], BASE[1] + 1):
        for (m, d, x) in series_by_year.get(y, []):
            if (m, d) == (2, 29): continue
            day = datetime.date(2001, m, d)
            for off in range(-2, 3):
                k = day + datetime.timedelta(days=off); pool[(k.month, k.day)].append(x)
    return {k: percentile(v, q) for k, v in pool.items()}

def build_daily_indices(dp):
    by = daily_by_year(dp)
    tx, tn, pr = by['T2M_MAX'], by['T2M_MIN'], by['PRECTOTCORR']
    years = [y for y in range(1981, 2025) if len(tx.get(y, [])) == (366 if calendar.isleap(y) else 365) and len(tn.get(y, [])) == len(tx[y]) and len(pr.get(y, [])) == len(tx[y])]
    p90x, p10x = calendar_thresholds(tx, .9), calendar_thresholds(tx, .1)
    p90n, p10n = calendar_thresholds(tn, .9), calendar_thresholds(tn, .1)
    wet_base = [x for y in range(BASE[0], BASE[1] + 1) for (_, _, x) in pr[y] if x >= 1]
    p95 = percentile(wet_base, .95)
    out = defaultdict(dict); dry_run = 0
    allp = [(y, x) for y in range(1981, 2025) for (_, _, x) in pr.get(y, [])]
    # CDD with spells allowed to start in the previous year
    run = 0; cdd_end = defaultdict(int); cur_year_max = defaultdict(int)
    for y, x in allp:
        run = run + 1 if x < 1 else 0
        cur_year_max[y] = max(cur_year_max[y], run)
    for y in years:
        X = [x for (_, _, x) in tx[y]]; N = [x for (_, _, x) in tn[y]]; P = [x for (_, _, x) in pr[y]]; nd = len(X)
        out['TX'][y] = S.mean(X); out['TN'][y] = S.mean(N)
        out['TXx'][y] = max(X); out['TNn'][y] = min(N)
        out['TX90p'][y] = 100 * sum(x > p90x[doy_key(m, d)] for (m, d, x) in tx[y]) / nd
        out['TN90p'][y] = 100 * sum(x > p90n[doy_key(m, d)] for (m, d, x) in tn[y]) / nd
        out['TX10p'][y] = 100 * sum(x < p10x[doy_key(m, d)] for (m, d, x) in tx[y]) / nd
        out['TN10p'][y] = 100 * sum(x < p10n[doy_key(m, d)] for (m, d, x) in tn[y]) / nd
        out['FD'][y] = sum(x < 0 for x in N); out['SU25'][y] = sum(x > 25 for x in X)
        wet = [x for x in P if x >= 1]
        out['R1mm'][y] = len(wet); out['R10mm'][y] = sum(x >= 10 for x in P); out['R20mm'][y] = sum(x >= 20 for x in P)
        out['Rx1day'][y] = max(P); out['Rx5day'][y] = max(sum(P[i:i + 5]) for i in range(len(P) - 4))
        out['SDII'][y] = sum(wet) / len(wet) if wet else 0
        out['R95p'][y] = sum(x for x in P if x > p95)
        out['DRIZZLE'][y] = 100 * sum(0.1 <= x < 1 for x in P) / nd
        best = r = 0
        for x in P:
            r = r + 1 if x >= 1 else 0; best = max(best, r)
        out['CWD'][y] = best
        out['CDD'][y] = cur_year_max[y]
    # monthly means of daily TX/TN for climatology and month-by-month trends
    mon = defaultdict(dict)
    for v, key in (('T2M_MAX', 'TX'), ('T2M_MIN', 'TN')):
        for y in years:
            for m in range(1, 13):
                vals = [x for (mm, _, x) in by[v][y] if mm == m]
                mon[key][(y, m)] = S.mean(vals)
    return out, mon, dict(p95_wet=p95, years=len(years))

# ------------------------------------------------------------------ testing
def test_series(series, window):
    a, b = WINDOWS[window]
    xs = [y for y in range(a, b + 1) if y in series]
    expected = b - a + 1 - (1 if a == 1981 and min(series) == 1982 else 0)
    if len(xs) < max(10, 0.9 * expected): return None
    ys = [series[y] for y in xs]
    if len(set(ys)) < 3: return None
    n = len(xs); o = S.ols(xs, ys); mk = S.mann_kendall(ys); hr = S.hamed_rao(xs, ys); tf = S.tfpw(xs, ys)
    sen, sci = S.sen_ci(xs, ys); bci, L = S.block_bootstrap_ci(xs, ys); pt = S.pettitt(xs, ys)
    ptr = S.pettitt(xs, o['resid'])  # step not explained by the linear trend
    r1 = S.acf(o['resid'], 1); mdt = S.min_detectable_trend(o, n, max(0.0, min(r1, 0.95)))
    jk = []
    for d in xs:
        x2 = [x for x in xs if x != d]; y2 = [series[x] for x in x2]
        jk.append((S.ols(x2, y2)['slope'], S.hamed_rao(x2, y2)['p']))
    sign = 1 if o['slope'] > 0 else -1
    last = S.hamed_rao(xs[:-1], ys[:-1]); last_o = S.ols(xs[:-1], ys[:-1])
    sd_res = S.sd(o['resid'])
    return dict(n=n, mean=S.mean(ys), sd=S.sd(ys), slope=o['slope'], p_ols=o['p'], ci=o['ci'], r2=o['r2'],
                sen=sen, sen_ci=sci, tau=mk['tau'], p_mk=mk['p'], p_hr=hr['p'], hr_factor=hr['factor'], p_tfpw=tf['p'], r1=r1,
                boot_ci=bci, block=L, pettitt_year=pt['year'], pettitt_p=pt['p'], pettitt_before=pt['before'], pettitt_after=pt['after'], pettitt_res_year=ptr['year'], pettitt_res_p=ptr['p'],
                mdt=mdt, detect_ratio=abs(o['slope']) / mdt if mdt > 0 else None,
                z_change=o['slope'] * (n - 1) / sd_res if sd_res > 0 else None,
                jk_sign=sum((s > 0) == (sign > 0) for s, _ in jk) / len(jk), jk_sig=sum(p is not None and p < 0.05 for _, p in jk) / len(jk),
                jk_min=min(s for s, _ in jk), jk_max=max(s for s, _ in jk),
                drop_last_slope=last_o['slope'], drop_last_p_hr=last['p'])

def run():
    annual = {}; daily_meta = {}; mon_daily = {}
    for s in SITES:
        mp = load(f'{DATA}/{s}.json')['properties']['parameter']
        series = build_monthly_annual(mp)
        di, md, meta = build_daily_indices(load(f'{DATA}/{s}_daily.json')['properties']['parameter'])
        series.update(di); annual[s] = series; daily_meta[s] = meta; mon_daily[s] = md
    # ---------------- tests and families
    tests = []
    for s in SITES:
        for v in CATD:
            if v not in annual[s]: continue
            for w in WINDOWS:
                r = test_series(annual[s][v], w)
                if r is None: continue
                r.update(site=s, var=v, window=w, family='primaria' if (v in PRIMARY_VARS and w == '2001-2024') else 'exploratoria')
                tests.append(r)
    for fam in ('primaria', 'exploratoria'):
        idx = [i for i, t in enumerate(tests) if t['family'] == fam]
        q = S.bh([tests[i]['p_hr'] for i in idx])
        for i, qq in zip(idx, q): tests[i]['q'] = qq
    lookup = {(t['site'], t['var'], t['window']): t for t in tests}
    for t in tests:
        other = lookup.get((t['site'], t['var'], '1981-2024' if t['window'] == '2001-2024' else '2001-2024'))
        crit = dict(
            R1=t['q'] is not None and t['q'] < 0.05,
            R2=t['boot_ci'][0] * t['boot_ci'][1] > 0,
            R3=t['p_tfpw'] is not None and t['p_tfpw'] < 0.05,
            R4=t['jk_sign'] == 1.0 and t['jk_sig'] >= 0.9,
            R5=other is not None and (other['slope'] > 0) == (t['slope'] > 0) and other['p_hr'] is not None and other['p_hr'] < 0.10,
        )
        t.update(crit); t['score'] = sum(crit.values())
        homog = CATD[t['var']][6] in APTAS
        t['homogenea'] = homog
        t['veredicto'] = ('Robusta' if t['score'] == 5 and homog else
                          'Robusta estadísticamente, variable no apta' if t['score'] == 5 else
                          'Probable' if t['score'] >= 3 and t['R1'] else
                          'Débil' if t['p_hr'] is not None and t['p_hr'] < 0.10 else 'Sin tendencia detectable')
    return annual, tests, daily_meta, mon_daily

annual, tests, daily_meta, mon_daily = run()

# ------------------------------------------------------------------ month-by-month trends
def month_trends():
    rows = []
    for s in SITES:
        mp = load(f'{DATA}/{s}.json')['properties']['parameter']
        T = monthly_dict(mp['T2M']); P = monthly_dict(mp['PRECTOTCORR'])
        srcs = {'T2M': T, 'TX': mon_daily[s]['TX'], 'TN': mon_daily[s]['TN'], 'PRECTOTCORR': {k: v * dim(*k) for k, v in P.items()}}
        for v, src in srcs.items():
            for w, (a, b) in WINDOWS.items():
                for m in range(1, 13):
                    xs = [y for y in range(a, b + 1) if (y, m) in src]; ys = [src[(y, m)] for y in xs]
                    sen, sci = S.sen_ci(xs, ys); hr = S.hamed_rao(xs, ys)
                    rows.append(dict(key=f'{s}|{v}|{w}|{m:02d}', sitio=SITES[s], variable=v, ventana=w, mes=m, n=len(xs), sen_decada=round(sen * 10, 4),
                                     ic_lo=round(sci[0] * 10, 4), ic_hi=round(sci[1] * 10, 4), p_hamed_rao=round(hr['p'], 5),
                                     unidad='mm/mes' if v == 'PRECTOTCORR' else '°C'))
    return rows

# ------------------------------------------------------------------ window sensitivity
SWEEP_VARS = ['T2M', 'TX', 'TN', 'T2M_RANGE', 'PRECTOTCORR', 'PREC_MJJASO', 'QV2M', 'RH2M', 'GWETROOT', 'TN90p', 'TX90p', 'CLOUD_AMT']
def sweep():
    rows = []
    for s in SITES:
        for v in SWEEP_VARS:
            ser = annual[s][v]
            for a in range(1981, 2010):
                xs = [y for y in range(a, 2025) if y in ser]
                if len(xs) < 15: continue
                ys = [ser[y] for y in xs]; o = S.ols(xs, ys); hr = S.hamed_rao(xs, ys)
                rows.append(dict(key=f'{s}|{v}|{a}', sitio=SITES[s], variable=v, inicio=a, fin=2024, n=len(xs), pendiente_decada=round(o['slope'] * 10, 5),
                                 ic_lo=round(o['ci'][0] * 10, 5), ic_hi=round(o['ci'][1] * 10, 5), p_hamed_rao=round(hr['p'], 5), unidad=CATD[v][5]))
    return rows

# ------------------------------------------------------------------ spatial coherence
REG = {'T2M': ('T2M', 'mean'), 'PRECTOTCORR': ('PRECTOTCORR', 'sum'), 'QV2M': ('QV2M', 'mean'), 'RH2M': ('RH2M', 'mean'), 'TNN_MEAN': ('T2M_MIN', 'mean'), 'TXX_MEAN': ('T2M_MAX', 'mean')}
CITY = {(19.0, -98.125): 'Puebla', (18.5, -97.5): 'Tehuacán', (19.5, -98.125): 'Tlaxcala'}
def spatial():
    rows = []; summary = []
    for v, (param, how) in REG.items():
        feats = load(f'{DATA}/reg_{param}.json')['features']
        for w, (a, b) in WINDOWS.items():
            cell_rows = []
            for f in feats:
                lon, lat, elev = f['geometry']['coordinates']
                mon = monthly_dict(f['properties']['parameter'][param])
                ser = {}
                for y in range(a, b + 1):
                    if all((y, m) in mon for m in range(1, 13)):
                        tot = sum(mon[(y, m)] * dim(y, m) for m in range(1, 13))
                        ser[y] = tot if how == 'sum' else tot / (366 if calendar.isleap(y) else 365)
                xs = sorted(ser); ys = [ser[y] for y in xs]
                sen, _ = S.sen_ci(xs, ys); hr = S.hamed_rao(xs, ys); o = S.ols(xs, ys)
                cell_rows.append(dict(key=f'{v}|{w}|{lat}|{lon}', variable=v, ventana=w, lat=lat, lon=lon, elevacion=round(elev), ciudad=CITY.get((lat, lon), ''),
                                      media=round(S.mean(ys), 3), sen_decada=round(sen * 10, 4), ols_decada=round(o['slope'] * 10, 4), p_hamed_rao=round(hr['p'], 5)))
            q = S.bh([r['p_hamed_rao'] for r in cell_rows])
            for r, qq in zip(cell_rows, q): r['q_campo'] = round(qq, 5)
            rows += cell_rows
            pos = sum(r['sen_decada'] > 0 for r in cell_rows); sig = sum(r['q_campo'] < 0.10 for r in cell_rows)
            summary.append(dict(variable=v, ventana=w, celdas=len(cell_rows), positivas=pos, significativas_fdr10=sig))
    return rows, summary

# ------------------------------------------------------------------ station comparison
def ghcn(path):
    d = defaultdict(dict)
    for line in gzip.open(path, 'rt'):
        p = line.rstrip('\n').split(',')
        if p[2] in ('PRCP', 'TMAX', 'TMIN') and p[5] == '':
            d[p[2]][p[1]] = int(p[3]) / 10
    return d

def power_daily(path):
    pp = load(path)['properties']['parameter']
    return {v: {k: x for k, x in ser.items() if x != -999} for v, ser in pp.items()}

def station_compare():
    stats_rows = []; pair_rows = []
    combos = [('MXM00076685', 'Aeropuerto de Puebla (Hermanos Serdán)', 'puebla_daily.json', 'Celda Puebla 19.0N −98.125W', 2244, 2147),
              ('MXM00076683', 'Tlaxcala', 'tlaxcala_daily.json', 'Celda Tlaxcala 19.5N −98.125W', 2230, 2517)]
    for sid, sname, pfile, cname, st_elev, cell_elev in combos:
        st = ghcn(f'{DATA}/{sid}.csv.gz'); pw = power_daily(f'{DATA}/{pfile}')
        for el, pv, kind in (('PRCP', 'PRECTOTCORR', 'sum'), ('TMAX', 'T2M_MAX', 'mean'), ('TMIN', 'T2M_MIN', 'mean')):
            months = defaultdict(list)
            for day, val in st[el].items():
                if '19810101' <= day <= '20241231' and day in pw[pv]: months[(int(day[:4]), int(day[4:6]))].append((day, val, pw[pv][day]))
            good = {k: v for k, v in months.items() if len(v) >= 0.8 * dim(*k)}
            if len(good) < 24:
                stats_rows.append(dict(key=f'{sid}|{el}', estacion=sname, ghcn=sid, elemento=el, celda=cname, meses_validos=len(good), nota='Cobertura insuficiente (<24 meses con ≥80% de días).'))
                continue
            agg = lambda vals, i: (sum(v[i] for v in vals) if kind == 'sum' else S.mean([v[i] for v in vals]))
            keys = sorted(good); sv = [agg(good[k], 1) for k in keys]; pv_ = [agg(good[k], 2) for k in keys]
            clim_s = defaultdict(list); clim_p = defaultdict(list)
            for k, a, b in zip(keys, sv, pv_): clim_s[k[1]].append(a); clim_p[k[1]].append(b)
            an_s = [a - S.mean(clim_s[k[1]]) for k, a in zip(keys, sv)]; an_p = [b - S.mean(clim_p[k[1]]) for k, b in zip(keys, pv_)]
            daily_s = [v[1] for k in keys for v in good[k]]; daily_p = [v[2] for k in keys for v in good[k]]
            row = dict(key=f'{sid}|{el}', estacion=sname, ghcn=sid, elemento=el, celda=cname, elev_estacion=st_elev, elev_celda=cell_elev,
                       meses_validos=len(keys), primer_mes=f'{keys[0][0]}-{keys[0][1]:02d}', ultimo_mes=f'{keys[-1][0]}-{keys[-1][1]:02d}',
                       r_mensual=round(S.pearson(sv, pv_), 3), r_anomalias=round(S.pearson(an_s, an_p), 3), r_diario=round(S.pearson(daily_s, daily_p), 3))
            if kind == 'sum':
                row.update(razon_power_estacion=round(sum(pv_) / sum(sv), 3), sesgo_medio=round(S.mean([b - a for a, b in zip(sv, pv_)]), 2), unidad='mm/mes',
                           dias_humedos_estacion=round(100 * sum(x >= 1 for x in daily_s) / len(daily_s), 1), dias_humedos_power=round(100 * sum(x >= 1 for x in daily_p) / len(daily_p), 1))
            else:
                row.update(sesgo_medio=round(S.mean([b - a for a, b in zip(sv, pv_)]), 2), unidad='°C', sesgo_esperado_altitud=round(-0.0065 * (cell_elev - st_elev), 2))
            # annual matched totals/means for years with 12 good months
            yrs = sorted({k[0] for k in keys if all((k[0], m) in good for m in range(1, 13))})
            row['anios_completos'] = len(yrs)
            if len(yrs) >= 10:
                ann_s = [ (sum if kind == 'sum' else S.mean)([agg(good[(y, m)], 1) for m in range(1, 13)]) for y in yrs]
                ann_p = [ (sum if kind == 'sum' else S.mean)([agg(good[(y, m)], 2) for m in range(1, 13)]) for y in yrs]
                ss, _ = S.sen_ci(yrs, ann_s); sp, _ = S.sen_ci(yrs, ann_p); diff = [b - a for a, b in zip(ann_s, ann_p)]
                sd_, _ = S.sen_ci(yrs, diff)
                row.update(anios=f'{yrs[0]}–{yrs[-1]}', sen_estacion_decada=round(ss * 10, 3), p_hr_estacion=round(S.hamed_rao(yrs, ann_s)['p'], 4),
                           sen_power_decada=round(sp * 10, 3), p_hr_power=round(S.hamed_rao(yrs, ann_p)['p'], 4),
                           sen_diferencia_decada=round(sd_ * 10, 3), p_hr_diferencia=round(S.hamed_rao(yrs, diff)['p'], 4), r_anual=round(S.pearson(ann_s, ann_p), 3))
            stats_rows.append(row)
            if el == 'PRCP' or el == 'TMIN':
                for k, a, b in zip(keys, sv, pv_):
                    pair_rows.append(dict(key=f'{sid}|{el}|{k[0]}-{k[1]:02d}', estacion=sname, elemento=el, mes=f'{k[0]}-{k[1]:02d}', estacion_valor=round(a, 2), power_valor=round(b, 2)))
    return stats_rows, pair_rows

# ------------------------------------------------------------------ climatology
def climatology():
    rows = []
    for s in SITES:
        mp = load(f'{DATA}/{s}.json')['properties']['parameter']
        T = monthly_dict(mp['T2M']); P = monthly_dict(mp['PRECTOTCORR'])
        for m in range(1, 13):
            yrs = range(BASE[0], BASE[1] + 1)
            rows.append(dict(key=f'{s}|{m:02d}', sitio=SITES[s], mes=m,
                             T2M=round(S.mean([T[(y, m)] for y in yrs]), 2),
                             TX=round(S.mean([mon_daily[s]['TX'][(y, m)] for y in yrs]), 2),
                             TN=round(S.mean([mon_daily[s]['TN'][(y, m)] for y in yrs]), 2),
                             PREC=round(S.mean([P[(y, m)] * dim(y, m) for y in yrs]), 1),
                             TXx_mes=round(S.mean([monthly_dict(mp['T2M_MAX'])[(y, m)] for y in yrs]), 2),
                             TNn_mes=round(S.mean([monthly_dict(mp['T2M_MIN'])[(y, m)] for y in yrs]), 2)))
    return rows

mt = month_trends(); sw = sweep(); sp_rows, sp_summary = spatial(); st_rows, pairs = station_compare(); clim = climatology()

# ------------------------------------------------------------------ write
def r4(x, d=5): return None if x is None else round(x, d)
code_meta = [{'label': 'analyze_v2.py', 'value': open(__file__, encoding='utf-8').read(), 'type': 'code', 'lang': 'python'},
             {'label': 'stats.py', 'value': open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stats.py'), encoding='utf-8').read(), 'type': 'code', 'lang': 'python'}]
src_meta = {'label': 'Fuente', 'value': 'NASA POWER API v2.10.0 (monthly/daily point y monthly regional), community=AG, time-standard=LST; NOAA NCEI GHCN-Daily by_station. Descarga 2026-11-14.'}
def dump(name, rows, extra=None):
    json.dump({'rows': rows, 'meta': [src_meta] + (extra or []) + code_meta}, open(f'{OUT}/{name}.json', 'w', encoding='utf-8'), ensure_ascii=False)

test_rows = []
for t in tests:
    c = CATD[t['var']]; f = 10
    test_rows.append(dict(id=f"{t['site']}|{t['var']}|{t['window']}", sitio=SITES[t['site']], variable=t['var'], nombre=c[1], clase=c[6], unidad=c[5], ventana=t['window'],
        familia=t['family'], n=t['n'], media=r4(t['mean'], 4), de=r4(t['sd'], 4),
        pendiente_decada=r4(t['slope'] * f, 4), ic_ols_lo=r4(t['ci'][0] * f, 4), ic_ols_hi=r4(t['ci'][1] * f, 4),
        ic_bloque_lo=r4(t['boot_ci'][0] * f, 4), ic_bloque_hi=r4(t['boot_ci'][1] * f, 4), bloque=t['block'],
        sen_decada=r4(t['sen'] * f, 4), ic_sen_lo=r4(t['sen_ci'][0] * f, 4), ic_sen_hi=r4(t['sen_ci'][1] * f, 4),
        tau=r4(t['tau'], 3), p_ols=r4(t['p_ols']), p_mk=r4(t['p_mk']), p_hamed_rao=r4(t['p_hr']), factor_hr=r4(t['hr_factor'], 3), p_tfpw=r4(t['p_tfpw']),
        q_bh=r4(t['q']), r1=r4(t['r1'], 3), r2=r4(t['r2'], 3), cambio_estandar=r4(t['z_change'], 2),
        tendencia_minima_detectable=r4(t['mdt'] * f, 4), razon_detectabilidad=r4(t['detect_ratio'], 2),
        pettitt_anio=t['pettitt_year'], pettitt_p=r4(t['pettitt_p'], 4), pettitt_antes=r4(t['pettitt_before'], 3), pettitt_despues=r4(t['pettitt_after'], 3), quiebre_residual_anio=t['pettitt_res_year'], quiebre_residual_p=r4(t['pettitt_res_p'], 4),
        jackknife_signo=r4(t['jk_sign'], 2), jackknife_sig=r4(t['jk_sig'], 2), jackknife_min_decada=r4(t['jk_min'] * f, 4), jackknife_max_decada=r4(t['jk_max'] * f, 4),
        sin_ultimo_anio_decada=r4(t['drop_last_slope'] * f, 4), sin_ultimo_anio_p_hr=r4(t['drop_last_p_hr']),
        R1_q=t['R1'], R2_bloque=t['R2'], R3_tfpw=t['R3'], R4_jackknife=t['R4'], R5_otra_ventana=t['R5'], criterios=t['score'], apta=t['homogenea'], veredicto=t['veredicto']))
dump('tests', test_rows, [{'label': 'Familias', 'value': 'Primaria (confirmatoria): 2 sitios × {T2M, TX, TN, T2M_RANGE, PRECTOTCORR, PREC_MJJASO} × 2001–2024 = 12 hipótesis. Exploratoria: el resto. BH separado en cada familia sobre p de Hamed–Rao.'},
                          {'label': 'Robusta', 'value': 'R1 q<0.05 · R2 IC bootstrap por bloques excluye 0 · R3 TFPW p<0.05 · R4 jackknife conserva signo 100% y p_HR<0.05 en ≥90% · R5 mismo signo y p_HR<0.10 en la otra ventana · variable homogénea.'}])
ann_rows = []
for s in SITES:
    for v, ser in annual[s].items():
        for y, val in sorted(ser.items()):
            if y <= 2025: ann_rows.append(dict(key=f'{s}|{v}|{y}', sitio=SITES[s], variable=v, anio=y, valor=round(val, 4), unidad=CATD[v][5]))
dump('annual', ann_rows)
cat_rows = [dict(id=c[0], nombre=c[1], fuente=c[2], resolucion_nativa=c[3], agregado_anual=c[4], unidad=c[5], clase=c[6], definicion=c[7],
                 inicio=min(annual['puebla'][c[0]]) if c[0] in annual['puebla'] else None, fin=max(y for y in annual['puebla'][c[0]] if y <= 2025) if c[0] in annual['puebla'] else None) for c in CAT]
dump('catalog', cat_rows)
dump('monthly_trends', mt)
dump('sweep', sw)
dump('spatial', sp_rows, [{'label': 'Resumen', 'value': json.dumps(sp_summary, ensure_ascii=False)}])
dump('station_stats', st_rows)
dump('station_pairs', pairs)
dump('climatology', clim)
json.dump(dict(daily_meta=daily_meta, spatial_summary=sp_summary), open(f'{OUT}/_summary.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# console digest
print('tests', len(test_rows))
for r in sorted(test_rows, key=lambda r: (r['familia'] != 'primaria', -(r['criterios']), r['q_bh'] or 1)):
    if r['familia'] == 'primaria' or r['criterios'] >= 4:
        print(f"{r['familia'][:4]} {r['sitio'][:4]} {r['variable']:12} {r['ventana']} dec={r['pendiente_decada']:+9.4f} sen={r['sen_decada']:+9.4f} boot=[{r['ic_bloque_lo']:+.3f},{r['ic_bloque_hi']:+.3f}] pHR={r['p_hamed_rao']:.4f} q={r['q_bh']:.4f} tfpw={r['p_tfpw']:.4f} jk={r['jackknife_signo']:.2f}/{r['jackknife_sig']:.2f} R={r['criterios']} det={r['razon_detectabilidad']} pet={r['pettitt_anio']}({r['pettitt_p']}) {r['veredicto']}")
print(json.dumps(sp_summary, ensure_ascii=False))
for r in st_rows: print(r)
print(daily_meta)
