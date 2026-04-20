export interface ExplanationCacheEntry {
  readonly cacheKey: string;
  readonly summary: string;
}

export function putExplanationCacheEntry(
  cache: Readonly<Record<string, ExplanationCacheEntry>>,
  entry: ExplanationCacheEntry,
): Record<string, ExplanationCacheEntry> {
  return {
    ...cache,
    [entry.cacheKey]: entry,
  };
}
