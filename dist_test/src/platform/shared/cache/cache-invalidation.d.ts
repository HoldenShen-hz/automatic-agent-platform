/**
 * Cache Invalidation Engine
 *
 * Provides centralized cache invalidation logic triggered by
 * file changes, session close, instruction updates, etc.
 */
import type { CacheFacade } from './cache-facade.js';
export declare class CacheInvalidationEngine {
    private readonly cache;
    constructor(cache: CacheFacade);
    /**
     * Called when a file is modified.
     * Invalidates all cache entries tagged with the file path.
     */
    onFileChanged(normalizedPath: string): Promise<number>;
    /**
     * Called when a session is closed.
     * Invalidates all cache entries tagged with the session.
     */
    onSessionClosed(sessionId: string): Promise<number>;
    /**
     * Called when an instruction is updated.
     * Invalidates all cache entries tagged with the instruction fingerprint.
     */
    onInstructionChanged(fingerprint: string): Promise<number>;
    /**
     * Called when a repository is rebuilt.
     * Invalidates all cache entries tagged with the repo.
     */
    onRepoRebuilt(repoId: string): Promise<number>;
    /**
     * Called when a tool is updated.
     * Invalidates all cache entries for that tool.
     */
    onToolUpdated(toolName: string): Promise<number>;
    /**
     * Invalidates all entries in a namespace.
     */
    invalidateNamespace(namespace: string): Promise<number>;
    /**
     * Bulk invalidation for multiple tags.
     */
    invalidateTags(tags: string[]): Promise<number>;
}
