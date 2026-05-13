export abstract class SyncBackedAsyncService<TSync> {
  protected readonly sync: TSync;

  protected constructor(factory: () => TSync) {
    this.sync = factory();
  }

  /**
   * R30-29 fix: Wraps synchronous operation in try-catch to ensure exceptions
   * are converted to rejected Promises rather than propagating as uncaught errors.
   * Previously: Promise.resolve(operation(this.sync)) - if operation threw, exception
   * propagated uncaught because Promise.resolve() doesn't catch sync exceptions.
   */
  protected asPromise<TResult>(operation: (sync: TSync) => TResult): Promise<TResult> {
    try {
      const result = operation(this.sync);
      return Promise.resolve(result);
    } catch (error) {
      const rejected = Promise.reject(error) as Promise<TResult>;
      // Some legacy callers only assert that a Promise is returned. Mark the
      // rejection handled while preserving rejection semantics for await/assert.rejects.
      rejected.catch(() => undefined);
      return rejected;
    }
  }

  public getSyncService(): TSync {
    return this.sync;
  }
}
