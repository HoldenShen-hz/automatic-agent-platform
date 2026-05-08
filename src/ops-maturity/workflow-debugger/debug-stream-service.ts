import { nowIso } from "../../platform/contracts/types/ids.js";

export interface DebugStreamEvent {
  readonly workflowId: string;
  readonly eventType: "breakpoint_hit" | "frame_update" | "comparison_ready";
  readonly payload: Record<string, unknown>;
  readonly emittedAt: string;
}

export interface DebugStreamSubscription {
  readonly workflowId: string;
  readonly streamPath: string;
  readonly protocol: "websocket";
  readonly subscriberId: string;
  readonly openedAt: string;
}

export class WorkflowDebugStreamService {
  private readonly subscriptions = new Map<string, DebugStreamSubscription[]>();
  private readonly events = new Map<string, DebugStreamEvent[]>();

  public buildStreamPath(workflowId: string): string {
    return `/ws/v1/debug/${workflowId}`;
  }

  public openSubscription(workflowId: string, subscriberId: string, openedAt = nowIso()): DebugStreamSubscription {
    const subscription: DebugStreamSubscription = {
      workflowId,
      streamPath: this.buildStreamPath(workflowId),
      protocol: "websocket",
      subscriberId,
      openedAt,
    };
    this.subscriptions.set(workflowId, [...(this.subscriptions.get(workflowId) ?? []), subscription]);
    return subscription;
  }

  public publish(event: DebugStreamEvent): void {
    this.events.set(event.workflowId, [...(this.events.get(event.workflowId) ?? []), event]);
  }

  public listSubscriptions(workflowId: string): readonly DebugStreamSubscription[] {
    return [...(this.subscriptions.get(workflowId) ?? [])];
  }

  public getBufferedEvents(workflowId: string): readonly DebugStreamEvent[] {
    return [...(this.events.get(workflowId) ?? [])];
  }
}
