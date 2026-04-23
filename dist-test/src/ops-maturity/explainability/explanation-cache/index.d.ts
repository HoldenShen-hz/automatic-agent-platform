export interface ExplanationCacheEntry {
    readonly cacheKey: string;
    readonly summary: string;
}
export declare function putExplanationCacheEntry(cache: Readonly<Record<string, ExplanationCacheEntry>>, entry: ExplanationCacheEntry): Record<string, ExplanationCacheEntry>;
