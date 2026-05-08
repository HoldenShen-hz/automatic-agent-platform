export abstract class SyncBackedAsyncService<TSync> {
  protected readonly sync: TSync;

  protected constructor(factory: () => TSync) {
    this.sync = factory();
  }

  protected asPromise<TResult>(operation: (sync: TSync) => TResult): Promise<TResult> {
    return Promise.resolve(operation(this.sync));
  }

  public getSyncService(): TSync {
    return this.sync;
  }
}
