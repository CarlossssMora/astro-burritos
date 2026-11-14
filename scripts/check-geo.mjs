// Self-check for the 2D map projection in lib/geo.ts. Run: node scripts/check-geo.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fitProjection, niceKm } from '../lib/geo.ts'

const load = (path) => JSON.parse(readFileSync(new URL(`../public/geo/${path}`, import.meta.url)))
const inside = ({ project }, geometry, width, height) => {
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
  return rings.flat().every(([lon, lat]) => { const [x, y] = project(lon, lat); return x >= -0.5 && x <= width + 0.5 && y >= -0.5 && y <= height + 0.5 })
}

const puebla = load('admin1/MEX.json').features.find((f) => f.properties.name === 'Puebla')
const fit = fitProjection(puebla.geometry, 600, 320)
assert.ok(inside(fit, puebla.geometry, 600, 320), 'Puebla fits the viewBox')
const [x, y] = fit.project(puebla.properties.longitude, puebla.properties.latitude)
assert.ok(x > 0 && x < 600 && y > 0 && y < 320, 'Puebla label point lands inside the viewBox')

const russia = load('countries.json').features.find((f) => f.properties.ADM0_A3 === 'RUS')
const fitRussia = fitProjection(russia.geometry, 600, 320)
assert.ok(inside(fitRussia, russia.geometry, 600, 320), 'Russia fits after the antimeridian shift')
// Unwrapped, Russia spans ~360° (≈34 km/px at 600×320); shifted it spans ~170° (≈16 km/px).
assert.ok(fitRussia.kmPerPixel < 20, `Russia is not squashed (km/px = ${fitRussia.kmPerPixel.toFixed(1)})`)

assert.deepEqual([0.7, 1, 3, 7, 19, 250, 999].map(niceKm), [0.5, 1, 2, 5, 10, 200, 500])
console.log('geo checks passed')
