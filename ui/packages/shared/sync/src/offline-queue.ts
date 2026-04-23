import type { OfflineMutation } from "./types";

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

  public peek(): readonly OfflineMutation[] {
    return [...this.queue];
  }

  public size(): number {
    return this.queue.length;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
