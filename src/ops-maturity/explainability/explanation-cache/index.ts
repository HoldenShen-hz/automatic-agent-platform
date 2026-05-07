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

export class ExplanationCache<T = unknown> {
  private readonly entries = new Map<string, T>();

  public constructor(_options: { readonly ttlSeconds: number }) {}

  public set(key: string, value: T): void {
    this.entries.set(key, value);
  }

  public get(key: string): T | null {
    return this.entries.get(key) ?? null;
  }
}
