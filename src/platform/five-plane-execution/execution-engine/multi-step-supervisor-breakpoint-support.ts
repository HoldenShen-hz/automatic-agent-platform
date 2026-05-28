import { newId, nowIso } from "../../contracts/types/ids.js";
import type { StepOutputRecord } from "../../contracts/types/domain.js";
import { createChildTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import type { ExecutionDeps, StepSupervisorContext } from "./multi-step-supervisor-types.js";

export function pauseForBreakpoint(params: {
  ctx: Pick<StepSupervisorContext, "planGraphId" | "plannedWorkflow" | "workflowDebugger" | "taskId" | "traceId" | "traceContext">;
  deps: Pick<ExecutionDeps, "db" | "store">;
  stepId: string;
}): boolean {
  const { ctx, deps, stepId } = params;
  const breakpointScope = ctx.planGraphId ?? ctx.plannedWorkflow.workflow.workflowId;
  const matchedPauseBreakpoint = (ctx.workflowDebugger?.getActiveBreakpoints(breakpointScope) ?? []).find((breakpoint) => {
    if (breakpoint.action !== "pause") {
      return false;
    }
    const selector = breakpoint.nodeRunSelector ?? breakpoint.stepSelector;
    return selector === stepId;
  });
  if (matchedPauseBreakpoint == null) {
    return false;
  }

  deps.db.transaction(() => {
    deps.store.event.insertEvent({
      id: newId("evt"),
      taskId: ctx.taskId,
      executionId: null,
      eventType: "workflow:paused_for_breakpoint",
      eventTier: "tier_1",
      payloadJson: JSON.stringify(injectTraceContext({
        breakpointId: matchedPauseBreakpoint.breakpointId,
        planGraphId: breakpointScope,
        workflowId: ctx.plannedWorkflow.workflow.workflowId,
        stepId,
        reasonCode: "workflow_debugger.pause_breakpoint_hit",
      }, createChildTraceContext(ctx.traceContext))),
      traceId: ctx.traceId,
      createdAt: nowIso(),
    });
  });
  return true;
}

export function skipStepForHardBlockers(params: {
  ctx: Pick<StepSupervisorContext, "taskId" | "traceId" | "traceContext" | "workflowRetryCount">;
  deps: Pick<ExecutionDeps, "db" | "store">;
  step: StepSupervisorContext["plannedWorkflow"]["executionSteps"][number];
  stepOutputs: StepOutputRecord[];
  outputs: Record<string, unknown>;
  index: number;
  skippedStepIds: Set<string>;
  failedStepIds: Set<string>;
}): boolean {
  const { ctx, deps, step, stepOutputs, outputs, index, skippedStepIds, failedStepIds } = params;
  const hardBlockers = (step.dependsOnStepIds ?? []).filter((depId) => {
    const depType = step.dependencyTypes[depId] ?? "hard";
    return depType === "hard" && (failedStepIds.has(depId) || skippedStepIds.has(depId));
  });
  if (hardBlockers.length === 0) {
    return false;
  }

  skippedStepIds.add(step.stepId);
  const skipNow = nowIso();
  const skipOutput: StepOutputRecord = {
    id: newId("step"),
    nodeRunId: newId("step"),
    taskId: ctx.taskId,
    stepId: step.stepId,
    roleId: step.roleId,
    status: "skipped",
    dataJson: JSON.stringify({ reasonCode: "upstream_dependency_failed", blockedBy: hardBlockers }),
    summary: `Step ${step.stepId} skipped: upstream dependency failed (${hardBlockers.join(", ")})`,
    artifactsJson: null,
    tokenCost: 0,
    durationMs: 0,
    validationJson: null,
    producedAt: skipNow,
  };
  stepOutputs.push(skipOutput);
  deps.db.transaction(() => {
    deps.store.workflow.insertStepOutput(skipOutput);
    deps.store.event.insertEvent({
      id: newId("evt"),
      taskId: ctx.taskId,
      executionId: null,
      eventType: "workflow:step_skipped",
      eventTier: "tier_1",
      payloadJson: JSON.stringify(injectTraceContext({
        stepId: step.stepId,
        roleId: step.roleId,
        status: "skipped",
        reasonCode: "upstream_dependency_failed",
        blockedBy: hardBlockers,
      }, createChildTraceContext(ctx.traceContext))),
      traceId: ctx.traceId,
      createdAt: skipNow,
    });
    deps.store.workflow.updateWorkflowRecoveryState({
      taskId: ctx.taskId,
      status: "running",
      currentStepIndex: index + 1,
      outputsJson: JSON.stringify(outputs),
      updatedAt: skipNow,
      resumableFromStep: null,
      retryCount: ctx.workflowRetryCount,
      lastErrorCode: null,
    });
  });
  return true;
}
