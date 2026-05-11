import { ConflictResolver } from "./conflict-resolver";
import { createPersistentOfflineQueue, OfflineQueue } from "./offline-queue";
import type { ConflictResolutionStrategy, OfflineMutation, SyncFlushResult } from "./types";

export interface SyncMutationDispatcher {
  dispatch(mutation: OfflineMutation): Promise<void>;
}

export class SyncCoordinator {
  public constructor(
    private readonly queue: OfflineQueue = createPersistentOfflineQueue(),
    private readonly resolver: ConflictResolver = new ConflictResolver(),
    private readonly dispatcher: SyncMutationDispatcher = new FetchSyncMutationDispatcher(),
  ) {}

  public queueMutation(mutation: OfflineMutation): void {
    this.queue.enqueue(mutation);
  }

  public queueMutations(mutations: readonly OfflineMutation[]): void {
    for (const mutation of mutations) {
      this.queue.enqueue(mutation);
    }
  }

  public hasPending(): boolean {
    return !this.queue.isEmpty();
  }

  public pendingCount(): number {
    return this.queue.size();
  }

  public peekPending(): readonly OfflineMutation[] {
    return this.queue.peek();
  }

  public async flush(flushedAt = new Date().toISOString()): Promise<SyncFlushResult> {
    const mutations = this.queue.peek();
    for (const mutation of mutations) {
      await this.dispatcher.dispatch(mutation);
    }
    return {
      mutations: this.queue.drain(),
      flushedAt,
    };
  }

  public resolveConflict<T>(
    serverValue: T,
    localValue: T,
    strategy: ConflictResolutionStrategy = "server_wins",
  ): T {
    return this.resolver.resolve(serverValue, localValue, strategy);
  }
}

export class FetchSyncMutationDispatcher implements SyncMutationDispatcher {
  public constructor(private readonly fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  public async dispatch(mutation: OfflineMutation): Promise<void> {
    const response = await this.fetchImplementation(mutation.endpoint, {
      method: mutation.method,
      headers: {
        "content-type": "application/json",
      },
      body: mutation.body == null ? undefined : JSON.stringify(mutation.body),
    });
    if (!response.ok) {
      throw new Error(`sync.flush_failed:${response.status}`);
    }
  }
}
