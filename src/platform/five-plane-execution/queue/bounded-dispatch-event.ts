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
  readonly ordering_policy_version: string;
  readonly queueClass: string;
  readonly queue_class: string;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly dlqName: string;
  readonly reasonCode: "queue.accepted" | "queue.max_depth_exceeded";
  readonly harnessRunId?: string;
  readonly executionId?: string;
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
    readonly harnessRunId?: string;
    readonly executionId?: string;
  }): BoundedDispatchEvent;
  public create(
    snapshot: BoundedDispatchQueueSnapshot,
    nodeRunId: string,
    tenantId: string,
    traceId: string,
    harnessRunId?: string,
    executionId?: string,
  ): BoundedDispatchEvent;
  public create(
    inputOrSnapshot: {
      readonly queueName: string;
      readonly nodeRunId: string;
      readonly tenantId: string;
      readonly traceId: string;
      readonly orderingPolicyVersion: string;
      readonly queueClass: string;
      readonly snapshot: BoundedDispatchQueueSnapshot;
      readonly harnessRunId?: string;
      readonly executionId?: string;
    } | BoundedDispatchQueueSnapshot,
    nodeRunId?: string,
    tenantId?: string,
    traceId?: string,
    harnessRunId?: string,
    executionId?: string,
  ): BoundedDispatchEvent {
    const normalized = this.normalizeCreateInput(
      inputOrSnapshot,
      nodeRunId,
      tenantId,
      traceId,
      harnessRunId,
      executionId,
    );
    const rejected = normalized.snapshot.queueDepthBefore >= normalized.snapshot.maxQueueDepth;
    return {
      eventType: rejected ? "platform.dispatch.queue.rejected" : "platform.dispatch.queue.accepted",
      queueName: normalized.queueName,
      nodeRunId: normalized.nodeRunId,
      tenantId: normalized.tenantId,
      traceId: normalized.traceId,
      orderingPolicyVersion: normalized.orderingPolicyVersion,
      ordering_policy_version: normalized.orderingPolicyVersion,
      queueClass: normalized.queueClass,
      queue_class: normalized.queueClass,
      queueDepthBefore: normalized.snapshot.queueDepthBefore,
      maxQueueDepth: normalized.snapshot.maxQueueDepth,
      dlqName: normalized.snapshot.dlqName,
      reasonCode: rejected ? "queue.max_depth_exceeded" : "queue.accepted",
      ...(normalized.harnessRunId != null ? { harnessRunId: normalized.harnessRunId } : {}),
      ...(normalized.executionId != null ? { executionId: normalized.executionId } : {}),
    };
  }

  private normalizeCreateInput(
    inputOrSnapshot: {
      readonly queueName: string;
      readonly nodeRunId: string;
      readonly tenantId: string;
      readonly traceId: string;
      readonly orderingPolicyVersion: string;
      readonly queueClass: string;
      readonly snapshot: BoundedDispatchQueueSnapshot;
      readonly harnessRunId?: string;
      readonly executionId?: string;
    } | BoundedDispatchQueueSnapshot,
    nodeRunId?: string,
    tenantId?: string,
    traceId?: string,
    harnessRunId?: string,
    executionId?: string,
  ): {
    readonly queueName: string;
    readonly nodeRunId: string;
    readonly tenantId: string;
    readonly traceId: string;
    readonly orderingPolicyVersion: string;
    readonly queueClass: string;
    readonly snapshot: BoundedDispatchQueueSnapshot;
    readonly harnessRunId?: string;
    readonly executionId?: string;
  } {
    if ("snapshot" in inputOrSnapshot) {
      return inputOrSnapshot;
    }
    return {
      queueName: inputOrSnapshot.queueName,
      nodeRunId: nodeRunId ?? "",
      tenantId: tenantId ?? "",
      traceId: traceId ?? "",
      orderingPolicyVersion: "1.0",
      queueClass: inputOrSnapshot.queueName,
      snapshot: inputOrSnapshot,
      ...(harnessRunId != null ? { harnessRunId } : {}),
      ...(executionId != null ? { executionId } : {}),
    };
  }
}
