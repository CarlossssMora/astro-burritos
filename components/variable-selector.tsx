'use client'

import { CloudRain, Thermometer } from 'lucide-react'
export type Variable = 'temperature' | 'precipitation'
export function VariableSelector({ value, onChange }: { value: Variable; onChange: (value: Variable) => void }) {
  return <fieldset className="field-group variable-field"><legend className="field-label">CLIMATE VARIABLE</legend><div className="variable-options"><button type="button" className={`variable-option ${value === 'temperature' ? 'selected' : ''}`} aria-pressed={value === 'temperature'} onClick={() => onChange('temperature')}><span className="variable-icon"><Thermometer size={16} /></span><span><strong>Temperature</strong><small>NASA POWER • T2M</small></span><span className="variable-unit">°C</span></button><button type="button" className={`variable-option ${value === 'precipitation' ? 'selected' : ''}`} aria-pressed={value === 'precipitation'} onClick={() => onChange('precipitation')}><span className="variable-icon"><CloudRain size={16} /></span><span><strong>Precipitation</strong><small>NASA POWER • PRECTOTCORR</small></span><span className="variable-unit">mm/year</span></button></div><p className="field-hint">Annual temperature is a day-weighted mean; precipitation is a calendar-day total.</p></fieldset>
}
