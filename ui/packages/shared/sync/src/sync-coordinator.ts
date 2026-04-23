import { ConflictResolver } from "./conflict-resolver";
import { OfflineQueue } from "./offline-queue";
import type { OfflineMutation } from "./types";

export class SyncCoordinator {
  public constructor(
    private readonly queue: OfflineQueue = new OfflineQueue(),
    private readonly resolver: ConflictResolver = new ConflictResolver(),
  ) {}

  public queueMutation(mutation: OfflineMutation): void {
    this.queue.enqueue(mutation);
  }

  public flush(): OfflineMutation[] {
    return this.queue.drain();
  }

  public resolveConflict<T>(serverValue: T, localValue: T): T {
    return this.resolver.resolve(serverValue, localValue);
  }
}
