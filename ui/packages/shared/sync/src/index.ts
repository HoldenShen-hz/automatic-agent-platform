export interface OfflineMutation {
  readonly id: string;
  readonly endpoint: string;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body: unknown;
  readonly createdAt: string;
}

export class OfflineQueue {
  private readonly queue: OfflineMutation[] = [];

  public enqueue(mutation: OfflineMutation): void {
    this.queue.push(mutation);
  }

  public drain(): OfflineMutation[] {
    const drained = [...this.queue];
    this.queue.length = 0;
    return drained;
  }

  public size(): number {
    return this.queue.length;
  }
}

export class ConflictResolver {
  public resolve<T>(serverValue: T, localValue: T, strategy: "server_wins" | "local_wins" = "server_wins"): T {
    return strategy === "local_wins" ? localValue : serverValue;
  }
}

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
