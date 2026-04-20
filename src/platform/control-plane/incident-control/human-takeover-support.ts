import type { TaskSnapshot } from "../../contracts/types/domain.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";

import { WorkflowStateError, StorageError, ValidationError } from "../../contracts/errors.js";
import { getWorkflowDefinition } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function workflowTerminalForTask(status: TaskTerminalStatus): "completed" | "failed" | "cancelled" {
  return status === "done" ? "completed" : status;
}

export function sessionTerminalForTask(status: TaskTerminalStatus): "completed" | "failed" | "cancelled" {
  return status === "done" ? "completed" : status;
}

export function executionTerminalForTask(status: TaskTerminalStatus): "succeeded" | "failed" | "cancelled" {
  return status === "done" ? "succeeded" : status;
}

export function normalizeInputJson(inputJson: string): string {
  try {
    const parsed = JSON.parse(inputJson) as Record<string, unknown>;
    return JSON.stringify(parsed);
  } catch (err) {
    logger.warn("normalizeInputJson failed", { error: err });
    return inputJson.trim();
  }
}

export function throwTakeoverStorageError(code: string, details: Record<string, unknown> = {}): never {
  throw new StorageError(code, code, { statusCode: 404, retryable: false, details });
}

export function throwTakeoverWorkflowError(code: string, details: Record<string, unknown> = {}): never {
  throw new WorkflowStateError(code, code, { retryable: false, details });
}

export function parseOutputs(outputsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(outputsJson) as Record<string, unknown>;
  } catch (err) {
    logger.warn("parseOutputs failed", { error: err });
    return {};
  }
}

export function normalizeJson(rawJson: string, errorCode: string): string {
  try {
    return JSON.stringify(JSON.parse(rawJson) as unknown);
  } catch (err) {
    logger.warn("normalizeJson failed", { error: err });
    throw new ValidationError(errorCode, errorCode, {
      retryable: false,
      details: { rawJson },
    });
  }
}

export function resolveManualStepOutputSummary(stepId: string, output: unknown): string {
  if (output != null && typeof output === "object" && !Array.isArray(output)) {
    const summary = (output as Record<string, unknown>).summary;
    if (typeof summary === "string" && summary.length > 0) return summary;
  }
  return `Operator supplied output for ${stepId}`;
}

export function resolveWorkflowStepTarget(
  workflowId: string,
  currentStepIndex: number,
  input: { stepId?: string; stepIndex?: number },
): { step: NonNullable<ReturnType<typeof getWorkflowDefinition>>["steps"][number]; stepIndex: number } {
  const definition = getWorkflowDefinition(workflowId);
  if (!definition) {
    throwTakeoverWorkflowError("takeover.workflow_definition_missing", { workflowId });
  }
  const hasStepId = input.stepId != null && input.stepId.length > 0;
  const hasStepIndex = input.stepIndex != null;
  let stepIndex = hasStepIndex ? input.stepIndex ?? currentStepIndex : currentStepIndex;
  if (hasStepId) {
    const resolvedStepIndex = definition.steps.findIndex((step) => step.stepId === input.stepId);
    if (resolvedStepIndex < 0) {
      throwTakeoverWorkflowError("takeover.step_not_found", { workflowId, stepId: input.stepId });
    }
    if (hasStepIndex && resolvedStepIndex !== input.stepIndex) {
      throw new ValidationError("takeover.step_target_mismatch", "takeover.step_target_mismatch", {
        retryable: false,
        details: { workflowId, stepId: input.stepId, requestedStepIndex: input.stepIndex, resolvedStepIndex },
      });
    }
    stepIndex = resolvedStepIndex;
  }
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= definition.steps.length) {
    throw new ValidationError("takeover.step_index_invalid", "takeover.step_index_invalid", {
      retryable: false,
      details: { workflowId, stepIndex, stepCount: definition.steps.length },
    });
  }
  const step = definition.steps[stepIndex];
  if (!step) throwTakeoverWorkflowError("takeover.step_missing", { workflowId, stepIndex });
  return { step, stepIndex };
}

export function serializeSnapshot(snapshot: TaskSnapshot): Record<string, unknown> {
  return {
    task: snapshot.task,
    workflow: snapshot.workflow,
    execution: snapshot.execution,
    session: snapshot.session,
    stepOutputs: snapshot.stepOutputs.map((step) => ({ stepId: step.stepId, status: step.status })),
    recentEventTypes: snapshot.events.map((event) => event.eventType),
  };
}
