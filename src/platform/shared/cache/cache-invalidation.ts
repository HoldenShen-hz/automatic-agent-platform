/**
 * Cache Invalidation Engine
 *
 * Provides centralized cache invalidation logic triggered by
 * file changes, session close, instruction updates, etc.
 */

export interface CacheInvalidationTarget {
  invalidateByTag(tag: string): Promise<number>;
  invalidateNamespace(namespace: string): Promise<number>;
}

export class CacheInvalidationEngine {
  constructor(private readonly cache: CacheInvalidationTarget) {}

  /**
   * Called when a file is modified.
   * Invalidates all cache entries tagged with the file path.
   */
  async onFileChanged(normalizedPath: string): Promise<number> {
    const tag = `file:${normalizedPath}`;
    return this.cache.invalidateByTag(tag);
  }

  /**
   * Called when a session is closed.
   * Invalidates all cache entries tagged with the session.
   */
  async onSessionClosed(sessionId: string): Promise<number> {
    const tag = `session:${sessionId}`;
    return this.cache.invalidateByTag(tag);
  }

  /**
   * Called when an instruction is updated.
   * Invalidates all cache entries tagged with the instruction fingerprint.
   */
  async onInstructionChanged(fingerprint: string): Promise<number> {
    const tag = `instruction:${fingerprint}`;
    return this.cache.invalidateByTag(tag);
  }

  /**
   * Called when a repository is rebuilt.
   * Invalidates all cache entries tagged with the repo.
   */
  async onRepoRebuilt(repoId: string): Promise<number> {
    const tag = `repo:${repoId}`;
    return this.cache.invalidateByTag(tag);
  }

  /**
   * Called when a tool is updated.
   * Invalidates all cache entries for that tool.
   */
  async onToolUpdated(toolName: string): Promise<number> {
    const tag = `tool:${toolName}`;
    return this.cache.invalidateByTag(tag);
  }

  /**
   * Invalidates all entries in a namespace.
   */
  async invalidateNamespace(namespace: string): Promise<number> {
    return this.cache.invalidateNamespace(namespace);
  }

  /**
   * Bulk invalidation for multiple tags.
   */
  async invalidateTags(tags: string[]): Promise<number> {
    const counts = await Promise.all(tags.map((tag) => this.cache.invalidateByTag(tag)));
    return counts.reduce((sum, count) => sum + count, 0);
  }
}
