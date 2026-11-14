# Respuestas de ejemplo de la API v2

Respuestas reales de `GET /api/variables`, `GET /api/point` y `GET|POST /api/region`, generadas el 2026-11-14 contra NASA POWER con el servidor de este repositorio. Tienen exactamente la forma de los tipos de `lib/api/v2.ts`.

Uso previsto:

- Desarrollar la interfaz sin red (importarlas o servirlas desde un mock).
- Pruebas de componentes con datos reales.

No se sirven desde `public/` y no deben usarse en producción: la interfaz debe llamar a la API. La lista con la petición de cada archivo está en `docs/backend/api-v2.md`, sección 5.

Los polígonos de los estados de Puebla y Tlaxcala son los de Natural Earth que la interfaz ya usa (`public/geo/admin1/MEX.json` en `main`).
