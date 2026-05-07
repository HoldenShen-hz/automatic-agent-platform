import { compareWorkflowRuns, type RunSnapshot } from "./run-comparator/index.js";
import { isBreakpointHit } from "./breakpoint-manager/index.js";
import { renderWorkflowTimeline } from "./timeline-renderer/index.js";

export interface DebugBreakpointDefinition {
  readonly breakpointId: string;
  readonly planGraphId: string;
  readonly nodeRunSelector: string;
  readonly condition: string;
  readonly action: "pause" | "snapshot" | "compare";
  // §65.3: Replay condition for conditional breakpoint evaluation
  readonly replayCondition?: string;
  /** @deprecated use nodeRunSelector */
  readonly stepSelector?: string;
  /** @deprecated use planGraphId */
  readonly workflowId?: string;
}

export interface WorkflowTraceFrame {
  readonly planGraphId: string;
  readonly nodeRunId: string;
  readonly status: string;
  readonly decision?: string;
  readonly cost?: number;
  readonly durationMs?: number;
  readonly outcome?: string;
  readonly timestamp: string;
  readonly label: string;
  /** @deprecated use nodeRunId */
  readonly stepId?: string;
  /** @deprecated use planGraphId */
  readonly workflowId?: string;
}

/** §65.2: WebSocket debug stream message types */
export type DebugStreamMessageType =
  | "breakpoint_hit"
  | "step_status"
  | "step_complete"
  | "regression_detected"
  | "snapshot"
  | "error";

export interface DebugStreamMessage {
  readonly type: DebugStreamMessageType;
  readonly planGraphId: string;
  readonly workflowId: string;
  readonly timestamp: string;
  readonly payload: unknown;
}

export interface DebugStreamSubscription {
  readonly workflowId: string;
  readonly actorId: string;
  readonly subscribedAt: string;
}

/**
 * WebSocket debug stream service for real-time debugging.
 * §65.2: Provides /ws/v1/debug/{workflow_id} endpoint for real-time debug streaming.
 */
export class WebSocketDebugStreamService {
  private readonly subscriptions = new Map<string, Map<string, DebugStreamSubscription>>();
  private readonly listeners = new Map<string, Set<(msg: DebugStreamMessage) => void>>();

  /**
   * Subscribes an actor to debug stream for a workflow.
   * §65.2: Creates WS subscription at /ws/v1/debug/{workflow_id}
   */
  public subscribe(workflowId: string, actorId: string): DebugStreamSubscription {
    const subscription: DebugStreamSubscription = {
      workflowId,
      actorId,
      subscribedAt: new Date().toISOString(),
    };

    if (!this.subscriptions.has(workflowId)) {
      this.subscriptions.set(workflowId, new Map());
    }
    this.subscriptions.get(workflowId)!.set(actorId, subscription);

    return subscription;
  }

  /**
   * Unsubscribes an actor from debug stream.
   */
  public unsubscribe(workflowId: string, actorId: string): boolean {
    const workflowSubs = this.subscriptions.get(workflowId);
    if (workflowSubs) {
      return workflowSubs.delete(actorId);
    }
    return false;
  }

  /**
   * Registers a listener for debug stream messages.
   */
  public addListener(workflowId: string, listener: (msg: DebugStreamMessage) => void): void {
    if (!this.listeners.has(workflowId)) {
      this.listeners.set(workflowId, new Set());
    }
    this.listeners.get(workflowId)!.add(listener);
  }

  /**
   * Removes a listener for debug stream messages.
   */
  public removeListener(workflowId: string, listener: (msg: DebugStreamMessage) => void): boolean {
    const workflowListeners = this.listeners.get(workflowId);
    if (workflowListeners) {
      return workflowListeners.delete(listener);
    }
    return false;
  }

  /**
   * Broadcasts a debug message to all subscribers of a workflow.
   * §65.2: Real-time debug stream via WebSocket
   */
  public broadcast(workflowId: string, message: Omit<DebugStreamMessage, "workflowId">): void {
    const workflowListeners = this.listeners.get(workflowId);
    if (!workflowListeners) return;

    const fullMessage: DebugStreamMessage = {
      ...message,
      workflowId,
    };

    for (const listener of workflowListeners) {
      try {
        listener(fullMessage);
      } catch {
        // Listener may have been removed during iteration
      }
    }
  }

  /**
   * Notifies breakpoint hit to subscribers.
   */
  public notifyBreakpointHit(planGraphId: string, workflowId: string, hit: BreakpointHit): void {
    this.broadcast(workflowId, {
      type: "breakpoint_hit",
      planGraphId,
      timestamp: new Date().toISOString(),
      payload: hit,
    });
  }

  /**
   * Notifies step status change to subscribers.
   */
  public notifyStepStatus(planGraphId: string, workflowId: string, nodeRunId: string, status: string): void {
    this.broadcast(workflowId, {
      type: "step_status",
      planGraphId,
      timestamp: new Date().toISOString(),
      payload: { nodeRunId, status },
    });
  }

  /**
   * Notifies regression detected to subscribers.
   * §65.4: Regression detection notification
   */
  public notifyRegressionDetected(planGraphId: string, workflowId: string, report: RunComparisonReport): void {
    this.broadcast(workflowId, {
      type: "regression_detected",
      planGraphId,
      timestamp: new Date().toISOString(),
      payload: report,
    });
  }

  public getSubscriptions(workflowId: string): DebugStreamSubscription[] {
    return [...(this.subscriptions.get(workflowId)?.values() ?? [])];
  }
}

export interface BreakpointHit {
  readonly breakpointId: string;
  readonly planGraphId: string;
  readonly nodeRunId: string;
  readonly action: DebugBreakpointDefinition["action"];
  readonly timestamp: string;
  /** @deprecated use planGraphId */
  readonly workflowId?: string;
  /** @deprecated use nodeRunId */
  readonly stepId?: string;
}

export interface RunComparisonReport {
  readonly planGraphId: string;
  readonly differences: readonly string[];
  readonly regressionDetected: boolean;
  readonly leftFrames: readonly WorkflowTraceFrame[];
  readonly rightFrames: readonly WorkflowTraceFrame[];
}

export interface DebuggerActor {
  readonly actorId: string;
  readonly allowedRuntime: "replay_sandbox" | "non_prod";
}

export class WorkflowDebuggerService {
  private readonly breakpoints = new Map<string, DebugBreakpointDefinition[]>();
  private readonly compatibilitySessions = new Map<string, { readonly sessionId: string; readonly taskId: string }>();
  private readonly compatibilityBreakpoints = new Map<string, Array<{
    readonly breakpointId: string;
    readonly taskId: string;
    readonly stepIndex: number;
    readonly enabled: boolean;
    readonly createdAt: string;
  }>>();

  private resolvePlanGraphId(input: Pick<DebugBreakpointDefinition, "planGraphId" | "workflowId"> | Pick<WorkflowTraceFrame, "planGraphId" | "workflowId">): string {
    return input.planGraphId ?? input.workflowId ?? "";
  }

  private resolveNodeRunIdFromBreakpoint(input: Pick<DebugBreakpointDefinition, "nodeRunSelector" | "stepSelector">): string {
    return input.nodeRunSelector ?? input.stepSelector ?? "";
  }

  private resolveNodeRunIdFromFrame(input: Pick<WorkflowTraceFrame, "nodeRunId" | "stepId">): string {
    return input.nodeRunId ?? input.stepId ?? "";
  }

  private resolveNodeRunId(input: Pick<DebugBreakpointDefinition, "nodeRunSelector" | "stepSelector"> | Pick<WorkflowTraceFrame, "nodeRunId" | "stepId">): string {
    if ("nodeRunSelector" in input || "stepSelector" in input) {
      return this.resolveNodeRunIdFromBreakpoint(input as Pick<DebugBreakpointDefinition, "nodeRunSelector" | "stepSelector">);
    }
    return this.resolveNodeRunIdFromFrame(input as Pick<WorkflowTraceFrame, "nodeRunId" | "stepId">);
  }

  public registerBreakpoint(
    actor: DebuggerActor,
    environment: "prod" | "staging" | "dev",
    breakpoint: DebugBreakpointDefinition,
  ): DebugBreakpointDefinition {
    if (environment === "prod" && actor.allowedRuntime !== "replay_sandbox") {
      throw new Error(`workflow_debugger.prod_breakpoint_forbidden:${actor.actorId}`);
    }
    const normalizedBreakpoint: DebugBreakpointDefinition = {
      ...breakpoint,
      planGraphId: this.resolvePlanGraphId(breakpoint),
      nodeRunSelector: this.resolveNodeRunId(breakpoint),
    };
    const key = normalizedBreakpoint.planGraphId;
    this.breakpoints.set(
      key,
      [...(this.breakpoints.get(key) ?? []), normalizedBreakpoint],
    );
    return normalizedBreakpoint;
  }

  public listBreakpoints(planGraphId: string): DebugBreakpointDefinition[] {
    return [...(this.breakpoints.get(planGraphId) ?? [])];
  }

  public evaluateTrace(frames: readonly WorkflowTraceFrame[]): BreakpointHit[] {
    if (frames.length === 0) {
      return [];
    }
    const planGraphId = this.resolvePlanGraphId(frames[0]!);
    const breakpoints = (this.breakpoints.get(planGraphId) ?? []).map((item) => ({
      breakpointId: item.breakpointId,
      nodeRunId: this.resolveNodeRunId(item),
    }));
    return frames
      .filter((frame) => isBreakpointHit(breakpoints, this.resolveNodeRunId(frame)))
      .map((frame) => {
        const framePlanGraphId = this.resolvePlanGraphId(frame);
        const frameNodeRunId = this.resolveNodeRunId(frame);
        const matched = (this.breakpoints.get(framePlanGraphId) ?? []).find((item) => this.resolveNodeRunId(item) === frameNodeRunId)!;
        return {
          breakpointId: matched.breakpointId,
          planGraphId: framePlanGraphId,
          nodeRunId: frameNodeRunId,
          action: matched.action,
          timestamp: frame.timestamp,
        };
      });
  }

  public buildComparisonReport(
    planGraphId: string,
    leftFrames: readonly WorkflowTraceFrame[],
    rightFrames: readonly WorkflowTraceFrame[],
  ): RunComparisonReport {
    const leftSnapshots: RunSnapshot[] = leftFrames.map((frame) => {
      const nodeRunId = this.resolveNodeRunId(frame);
      return {
        nodeRunId,
        stepId: nodeRunId,
        status: frame.status,
        ...(frame.decision !== undefined ? { decision: frame.decision } : {}),
        ...(frame.cost !== undefined ? { cost: frame.cost } : {}),
        ...(frame.durationMs !== undefined ? { durationMs: frame.durationMs } : {}),
        ...(frame.outcome !== undefined ? { outcome: frame.outcome } : {}),
      };
    });
    const rightSnapshots: RunSnapshot[] = rightFrames.map((frame) => {
      const nodeRunId = this.resolveNodeRunId(frame);
      return {
        nodeRunId,
        stepId: nodeRunId,
        status: frame.status,
        ...(frame.decision !== undefined ? { decision: frame.decision } : {}),
        ...(frame.cost !== undefined ? { cost: frame.cost } : {}),
        ...(frame.durationMs !== undefined ? { durationMs: frame.durationMs } : {}),
        ...(frame.outcome !== undefined ? { outcome: frame.outcome } : {}),
      };
    });

    const differences = compareWorkflowRuns(leftSnapshots, rightSnapshots);
    // §65.4: Auto-detect regression when status/decision/cost/duration/outcome differ
    const regressionDetected = differences.length > 0 && differences.some(
      (diff) => diff.includes(":status:") || diff.includes(":decision:") || diff.includes(":cost:") || diff.includes(":duration:") || diff.includes(":outcome:"),
    );

    return {
      planGraphId,
      differences,
      regressionDetected,
      leftFrames: leftFrames.map((frame) => ({ ...frame })),
      rightFrames: rightFrames.map((frame) => ({ ...frame })),
    };
  }

  public renderTraceTimeline(frames: readonly WorkflowTraceFrame[]): string[] {
    return renderWorkflowTimeline(frames.map((frame) => ({
      timestamp: frame.timestamp,
      label: frame.label,
    })));
  }

  public startDebugSession(taskId: string): { readonly sessionId: string; readonly taskId: string } {
    const session = {
      sessionId: `debug_${taskId}`,
      taskId,
    };
    this.compatibilitySessions.set(taskId, session);
    return session;
  }

  public setBreakpoint(input: {
    readonly breakpointId: string;
    readonly taskId: string;
    readonly stepIndex: number;
    readonly enabled: boolean;
    readonly createdAt: string;
  }): void {
    const existing = this.compatibilityBreakpoints.get(input.taskId) ?? [];
    this.compatibilityBreakpoints.set(input.taskId, [...existing, input]);
  }

  public getBreakpoints(taskId: string): Array<{
    readonly breakpointId: string;
    readonly taskId: string;
    readonly stepIndex: number;
    readonly enabled: boolean;
    readonly createdAt: string;
  }> {
    return [...(this.compatibilityBreakpoints.get(taskId) ?? [])];
  }
}
