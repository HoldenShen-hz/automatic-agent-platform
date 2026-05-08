export interface ExplanationCacheEntry {
  readonly cacheKey: string;
  readonly summary: string;
  readonly ttlHours: 24 | 0;
}

export function putExplanationCacheEntry(
  cache: Readonly<Record<string, ExplanationCacheEntry>>,
  entry: ExplanationCacheEntry,
): Record<string, ExplanationCacheEntry> {
  if (entry.ttlHours === 0) {
    return { ...cache };
  }
  return {
    ...cache,
    [entry.cacheKey]: entry,
  };
}
