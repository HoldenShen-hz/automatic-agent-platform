import { nowIso } from "../../platform/contracts/types/ids.js";

export interface DebugStreamMessage {
  readonly type: "breakpoint_hit" | "frame_update" | "comparison_ready";
  readonly eventType?: "breakpoint_hit" | "frame_update" | "comparison_ready";
  readonly planGraphId: string;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}

export interface DebugStreamEvent {
  readonly workflowId: string;
  readonly eventType: DebugStreamMessage["type"];
  readonly payload: Record<string, unknown>;
  readonly emittedAt: string;
}

export interface DebugStreamSubscription {
  readonly workflowId: string;
  readonly actorId: string;
  readonly subscribedAt: string;
  readonly streamPath: string;
  readonly protocol: "websocket";
  readonly subscriberId: string;
  readonly openedAt: string;
}

type DebugListener = (message: DebugStreamMessage) => void;

export class WebSocketDebugStreamService {
  private readonly subscriptions = new Map<string, DebugStreamSubscription[]>();
  private readonly events = new Map<string, DebugStreamMessage[]>();
  private readonly listeners = new Map<string, DebugListener[]>();

  public buildStreamPath(workflowId: string): string {
    return `/ws/v1/debug/${workflowId}`;
  }

  public subscribe(workflowId: string, actorId: string, subscribedAt = nowIso()): DebugStreamSubscription {
    const subscription: DebugStreamSubscription = {
      workflowId,
      actorId,
      subscribedAt,
      streamPath: this.buildStreamPath(workflowId),
      protocol: "websocket",
      subscriberId: actorId,
      openedAt: subscribedAt,
    };
    this.subscriptions.set(workflowId, [...(this.subscriptions.get(workflowId) ?? []), subscription]);
    return subscription;
  }

  public openSubscription(workflowId: string, subscriberId: string, openedAt = nowIso()): DebugStreamSubscription {
    return this.subscribe(workflowId, subscriberId, openedAt);
  }

  public unsubscribe(workflowId: string, actorId: string): boolean {
    const existing = this.subscriptions.get(workflowId) ?? [];
    const next = existing.filter((subscription) => subscription.actorId !== actorId);
    if (next.length === existing.length) {
      return false;
    }
    if (next.length === 0) {
      this.subscriptions.delete(workflowId);
    } else {
      this.subscriptions.set(workflowId, next);
    }
    return true;
  }

  public addListener(workflowId: string, listener: DebugListener): void {
    this.listeners.set(workflowId, [...(this.listeners.get(workflowId) ?? []), listener]);
  }

  public broadcast(workflowId: string, message: DebugStreamMessage): void {
    this.events.set(workflowId, [...(this.events.get(workflowId) ?? []), message]);
    for (const listener of this.listeners.get(workflowId) ?? []) {
      listener(message);
    }
  }

  public notifyBreakpointHit(
    workflowId: string,
    planGraphId: string,
    payload: Record<string, unknown> & { readonly timestamp: string },
  ): void {
    this.broadcast(workflowId, {
      type: "breakpoint_hit",
      eventType: "breakpoint_hit",
      planGraphId,
      timestamp: payload.timestamp,
      payload,
    });
  }

  public publish(event: DebugStreamEvent): void {
    this.broadcast(event.workflowId, {
      type: event.eventType,
      eventType: event.eventType,
      planGraphId: event.workflowId,
      timestamp: event.emittedAt,
      payload: event.payload,
    });
  }

  public getSubscriptions(workflowId: string): readonly DebugStreamSubscription[] {
    return [...(this.subscriptions.get(workflowId) ?? [])];
  }

  public listSubscriptions(workflowId: string): readonly DebugStreamSubscription[] {
    return this.getSubscriptions(workflowId);
  }

  public getBufferedEvents(workflowId: string): readonly DebugStreamMessage[] {
    return [...(this.events.get(workflowId) ?? [])];
  }
}

export class WorkflowDebugStreamService extends WebSocketDebugStreamService {}
