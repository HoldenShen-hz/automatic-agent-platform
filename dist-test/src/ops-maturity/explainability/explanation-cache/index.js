export function putExplanationCacheEntry(cache, entry) {
    return {
        ...cache,
        [entry.cacheKey]: entry,
    };
}
//# sourceMappingURL=index.js.map