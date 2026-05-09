export interface BoundedDispatchQueueSnapshot {
  readonly queueName: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
}

export interface BoundedDispatchEvent {
  readonly eventType: "platform.dispatch.queue.accepted" | "platform.dispatch.queue.rejected";
  readonly queueName: string;
  readonly nodeRunId: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly orderingPolicyVersion: string;
  readonly queueClass: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
  readonly reasonCode: "queue.accepted" | "queue.max_depth_exceeded";
}

export class BoundedDispatchQueueEventFactory {
  public create(input: {
    readonly queueName: string;
    readonly nodeRunId: string;
    readonly tenantId: string;
    readonly traceId: string;
    readonly orderingPolicyVersion: string;
    readonly queueClass: string;
    readonly snapshot: BoundedDispatchQueueSnapshot;
  }): BoundedDispatchEvent {
    const rejected = input.snapshot.queueDepthBefore >= input.snapshot.maxQueueDepth;
    return {
      eventType: rejected ? "platform.dispatch.queue.rejected" : "platform.dispatch.queue.accepted",
      queueName: input.queueName,
      nodeRunId: input.nodeRunId,
      tenantId: input.tenantId,
      traceId: input.traceId,
      orderingPolicyVersion: input.orderingPolicyVersion,
      queueClass: input.queueClass,
      queueDepthBefore: input.snapshot.queueDepthBefore,
      maxQueueDepth: input.snapshot.maxQueueDepth,
      dlqName: input.snapshot.dlqName,
      reasonCode: rejected ? "queue.max_depth_exceeded" : "queue.accepted",
    };
  }
}
