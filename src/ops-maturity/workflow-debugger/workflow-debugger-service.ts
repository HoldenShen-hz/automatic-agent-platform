import { compareWorkflowRuns, type RunSnapshot } from "./run-comparator/index.js";
import { isBreakpointHit } from "./breakpoint-manager/index.js";
import { renderWorkflowTimeline } from "./timeline-renderer/index.js";

export interface DebugBreakpointDefinition {
  readonly breakpointId: string;
  readonly planGraphId: string;
  readonly nodeRunSelector: string;
  readonly condition: string;
  readonly action: "pause" | "snapshot" | "compare";
  /** @deprecated use nodeRunSelector */
  readonly stepSelector?: string;
  /** @deprecated use planGraphId */
  readonly workflowId?: string;
}

export interface WorkflowTraceFrame {
  readonly planGraphId: string;
  readonly nodeRunId: string;
  readonly status: string;
  readonly timestamp: string;
  readonly label: string;
  /** @deprecated use nodeRunId */
  readonly stepId?: string;
  /** @deprecated use planGraphId */
  readonly workflowId?: string;
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
  readonly leftFrames: readonly WorkflowTraceFrame[];
  readonly rightFrames: readonly WorkflowTraceFrame[];
}

export interface DebuggerActor {
  readonly actorId: string;
  readonly allowedRuntime: "replay_sandbox" | "non_prod";
}

export class WorkflowDebuggerService {
  private readonly breakpoints = new Map<string, DebugBreakpointDefinition[]>();

  public registerBreakpoint(
    actor: DebuggerActor,
    environment: "prod" | "staging" | "dev",
    breakpoint: DebugBreakpointDefinition,
  ): DebugBreakpointDefinition {
    if (environment === "prod" && actor.allowedRuntime !== "replay_sandbox") {
      throw new Error(`workflow_debugger.prod_breakpoint_forbidden:${actor.actorId}`);
    }
    const key = breakpoint.planGraphId;
    this.breakpoints.set(
      key,
      [...(this.breakpoints.get(key) ?? []), breakpoint],
    );
    return breakpoint;
  }

  public listBreakpoints(planGraphId: string): DebugBreakpointDefinition[] {
    return [...(this.breakpoints.get(planGraphId) ?? [])];
  }

  public evaluateTrace(frames: readonly WorkflowTraceFrame[]): BreakpointHit[] {
    if (frames.length === 0) {
      return [];
    }
    const planGraphId = frames[0]!.planGraphId;
    const breakpoints = (this.breakpoints.get(planGraphId) ?? []).map((item) => ({
      breakpointId: item.breakpointId,
      nodeRunId: item.nodeRunSelector,
    }));
    return frames
      .filter((frame) => isBreakpointHit(breakpoints, frame.nodeRunId))
      .map((frame) => {
        const matched = (this.breakpoints.get(frame.planGraphId) ?? []).find((item) => item.nodeRunSelector === frame.nodeRunId)!;
        return {
          breakpointId: matched.breakpointId,
          planGraphId: frame.planGraphId,
          nodeRunId: frame.nodeRunId,
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
    const leftSnapshots: RunSnapshot[] = leftFrames.map((frame) => ({ stepId: frame.nodeRunId, status: frame.status }));
    const rightSnapshots: RunSnapshot[] = rightFrames.map((frame) => ({ stepId: frame.nodeRunId, status: frame.status }));

    return {
      planGraphId,
      differences: compareWorkflowRuns(leftSnapshots, rightSnapshots),
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
}
