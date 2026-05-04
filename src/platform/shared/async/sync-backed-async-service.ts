export abstract class SyncBackedAsyncService<TSync> {
  protected readonly sync: TSync;

  protected constructor(factory: () => TSync) {
    this.sync = factory();
  }

  protected asPromise<TResult>(operation: (sync: TSync) => TResult): Promise<TResult> {
    // R30-29 FIX: Wrap synchronous operation in try-catch before Promise.resolve().
    // Root cause: Previously, if operation() threw synchronously, the exception would
    // propagate as an uncaught exception rather than being converted to a rejected Promise.
    // This violates the contract that asPromise() always returns a Promise.
    try {
      return Promise.resolve(operation(this.sync));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  public getSyncService(): TSync {
    return this.sync;
  }
}
