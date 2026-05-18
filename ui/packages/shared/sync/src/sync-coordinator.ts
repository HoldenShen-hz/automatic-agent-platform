import { ConflictResolver } from "./conflict-resolver.js";
import { createPersistentOfflineQueue, OfflineQueue } from "./offline-queue.js";
import type { ConflictResolutionStrategy, OfflineMutation, SyncFlushResult } from "./types.js";

export interface SyncMutationDispatcher {
  dispatch?(mutation: OfflineMutation): Promise<unknown>;
  request?(mutation: OfflineMutation): Promise<unknown>;
}

export class SyncCoordinator {
  public constructor(
    private readonly queue: OfflineQueue = createPersistentOfflineQueue(),
    private readonly resolver: ConflictResolver = new ConflictResolver(),
    private readonly dispatcher: SyncMutationDispatcher = new FetchSyncMutationDispatcher(),
  ) {}

  public queueMutation(mutation: OfflineMutation): Promise<void> {
    return this.queue.enqueue(mutation);
  }

  public async queueMutations(mutations: readonly OfflineMutation[]): Promise<void> {
    await Promise.all(mutations.map(async (mutation) => {
      await this.queue.enqueue(mutation);
    }));
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
    const succeeded: OfflineMutation[] = [];
    const failed: OfflineMutation[] = [];
    const conflicts: Array<{ mutation: OfflineMutation; serverValue: unknown }> = [];
    const retained: OfflineMutation[] = [];

    for (const mutation of mutations) {
      try {
        const response = await this.send(mutation);
        if (isConflictResponse(response)) {
          const conflictedMutation: OfflineMutation = {
            ...mutation,
            status: "conflict",
          };
          conflicts.push({
            mutation: conflictedMutation,
            serverValue: response.serverValue,
          });
          retained.push(conflictedMutation);
          continue;
        }
        succeeded.push(mutation);
      } catch {
        const retryableMutation: OfflineMutation = {
          ...mutation,
          retryCount: (mutation.retryCount ?? 0) + 1,
          status: "pending",
        };
        failed.push(retryableMutation);
        retained.push(retryableMutation);
      }
    }
    await this.queue.replace(retained);
    return {
      succeeded,
      failed,
      conflicts,
      mutations: succeeded,
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

  private async send(mutation: OfflineMutation): Promise<unknown> {
    if (typeof this.dispatcher.dispatch === "function") {
      return await this.dispatcher.dispatch(mutation);
    }
    if (typeof this.dispatcher.request === "function") {
      return await this.dispatcher.request(mutation);
    }
    throw new TypeError("sync.dispatcher_missing");
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
      ...(mutation.body == null ? {} : { body: JSON.stringify(mutation.body) }),
    });
    if (!response.ok) {
      throw new Error(`sync.flush_failed:${response.status}`);
    }
  }
}

function isConflictResponse(value: unknown): value is { conflict: true; serverValue: unknown } {
  return value != null
    && typeof value === "object"
    && (value as { conflict?: unknown }).conflict === true;
}
