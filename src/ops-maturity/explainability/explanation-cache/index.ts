export interface ExplanationCacheEntry {
  readonly cacheKey: string;
  readonly summary: string;
  readonly ttlHours: number;
  readonly createdAt?: string;
  readonly expiresAt?: string | null;
}

export function putExplanationCacheEntry(
  cache: Readonly<Record<string, ExplanationCacheEntry>>,
  entry: ExplanationCacheEntry,
): Record<string, ExplanationCacheEntry> {
  if (!Number.isFinite(entry.ttlHours) || entry.ttlHours <= 0) {
    return Object.assign(Object.create(null), cache) as Record<string, ExplanationCacheEntry>;
  }
  const createdAt = entry.createdAt ?? new Date().toISOString();
  const expiresAt = entry.expiresAt ?? new Date(Date.parse(createdAt) + entry.ttlHours * 60 * 60 * 1000).toISOString();
  return Object.assign(Object.create(null), cache, {
    [entry.cacheKey]: {
      ...entry,
      createdAt,
      expiresAt,
    },
  }) as Record<string, ExplanationCacheEntry>;
}
