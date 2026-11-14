import { describe, expect, it } from 'vitest'
import { resolveCommonCompleteWindow } from '../../lib/analysis/common-window'
import { adjustBenjaminiHochberg } from '../../lib/analysis/multiple-testing'

describe('multi-source analysis utilities', () => {
  it('selects the longest continuous common window from source manifests', () => {
    const window = resolveCommonCompleteWindow([
      { sourceId: 'power', completeYears: [2001, 2002, 2003, 2004, 2006, 2007] },
      { sourceId: 'imerg', completeYears: [2001, 2002, 2003, 2004, 2005, 2006] },
    ])
    expect(window).toMatchObject({ startYear: 2001, endYear: 2004, completeYears: [2001, 2002, 2003, 2004] })
  })

  it('adjusts one pre-declared p-value family without changing record order', () => {
    const adjusted = adjustBenjaminiHochberg([
      { id: 'site-a', pValue: 0.01 },
      { id: 'site-b', pValue: 0.04 },
      { id: 'site-c', pValue: null },
    ])
    expect(adjusted.map((record) => record.id)).toEqual(['site-a', 'site-b', 'site-c'])
    expect(adjusted[0].qValue).toBeCloseTo(0.02)
    expect(adjusted[1].qValue).toBeCloseTo(0.04)
    expect(adjusted[2].qValue).toBeNull()
  })
})
