'use client'

import { CloudRain, Thermometer } from 'lucide-react'
export type Variable = 'temperature' | 'precipitation'
export function VariableSelector({ value, onChange }: { value: Variable; onChange: (value: Variable) => void }) {
  return <fieldset className="field-group variable-field"><legend className="field-label">CLIMATE VARIABLE</legend><div className="variable-options"><button type="button" className={`variable-option ${value === 'temperature' ? 'selected' : ''}`} aria-pressed={value === 'temperature'} onClick={() => onChange('temperature')}><Thermometer size={16} /><span><strong>Temperature</strong><small>NASA POWER • T2M</small></span><span className="variable-unit">°C</span></button><button type="button" className={`variable-option ${value === 'precipitation' ? 'selected' : ''}`} aria-pressed={value === 'precipitation'} onClick={() => onChange('precipitation')}><CloudRain size={16} /><span><strong>Precipitation</strong><small>NASA POWER • PRECTOTCORR</small></span><span className="variable-unit">mm/yr</span></button></div><p className="field-hint">Annual temperature is a daily mean; precipitation is a daily sum.</p></fieldset>
}
