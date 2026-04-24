import { ConflictResolver } from "./conflict-resolver";
import { createPersistentOfflineQueue, OfflineQueue } from "./offline-queue";
import type { ConflictResolutionStrategy, OfflineMutation, SyncFlushResult } from "./types";

export class SyncCoordinator {
  public constructor(
    private readonly queue: OfflineQueue = createPersistentOfflineQueue(),
    private readonly resolver: ConflictResolver = new ConflictResolver(),
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

  public flush(flushedAt = new Date().toISOString()): SyncFlushResult {
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
