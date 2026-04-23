/**
 * Cache Invalidation Engine
 *
 * Provides centralized cache invalidation logic triggered by
 * file changes, session close, instruction updates, etc.
 */
export class CacheInvalidationEngine {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    /**
     * Called when a file is modified.
     * Invalidates all cache entries tagged with the file path.
     */
    async onFileChanged(normalizedPath) {
        const tag = `file:${normalizedPath}`;
        return this.cache.invalidateByTag(tag);
    }
    /**
     * Called when a session is closed.
     * Invalidates all cache entries tagged with the session.
     */
    async onSessionClosed(sessionId) {
        const tag = `session:${sessionId}`;
        return this.cache.invalidateByTag(tag);
    }
    /**
     * Called when an instruction is updated.
     * Invalidates all cache entries tagged with the instruction fingerprint.
     */
    async onInstructionChanged(fingerprint) {
        const tag = `instruction:${fingerprint}`;
        return this.cache.invalidateByTag(tag);
    }
    /**
     * Called when a repository is rebuilt.
     * Invalidates all cache entries tagged with the repo.
     */
    async onRepoRebuilt(repoId) {
        const tag = `repo:${repoId}`;
        return this.cache.invalidateByTag(tag);
    }
    /**
     * Called when a tool is updated.
     * Invalidates all cache entries for that tool.
     */
    async onToolUpdated(toolName) {
        const tag = `tool:${toolName}`;
        return this.cache.invalidateByTag(tag);
    }
    /**
     * Invalidates all entries in a namespace.
     */
    async invalidateNamespace(namespace) {
        return this.cache.invalidateNamespace(namespace);
    }
    /**
     * Bulk invalidation for multiple tags.
     */
    async invalidateTags(tags) {
        let total = 0;
        for (const tag of tags) {
            total += await this.cache.invalidateByTag(tag);
        }
        return total;
    }
}
//# sourceMappingURL=cache-invalidation.js.map