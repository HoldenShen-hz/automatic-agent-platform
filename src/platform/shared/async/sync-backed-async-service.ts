export abstract class SyncBackedAsyncService<TSync> {
  protected readonly sync: TSync;

  protected constructor(factory: () => TSync) {
    this.sync = factory();
  }

  protected asPromise<TResult>(operation: (sync: TSync) => TResult): Promise<TResult> {
    // R30-29 FIX: Wrap operation in a Promise executor so it runs asynchronously
    // rather than executing synchronously before Promise.resolve() wraps it.
    // Root cause: Previously, operation(this.sync) was called first synchronously,
    // then its result was passed to Promise.resolve(). If operation() threw synchronously,
    // the exception could propagate as uncaught. The Promise executor always runs
    // asynchronously, properly converting sync errors to rejections.
    return new Promise((resolve, reject) => {
      try {
        const result = operation(this.sync);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  public getSyncService(): TSync {
    return this.sync;
  }
}
