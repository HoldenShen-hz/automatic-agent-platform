export interface BoundedDispatchQueueSnapshot {
  readonly queueName: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
}

export interface BoundedDispatchEvent {
  readonly eventType: "platform.dispatch.queue.accepted" | "platform.dispatch.queue.rejected";
  readonly queueName: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
  readonly reasonCode: "queue.accepted" | "queue.max_depth_exceeded";
}

export class BoundedDispatchQueueEventFactory {
  public create(snapshot: BoundedDispatchQueueSnapshot): BoundedDispatchEvent {
    const rejected = snapshot.queueDepthBefore >= snapshot.maxQueueDepth;
    return {
      eventType: rejected ? "platform.dispatch.queue.rejected" : "platform.dispatch.queue.accepted",
      queueName: snapshot.queueName,
      queueDepthBefore: snapshot.queueDepthBefore,
      maxQueueDepth: snapshot.maxQueueDepth,
      dlqName: snapshot.dlqName,
      reasonCode: rejected ? "queue.max_depth_exceeded" : "queue.accepted",
    };
  }
}
