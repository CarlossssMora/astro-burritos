export type PValueRecord = {
  id: string
  pValue: number | null
}

export type AdjustedPValue = PValueRecord & {
  qValue: number | null
  significantAt05: boolean | null
}

/** Benjamini–Hochberg adjustment for one pre-declared hypothesis family. */
export function adjustBenjaminiHochberg(records: PValueRecord[], alpha = 0.05): AdjustedPValue[] {
  if (!(alpha > 0 && alpha < 1)) throw new Error('The BH alpha must be between 0 and 1.')
  const valid = records
    .filter((record) => record.pValue !== null && Number.isFinite(record.pValue) && record.pValue >= 0 && record.pValue <= 1)
    .sort((first, second) => (first.pValue as number) - (second.pValue as number))
  const qValues = new Map<string, number>()
  let runningMinimum = 1
  for (let index = valid.length - 1; index >= 0; index -= 1) {
    const pValue = valid[index].pValue as number
    runningMinimum = Math.min(runningMinimum, (pValue * valid.length) / (index + 1))
    qValues.set(valid[index].id, Math.min(1, runningMinimum))
  }
  return records.map((record) => {
    const qValue = qValues.get(record.id) ?? null
    return { ...record, qValue, significantAt05: qValue === null ? null : qValue <= alpha }
  })
}
