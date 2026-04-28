export interface BoundedDispatchQueueSnapshot {
  readonly queueName: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
}

export interface BoundedDispatchEvent {
  readonly eventType: "platform.dispatch.queue.accepted" | "platform.dispatch.queue.rejected";
  readonly nodeRunId: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly queueName: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
  readonly reasonCode: "queue.accepted" | "queue.max_depth_exceeded";
  readonly ordering_policy_version: string;
  readonly queue_class: string;
  readonly harnessRunId?: string;
  readonly executionId?: string;
}

export class BoundedDispatchQueueEventFactory {
  public create(snapshot: BoundedDispatchQueueSnapshot, nodeRunId: string, tenantId: string, traceId: string): BoundedDispatchEvent {
    const rejected = snapshot.queueDepthBefore >= snapshot.maxQueueDepth;
    return {
      eventType: rejected ? "platform.dispatch.queue.rejected" : "platform.dispatch.queue.accepted",
      nodeRunId,
      tenantId,
      traceId,
      queueName: snapshot.queueName,
      queueDepthBefore: snapshot.queueDepthBefore,
      maxQueueDepth: snapshot.maxQueueDepth,
      dlqName: snapshot.dlqName,
      reasonCode: rejected ? "queue.max_depth_exceeded" : "queue.accepted",
      ordering_policy_version: "1.0",
      queue_class: snapshot.queueName,
    };
  }
}
