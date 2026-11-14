'use client'

import type { CSSProperties } from 'react'
import { Minus, Plus } from 'lucide-react'

const STEPS = 1000
const BUTTON_FACTOR = 1.5

// Vertical zoom slider: a native range (keyboard, screen readers and touch for free) on a log scale,
// so each notch multiplies the zoom by the same factor and 0.5×→1× feels like 4×→8×.
export function ZoomControl({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (zoom: number, animate: boolean) => void }) {
  const clamp = (zoom: number) => Math.min(max, Math.max(min, zoom))
  const position = Math.round((Math.log(clamp(value) / min) / Math.log(max / min)) * STEPS)
  const readout = `${value.toFixed(1)}×`

  return <div className="zoom-control" role="group" aria-label={label}>
    <button type="button" className="zoom-step" aria-label={`${label}: zoom in`} title="Zoom in" disabled={value >= max - 1e-6} onClick={() => onChange(clamp(value * BUTTON_FACTOR), true)}><Plus size={16} /></button>
    <input className="zoom-range" type="range" min={0} max={STEPS} value={position} aria-label={label} aria-valuetext={readout} style={{ '--fill': `${(position / STEPS) * 100}%` } as CSSProperties} onChange={(event) => onChange(min * (max / min) ** (Number(event.target.value) / STEPS), false)} />
    <button type="button" className="zoom-step" aria-label={`${label}: zoom out`} title="Zoom out" disabled={value <= min + 1e-6} onClick={() => onChange(clamp(value / BUTTON_FACTOR), true)}><Minus size={16} /></button>
    <output className="zoom-readout" aria-live="polite">{readout}</output>
  </div>
}
