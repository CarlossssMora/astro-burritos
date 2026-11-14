export type SourceCoverageManifest = {
  sourceId: string
  completeYears: number[]
}

export type CommonCompleteWindow = {
  sourceIds: string[]
  startYear: number
  endYear: number
  completeYears: number[]
}

function longestContiguousRun(years: number[]) {
  if (!years.length) return []
  let best = [years[0]]
  let current = [years[0]]
  for (const year of years.slice(1)) {
    if (year === current[current.length - 1] + 1) current.push(year)
    else {
      if (current.length > best.length || (current.length === best.length && current.at(-1)! > best.at(-1)!)) best = current
      current = [year]
    }
  }
  if (current.length > best.length || (current.length === best.length && current.at(-1)! > best.at(-1)!)) best = current
  return best
}

/** Finds the longest continuous year range present in every selected source. */
export function resolveCommonCompleteWindow(manifests: SourceCoverageManifest[], minimumStartYear = 2001): CommonCompleteWindow | null {
  if (!manifests.length) return null
  const intersection = manifests.reduce<number[] | null>((years, manifest) => {
    const available = new Set(manifest.completeYears.filter((year) => Number.isInteger(year) && year >= minimumStartYear))
    if (years === null) return [...available].sort((first, second) => first - second)
    return years.filter((year) => available.has(year))
  }, null) ?? []
  const completeYears = longestContiguousRun(intersection.sort((first, second) => first - second))
  if (!completeYears.length) return null
  return { sourceIds: manifests.map((manifest) => manifest.sourceId), startYear: completeYears[0], endYear: completeYears.at(-1)!, completeYears }
}
