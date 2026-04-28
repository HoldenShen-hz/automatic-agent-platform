import { compareWorkflowRuns, type RunSnapshot } from "./run-comparator/index.js";
import { isBreakpointHit } from "./breakpoint-manager/index.js";
import { renderWorkflowTimeline } from "./timeline-renderer/index.js";

export interface DebugBreakpointDefinition {
  readonly breakpointId: string;
  readonly workflowId: string;
  readonly stepSelector: string;
  readonly condition: string;
  readonly action: "pause" | "snapshot" | "compare";
}

export interface WorkflowTraceFrame {
  readonly workflowId: string;
  readonly stepId: string;
  readonly status: string;
  readonly timestamp: string;
  readonly label: string;
}

export interface BreakpointHit {
  readonly breakpointId: string;
  readonly workflowId: string;
  readonly stepId: string;
  readonly action: DebugBreakpointDefinition["action"];
  readonly timestamp: string;
}

export interface RunComparisonReport {
  readonly workflowId: string;
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
    this.breakpoints.set(
      breakpoint.workflowId,
      [...(this.breakpoints.get(breakpoint.workflowId) ?? []), breakpoint],
    );
    return breakpoint;
  }

  public listBreakpoints(workflowId: string): DebugBreakpointDefinition[] {
    return [...(this.breakpoints.get(workflowId) ?? [])];
  }

  public evaluateTrace(frames: readonly WorkflowTraceFrame[]): BreakpointHit[] {
    if (frames.length === 0) {
      return [];
    }
    const workflowId = frames[0]!.workflowId;
    const breakpoints = (this.breakpoints.get(workflowId) ?? []).map((item) => ({
      breakpointId: item.breakpointId,
      stepId: item.stepSelector,
    }));
    return frames
      .filter((frame) => isBreakpointHit(breakpoints, frame.stepId))
      .map((frame) => {
        const matched = (this.breakpoints.get(frame.workflowId) ?? []).find((item) => item.stepSelector === frame.stepId)!;
        return {
          breakpointId: matched.breakpointId,
          workflowId: frame.workflowId,
          stepId: frame.stepId,
          action: matched.action,
          timestamp: frame.timestamp,
        };
      });
  }

  public buildComparisonReport(
    workflowId: string,
    leftFrames: readonly WorkflowTraceFrame[],
    rightFrames: readonly WorkflowTraceFrame[],
  ): RunComparisonReport {
    const leftSnapshots: RunSnapshot[] = leftFrames.map((frame) => ({ stepId: frame.stepId, status: frame.status }));
    const rightSnapshots: RunSnapshot[] = rightFrames.map((frame) => ({ stepId: frame.stepId, status: frame.status }));

    return {
      workflowId,
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
