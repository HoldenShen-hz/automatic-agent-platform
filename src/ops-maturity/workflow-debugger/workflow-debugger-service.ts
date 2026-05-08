import { compareWorkflowRuns, type RunSnapshot } from "./run-comparator/index.js";
import { isBreakpointHit } from "./breakpoint-manager/index.js";
import { renderWorkflowTimeline } from "./timeline-renderer/index.js";

export interface DebugBreakpointDefinition {
  readonly breakpointId: string;
  readonly workflowId?: string;
  readonly planGraphId?: string;
  readonly stepSelector?: string;
  readonly nodeRunSelector?: string;
  readonly condition: string;
  readonly replayCondition?: string | {
    readonly eventType?: string;
    readonly expression?: string;
    readonly maxReplays?: number;
  };
  readonly action: "pause" | "snapshot" | "compare";
}

export interface WorkflowTraceFrame {
  readonly workflowId?: string;
  readonly planGraphId?: string;
  readonly stepId?: string;
  readonly nodeRunId?: string;
  readonly status: string;
  readonly timestamp: string;
  readonly label: string;
  readonly decision?: string;
  readonly costUsd?: number;
  readonly durationMs?: number;
  readonly outcome?: string;
  readonly expectedSideEffects?: readonly string[];
  readonly actualSideEffects?: readonly string[];
}

export interface BreakpointHit {
  readonly breakpointId: string;
  readonly workflowId: string;
  readonly planGraphId: string;
  readonly stepId: string;
  readonly nodeRunId: string;
  readonly action: DebugBreakpointDefinition["action"];
  readonly timestamp: string;
}

export interface RunComparisonReport {
  readonly workflowId: string;
  readonly planGraphId?: string;
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

  public registerBreakpoint(
    actor: DebuggerActor,
    environment: "prod" | "staging" | "dev",
    breakpoint: DebugBreakpointDefinition,
  ): DebugBreakpointDefinition {
    if (environment === "prod" && actor.allowedRuntime !== "replay_sandbox") {
      throw new Error(`workflow_debugger.prod_breakpoint_forbidden:${actor.actorId}`);
    }
    const normalized = this.normalizeBreakpoint(breakpoint);
    this.breakpoints.set(
      normalized.planGraphId,
      [...(this.breakpoints.get(normalized.planGraphId) ?? []), normalized],
    );
    return normalized;
  }

  public listBreakpoints(workflowId: string): DebugBreakpointDefinition[] {
    return [...(this.breakpoints.get(workflowId) ?? [])];
  }

  public evaluateTrace(frames: readonly WorkflowTraceFrame[]): BreakpointHit[] {
    if (frames.length === 0) {
      return [];
    }
    const workflowId = this.getFramePlanGraphId(frames[0]!);
    const breakpoints = (this.breakpoints.get(workflowId) ?? []).map((item) => ({
      breakpointId: item.breakpointId,
      stepId: item.nodeRunSelector!,
    }));
    return frames
      .filter((frame) => isBreakpointHit(breakpoints, this.getFrameNodeRunId(frame)))
      .map((frame) => {
        const planGraphId = this.getFramePlanGraphId(frame);
        const nodeRunId = this.getFrameNodeRunId(frame);
        const matched = (this.breakpoints.get(planGraphId) ?? []).find((item) => item.nodeRunSelector === nodeRunId)!;
        return {
          breakpointId: matched.breakpointId,
          workflowId: planGraphId,
          planGraphId,
          stepId: nodeRunId,
          nodeRunId,
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
    const leftSnapshots: RunSnapshot[] = leftFrames.map((frame) => this.buildRunSnapshot(frame));
    const rightSnapshots: RunSnapshot[] = rightFrames.map((frame) => this.buildRunSnapshot(frame));
    const differences = [
      ...compareWorkflowRuns(leftSnapshots, rightSnapshots),
      ...this.compareTraceFields(leftFrames, rightFrames),
    ];

    return {
      workflowId,
      planGraphId: workflowId,
      differences,
      regressionDetected: differences.length > 0,
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

  private compareTraceFields(
    leftFrames: readonly WorkflowTraceFrame[],
    rightFrames: readonly WorkflowTraceFrame[],
  ): string[] {
    const rightByStep = new Map(rightFrames.map((frame) => [this.getFrameNodeRunId(frame), frame] as const));
    const differences: string[] = [];

    for (const leftFrame of leftFrames) {
      const leftStepId = this.getFrameNodeRunId(leftFrame);
      const rightFrame = rightByStep.get(leftStepId) ?? rightByStep.get(leftFrame.nodeRunId ?? "");
      if (!rightFrame) {
        continue;
      }
      this.appendFieldDifference(differences, "decision", leftStepId, leftFrame.decision, rightFrame.decision);
      this.appendFieldDifference(differences, "cost", leftStepId, leftFrame.costUsd, rightFrame.costUsd);
      this.appendFieldDifference(differences, "duration", leftStepId, leftFrame.durationMs, rightFrame.durationMs);
      this.appendFieldDifference(differences, "outcome", leftStepId, leftFrame.outcome, rightFrame.outcome);
      this.appendFieldDifference(
        differences,
        "side_effects",
        leftStepId,
        leftFrame.actualSideEffects?.join(","),
        rightFrame.actualSideEffects?.join(","),
      );
      this.appendFieldDifference(
        differences,
        "side_effect_expectation_mismatch",
        leftStepId,
        leftFrame.expectedSideEffects?.join(","),
        leftFrame.actualSideEffects?.join(","),
      );
      this.appendFieldDifference(
        differences,
        "side_effect_expectation_mismatch",
        leftStepId,
        rightFrame.expectedSideEffects?.join(","),
        rightFrame.actualSideEffects?.join(","),
      );
    }

    return differences;
  }

  private appendFieldDifference(
    differences: string[],
    field: string,
    stepId: string,
    leftValue: string | number | undefined,
    rightValue: string | number | undefined,
  ): void {
    if (leftValue === rightValue) {
      return;
    }
    if (leftValue == null && rightValue == null) {
      return;
    }
    differences.push(`${field}:${stepId}:${String(leftValue ?? "missing")}->${String(rightValue ?? "missing")}`);
  }

  private normalizeBreakpoint(breakpoint: DebugBreakpointDefinition): DebugBreakpointDefinition & {
    readonly workflowId: string;
    readonly planGraphId: string;
    readonly stepSelector: string;
    readonly nodeRunSelector: string;
  } {
    const planGraphId = breakpoint.planGraphId ?? breakpoint.workflowId;
    const nodeRunSelector = breakpoint.nodeRunSelector ?? breakpoint.stepSelector;
    if (!planGraphId || !nodeRunSelector) {
      throw new Error("workflow_debugger.breakpoint_target_required");
    }
    return {
      ...breakpoint,
      workflowId: planGraphId,
      planGraphId,
      stepSelector: nodeRunSelector,
      nodeRunSelector,
    };
  }

  private getFramePlanGraphId(frame: WorkflowTraceFrame): string {
    return frame.planGraphId ?? frame.workflowId ?? "unknown";
  }

  private getFrameNodeRunId(frame: WorkflowTraceFrame): string {
    return frame.nodeRunId ?? frame.stepId ?? "";
  }

  private buildRunSnapshot(frame: WorkflowTraceFrame): RunSnapshot {
    const stepId = this.getFrameNodeRunId(frame);
    if (frame.nodeRunId) {
      return {
        stepId,
        nodeRunId: frame.nodeRunId,
        status: frame.status,
      };
    }
    return {
      stepId,
      status: frame.status,
    };
  }
}
