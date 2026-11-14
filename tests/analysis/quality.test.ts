import { describe, expect, it } from 'vitest'
import { resolveCommonCompleteWindow, resolveCommonMonthlyWindow } from '../../lib/analysis/common-window'
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

  it('discards partial boundary years from a monthly common window', () => {
    const months = (start: number, end: number) => Array.from({ length: (end - start + 1) * 12 }, (_, index) => {
      const year = start + Math.floor(index / 12)
      const month = (index % 12) + 1
      return `${year}-${String(month).padStart(2, '0')}`
    })
    const window = resolveCommonMonthlyWindow([
      { sourceId: 'power', completeYears: [], completeMonths: ['2001-06', '2001-07', ...months(2002, 2004), '2005-01'] },
      { sourceId: 'imerg', completeYears: [], completeMonths: ['2001-01', ...months(2002, 2004), '2005-12'] },
    ])
    expect(window).toMatchObject({ startYear: 2002, endYear: 2004, startMonth: '2002-01', endMonth: '2004-12' })
    expect(window?.completeMonths).toHaveLength(36)
  })
})
