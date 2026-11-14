# Scripts de la auditoría de datos v2

Python 3 estándar, sin dependencias. Generan `docs/backend/data/*.json` y `docs/backend/frontend-data-handoff.md`.

| Script | Qué hace |
|---|---|
| `stats.py` | OLS con t, Mann–Kendall, Hamed–Rao, TFPW, IC de Sen, bootstrap de bloques, Pettitt, Benjamini–Hochberg y tendencia mínima detectable. Implementación de referencia para el backend (ver A7 del reporte). |
| `analyze_v2.py` | Construye las 35 series anuales e índices diarios, corre las 138 pruebas, la tendencia por mes, la sensibilidad al año de inicio, la coherencia espacial y la comparación con estaciones. |
| `build_meta.py` | Cobertura, revisión del pipeline, fuentes y correcciones. |
| `build_report.py` | Genera el reporte en Markdown desde los JSON. |
| (fuera del repositorio) `harness/run.ts` | Ejecuta las funciones del repositorio sobre los mismos datos y produce `data/ts_results.json`, que usan `build_meta.py` y `build_report.py`. No se versiona aquí para que `tsc` y `next build` no lo compilen: requiere una copia de `lib/` con los imports `@/lib/...` reescritos a rutas relativas `.ts` y Node ≥ 22.18. |

## Estructura esperada

```text
<carpeta>/
  data/            # entradas descargadas (no versionadas)
  v2/out/          # salidas JSON (se crea solo)
```

## Descargas (2026-11-14)

- `data/puebla.json` y `data/tehuacan.json`: `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,T2M_MAX,T2M_MIN,T2M_RANGE,PRECTOTCORR,RH2M,QV2M,WS2M,ALLSKY_SFC_SW_DWN,GWETROOT,GWETTOP,PS,CLOUD_AMT&community=AG&longitude={lon}&latitude={lat}&start=1981&end=2025&format=JSON&time-standard=LST` con Puebla (19.04, −98.20) y Tehuacán (18.46, −97.39).
- `data/puebla_daily.json`, `data/tehuacan_daily.json`: `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2M,PRECTOTCORR&community=AG&longitude={lon}&latitude={lat}&start=19810101&end=20241231&format=JSON&time-standard=LST`.
- `data/tlaxcala_daily.json`: igual, en (19.3167, −98.2333), añadiendo `T2M_RANGE`.
- `data/reg_{P}.json` para `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `QV2M`, `RH2M`: `https://power.larc.nasa.gov/api/temporal/monthly/regional?parameters={P}&community=AG&latitude-min=17.75&latitude-max=20.75&longitude-min=-99.25&longitude-max=-96.75&start=1981&end=2024&format=JSON`.
- `data/MXM00076683.csv.gz`, `data/MXM00076685.csv.gz`: `https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/<id>.csv.gz`.
- `data/ghcnd-inventory.txt`: `https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt`.

## Ejecución

```bash
python -I docs/backend/analysis/analyze_v2.py <carpeta>
python -I docs/backend/analysis/build_meta.py <carpeta>
python -I docs/backend/analysis/build_report.py <carpeta> docs/backend/frontend-data-handoff.md
```
