/**
 * @fileoverview Workflow Step Checkpoint - Snapshot and recovery for workflow steps.
 *
 * Provides checkpointing functionality for multi-step workflow execution. Each step
 * can produce a checkpoint that captures:
 * - Step output and status
 * - Decision context (how routing decisions were made)
 * - Resume context (where to resume if interrupted)
 * - File diff summary (what files were changed)
 * - Upstream artifact references
 * - Compensation model for undo
 *
 * Checkpoints enable:
 * - Recovery after crashes: Resume from the last successful step
 * - Audit trail: Track exactly what happened at each step
 * - Compensation: Undo steps using the compensation model
 *
 * @see Workflow Contract: docs_zh/contracts/task_and_workflow_contract.md
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import type { ArtifactRecord, ArtifactRef, StepOutputRecord } from "../../contracts/types/domain.js";
import type { CompensationModel } from "../../five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export const WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION = "workflow_step_checkpoint.v1";
export const NODE_RUN_CHECKPOINT_SCHEMA_VERSION = "node_run_checkpoint.v1";
const LEGACY_WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSIONS = new Set([
  "workflow_step_checkpoint.v0",
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
]);

/**
 * Context about how the step decision was made.
 *
 * Captures the source of the decision (e.g., model response), the original
 * request, why a particular route was chosen, prior step summaries for
 * context, and which step IDs this step depends on.
 */
export interface WorkflowStepCheckpointDecisionContext {
  source: string;
  request: string;
  routeReason: string | null;
  priorStepSummaries: string[];
  dependsOnStepIds: string[];
}

/**
 * Context for resuming workflow execution after interruption.
 *
 * Tracks which steps have completed, what the next step to execute is,
 * and which output keys are available for downstream steps.
 */
export interface WorkflowStepCheckpointResumeContext {
  completedStepIds: string[];
  nextStepId: string | null;
  outputKeys: string[];
}

/**
 * Summary of file system changes made by the step.
 *
 * Tracks which files were created, modified, or deleted so the system
 * can understand the side effects of each step for audit and compensation.
 */
export interface WorkflowStepCheckpointFileDiffSummary {
  summary: string | null;
  createdPaths: string[];
  updatedPaths: string[];
  deletedPaths: string[];
}

export type WorkflowStepCheckpointCompensationModel =
  | CompensationModel
  | {
      strategy: string;
      rollbackTaskId?: string | null;
      notes?: string | null;
      [key: string]: unknown;
    };

/**
 * Complete checkpoint data for a workflow step execution.
 *
 * A checkpoint captures the full state needed to resume execution later,
 * including output, decision reasoning, resume position, file changes,
 * and artifact dependencies.
 */
export interface WorkflowStepCheckpoint {
  schemaVersion: typeof WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION;
  taskId: string;
  executionId: string | null;
  workflowId: string;
  divisionId: string;
  harnessRunId: string;
  nodeRunId: string | null;
  planGraphId: string;
  stepId: string;
  roleId: string;
  outputKey: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  output: Record<string, unknown>;
  decisionContext: WorkflowStepCheckpointDecisionContext;
  resumeContext: WorkflowStepCheckpointResumeContext;
  fileDiffSummary: WorkflowStepCheckpointFileDiffSummary;
  upstreamArtifactRefs: ArtifactRef[];
  compensationModel: WorkflowStepCheckpointCompensationModel | null;
}

/**
 * Input for creating a workflow step checkpoint.
 *
 * Used by the workflow executor to capture step state at completion
 * or during critical points in execution.
 */
export interface CreateWorkflowStepCheckpointInput {
  taskId: string;
  executionId: string | null;
  workflowId: string;
  divisionId: string;
  harnessRunId?: string;
  nodeRunId?: string | null;
  planGraphId?: string;
  stepId: string;
  roleId: string;
  outputKey: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  output: Record<string, unknown>;
  decisionContext: WorkflowStepCheckpointDecisionContext;
  resumeContext: WorkflowStepCheckpointResumeContext;
  upstreamArtifactRefs?: ArtifactRef[];
  fileDiffSummary?: Partial<WorkflowStepCheckpointFileDiffSummary>;
  compensationModel?: WorkflowStepCheckpointCompensationModel | null;
}

/**
 * Summary view of a checkpoint for listing/display purposes.
 *
 * A condensed view that excludes full output and context to allow
 * listing checkpoints without loading all data.
 *
 * R8-10 FIX: nodeRunId is now the canonical identifier for checkpoints,
 * replacing the legacy stepId-based approach. This aligns with the
 * PlanGraphBundle/NodeRun/NodeAttempt canonical model.
 */
export interface WorkflowStepCheckpointSummary {
  artifactId: string;
  /** Canonical node run identifier (replaces stepId as primary key) */
  nodeRunId: string | null;
  planGraphId: string;
  stepId: string;
  workflowId: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  nextNodeRunId: string | null;
  nextStepId: string | null;
  outputKeys: string[];
  summary: string | null;
  source: string;
}

export interface WorkflowStepCheckpointRestoreState {
  harnessRunId: string;
  nodeRunId: string | null;
  planGraphId: string;
  workflowId: string;
  output: Record<string, unknown>;
  decisionContext: WorkflowStepCheckpointDecisionContext;
  resumeContext: WorkflowStepCheckpointResumeContext;
  fileDiffSummary: WorkflowStepCheckpointFileDiffSummary;
  compensationModel: WorkflowStepCheckpointCompensationModel | null;
}

export interface WorkflowStepCheckpointDiff {
  schemaVersionChanged: boolean;
  statusChanged: boolean;
  outputKeysAdded: string[];
  outputKeysRemoved: string[];
  nextStepChanged: boolean;
  compensationChanged: boolean;
}

export interface CreateNodeRunCheckpointInput {
  harnessRunId: string;
  nodeRunId: string;
  planGraphBundleId: string;
  graphVersion: number;
  planGraphId: string;
  nodeId: string;
  taskId: string;
  executionId: string | null;
  divisionId: string;
  roleId: string;
  outputKey: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  output: Record<string, unknown>;
  decisionContext: {
    source: string;
    request: string;
    routeReason: string | null;
    priorNodeSummaries: string[];
    dependsOnNodeIds: string[];
  };
  resumeContext: {
    completedNodeIds: string[];
    nextNodeId: string | null;
    outputKeys: string[];
  };
}

export interface NodeRunCheckpoint {
  schemaVersion: typeof NODE_RUN_CHECKPOINT_SCHEMA_VERSION;
  harnessRunId: string;
  nodeRunId: string;
  planGraphBundleId: string;
  graphVersion: number;
  planGraphId: string;
  nodeId: string;
  taskId: string;
  executionId: string | null;
  divisionId: string;
  roleId: string;
  outputKey: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  output: Record<string, unknown>;
  decisionContext: CreateNodeRunCheckpointInput["decisionContext"];
  resumeContext: CreateNodeRunCheckpointInput["resumeContext"];
}

export function createNodeRunCheckpoint(input: CreateNodeRunCheckpointInput): NodeRunCheckpoint {
  return {
    schemaVersion: NODE_RUN_CHECKPOINT_SCHEMA_VERSION,
    harnessRunId: input.harnessRunId,
    nodeRunId: input.nodeRunId,
    planGraphBundleId: input.planGraphBundleId,
    graphVersion: input.graphVersion,
    planGraphId: input.planGraphId,
    nodeId: input.nodeId,
    taskId: input.taskId,
    executionId: input.executionId,
    divisionId: input.divisionId,
    roleId: input.roleId,
    outputKey: input.outputKey,
    status: input.status,
    producedAt: input.producedAt,
    output: { ...input.output },
    decisionContext: {
      source: input.decisionContext.source,
      request: input.decisionContext.request,
      routeReason: input.decisionContext.routeReason,
      priorNodeSummaries: [...input.decisionContext.priorNodeSummaries],
      dependsOnNodeIds: [...input.decisionContext.dependsOnNodeIds],
    },
    resumeContext: {
      completedNodeIds: [...input.resumeContext.completedNodeIds],
      nextNodeId: input.resumeContext.nextNodeId,
      outputKeys: [...input.resumeContext.outputKeys],
    },
  };
}

export function readNodeRunCheckpoint(record: ArtifactRecord): NodeRunCheckpoint | null {
  if (record.kind !== "node_run_snapshot" || !existsSync(record.storagePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(record.storagePath, "utf8")) as unknown;
    return isNodeRunCheckpoint(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function summarizeNodeRunCheckpoint(artifactId: string, checkpoint: NodeRunCheckpoint) {
  const output = checkpoint.output as { summary?: unknown };
  return {
    artifactId,
    nodeRunId: checkpoint.nodeRunId,
    planGraphId: checkpoint.planGraphId,
    nodeId: checkpoint.nodeId,
    status: checkpoint.status,
    producedAt: checkpoint.producedAt,
    nextNodeId: checkpoint.resumeContext.nextNodeId,
    outputKeys: [...checkpoint.resumeContext.outputKeys],
    summary: typeof output.summary === "string" ? output.summary : null,
    source: checkpoint.decisionContext.source,
  };
}

/**
 * Creates a workflow step checkpoint from input data.
 *
 * Validates and structures the checkpoint data, making defensive copies
 * of arrays to prevent accidental mutation.
 */
export function createWorkflowStepCheckpoint(
  input: CreateWorkflowStepCheckpointInput,
): WorkflowStepCheckpoint {
  return {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    taskId: input.taskId,
    executionId: input.executionId,
    workflowId: input.workflowId,
    divisionId: input.divisionId,
    harnessRunId: input.harnessRunId ?? `harness:${input.executionId ?? input.taskId}`,
    nodeRunId: input.nodeRunId === undefined ? `node:${input.stepId}` : input.nodeRunId,
    planGraphId: input.planGraphId ?? `plan:${input.workflowId}`,
    stepId: input.stepId,
    roleId: input.roleId,
    outputKey: input.outputKey,
    status: input.status,
    producedAt: input.producedAt,
    output: input.output,
    decisionContext: {
      source: input.decisionContext.source,
      request: input.decisionContext.request,
      routeReason: input.decisionContext.routeReason,
      priorStepSummaries: [...input.decisionContext.priorStepSummaries],
      dependsOnStepIds: [...input.decisionContext.dependsOnStepIds],
    },
    resumeContext: {
      completedStepIds: [...input.resumeContext.completedStepIds],
      nextStepId: input.resumeContext.nextStepId,
      outputKeys: [...input.resumeContext.outputKeys],
    },
    fileDiffSummary: {
      summary: input.fileDiffSummary?.summary ?? null,
      createdPaths: [...(input.fileDiffSummary?.createdPaths ?? [])],
      updatedPaths: [...(input.fileDiffSummary?.updatedPaths ?? [])],
      deletedPaths: [...(input.fileDiffSummary?.deletedPaths ?? [])],
    },
    upstreamArtifactRefs: [...(input.upstreamArtifactRefs ?? [])],
    compensationModel: input.compensationModel ?? null,
  };
}

/**
 * Reads a workflow step checkpoint from an artifact record.
 *
 * Validates that the artifact is a workflow_step_snapshot type and that
 * the file exists, then parses and validates the JSON content.
 */
export function readWorkflowStepCheckpoint(record: ArtifactRecord): WorkflowStepCheckpoint | null {
  if (record.kind !== "workflow_step_snapshot" || !existsSync(record.storagePath)) {
    return null;
  }

  try {
    // Use synchronous file read - checkpoint loading is not performance critical
    const fileContent = readFileSync(record.storagePath, "utf8");
    if (record.checksum && record.checksum.length > 0) {
      const actualChecksum = createHash("sha256").update(fileContent).digest("hex");
      if (actualChecksum !== record.checksum) {
        logger.log({
          level: "warn",
          message: "Workflow step checkpoint checksum mismatch",
          data: { storagePath: record.storagePath, expectedChecksum: record.checksum, actualChecksum },
        });
        return null;
      }
    }
    const parsed = JSON.parse(fileContent) as unknown;
    return normalizeWorkflowStepCheckpoint(parsed) ?? null;
  } catch (err) {
    logger.log({
      level: "warn",
      message: "Failed to read workflow step checkpoint",
      data: { error: err instanceof Error ? err.message : String(err), storagePath: record.storagePath },
    });
    return null;
  }
}

/**
 * Creates a summary view of a checkpoint.
 *
 * Extracts key fields for display: nodeRunId, planGraphId, status, timestamps,
 * next node, output keys, and summary text.
 *
 * R8-10 FIX: Now uses nodeRunId as canonical identifier per PlanGraphBundle model.
 */
export function summarizeWorkflowStepCheckpoint(
  artifactId: string,
  checkpoint: WorkflowStepCheckpoint,
): WorkflowStepCheckpointSummary {
  const output = checkpoint.output as { summary?: unknown } | null;
  const nextNodeRunId = checkpoint.resumeContext.nextStepId == null
    ? null
    : checkpoint.resumeContext.nextStepId.startsWith("node:")
      ? checkpoint.resumeContext.nextStepId
      : `node:${checkpoint.resumeContext.nextStepId}`;
  return {
    artifactId,
    nodeRunId: checkpoint.nodeRunId,
    planGraphId: checkpoint.planGraphId,
    stepId: checkpoint.stepId,
    workflowId: checkpoint.workflowId,
    status: checkpoint.status,
    producedAt: checkpoint.producedAt,
    nextNodeRunId,
    nextStepId: checkpoint.resumeContext.nextStepId,
    outputKeys: [...checkpoint.resumeContext.outputKeys],
    summary: typeof output?.summary === "string" ? output.summary : null,
    source: checkpoint.decisionContext.source,
  };
}

export function restoreWorkflowStepCheckpoint(
  checkpoint: WorkflowStepCheckpoint,
): WorkflowStepCheckpointRestoreState {
  return {
    harnessRunId: checkpoint.harnessRunId,
    nodeRunId: checkpoint.nodeRunId,
    planGraphId: checkpoint.planGraphId,
    workflowId: checkpoint.workflowId,
    output: { ...checkpoint.output },
    decisionContext: {
      source: checkpoint.decisionContext.source,
      request: checkpoint.decisionContext.request,
      routeReason: checkpoint.decisionContext.routeReason,
      priorStepSummaries: [...checkpoint.decisionContext.priorStepSummaries],
      dependsOnStepIds: [...checkpoint.decisionContext.dependsOnStepIds],
    },
    resumeContext: {
      completedStepIds: [...checkpoint.resumeContext.completedStepIds],
      nextStepId: checkpoint.resumeContext.nextStepId,
      outputKeys: [...checkpoint.resumeContext.outputKeys],
    },
    fileDiffSummary: {
      summary: checkpoint.fileDiffSummary.summary,
      createdPaths: [...checkpoint.fileDiffSummary.createdPaths],
      updatedPaths: [...checkpoint.fileDiffSummary.updatedPaths],
      deletedPaths: [...checkpoint.fileDiffSummary.deletedPaths],
    },
    compensationModel: checkpoint.compensationModel == null
      ? null
      : typeof checkpoint.compensationModel === "string"
        ? checkpoint.compensationModel
        : { ...checkpoint.compensationModel },
  };
}

export function compareWorkflowStepCheckpointVersions(
  previous: WorkflowStepCheckpoint,
  next: WorkflowStepCheckpoint,
): WorkflowStepCheckpointDiff {
  const previousOutputKeys = new Set(previous.resumeContext.outputKeys);
  const nextOutputKeys = new Set(next.resumeContext.outputKeys);
  return {
    schemaVersionChanged: previous.schemaVersion !== next.schemaVersion,
    statusChanged: previous.status !== next.status,
    outputKeysAdded: [...nextOutputKeys].filter((key) => !previousOutputKeys.has(key)).sort(),
    outputKeysRemoved: [...previousOutputKeys].filter((key) => !nextOutputKeys.has(key)).sort(),
    nextStepChanged: previous.resumeContext.nextStepId !== next.resumeContext.nextStepId,
    compensationChanged: stableStringify(previous.compensationModel) !== stableStringify(next.compensationModel),
  };
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function isWorkflowStepCheckpoint(value: unknown): value is WorkflowStepCheckpoint {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  // R4-18 FIX: Check harnessRunId/nodeRunId/planGraphId instead of stepId
  if (
    !LEGACY_WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSIONS.has(String(candidate.schemaVersion ?? ""))
    || typeof candidate.taskId !== "string"
    || (candidate.executionId !== null && typeof candidate.executionId !== "string")
    || typeof candidate.workflowId !== "string"
    || typeof candidate.divisionId !== "string"
    || typeof candidate.harnessRunId !== "string"
    || typeof candidate.nodeRunId !== "string"
    || typeof candidate.planGraphId !== "string"
    || typeof candidate.roleId !== "string"
    || typeof candidate.outputKey !== "string"
    || typeof candidate.status !== "string"
    || typeof candidate.producedAt !== "string"
    || candidate.output == null
    || typeof candidate.output !== "object"
    || Array.isArray(candidate.output)
  ) {
    return false;
  }

  if (
    candidate.compensationModel !== null
    && candidate.compensationModel !== undefined
    && typeof candidate.compensationModel !== "string"
    && (
      typeof candidate.compensationModel !== "object"
      || Array.isArray(candidate.compensationModel)
      || typeof (candidate.compensationModel as { strategy?: unknown }).strategy !== "string"
    )
  ) {
    return false;
  }

  return isDecisionContext(candidate.decisionContext)
    && isResumeContext(candidate.resumeContext)
    && isFileDiffSummary(candidate.fileDiffSummary)
    && isArtifactRefArray(candidate.upstreamArtifactRefs);
}

function isNodeRunCheckpoint(value: unknown): value is NodeRunCheckpoint {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === NODE_RUN_CHECKPOINT_SCHEMA_VERSION
    && typeof candidate.harnessRunId === "string"
    && typeof candidate.nodeRunId === "string"
    && typeof candidate.planGraphBundleId === "string"
    && typeof candidate.graphVersion === "number"
    && typeof candidate.planGraphId === "string"
    && typeof candidate.nodeId === "string"
    && typeof candidate.taskId === "string"
    && (candidate.executionId === null || typeof candidate.executionId === "string")
    && typeof candidate.divisionId === "string"
    && typeof candidate.roleId === "string"
    && typeof candidate.outputKey === "string"
    && typeof candidate.status === "string"
    && typeof candidate.producedAt === "string"
    && candidate.output != null
    && typeof candidate.output === "object"
    && !Array.isArray(candidate.output)
    && candidate.decisionContext != null
    && typeof candidate.decisionContext === "object"
    && candidate.resumeContext != null
    && typeof candidate.resumeContext === "object";
}

function normalizeWorkflowStepCheckpoint(value: unknown): WorkflowStepCheckpoint | null {
  if (isWorkflowStepCheckpoint(value)) {
    return value;
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION
    || typeof candidate.taskId !== "string"
    || (candidate.executionId !== null && candidate.executionId !== undefined && typeof candidate.executionId !== "string")
    || typeof candidate.workflowId !== "string"
    || typeof candidate.divisionId !== "string"
    || typeof candidate.stepId !== "string"
    || typeof candidate.roleId !== "string"
    || typeof candidate.outputKey !== "string"
    || typeof candidate.status !== "string"
    || typeof candidate.producedAt !== "string"
    || candidate.output == null
    || typeof candidate.output !== "object"
    || Array.isArray(candidate.output)
    || !isDecisionContext(candidate.decisionContext)
    || !isResumeContext(candidate.resumeContext)
    || !isFileDiffSummary(candidate.fileDiffSummary)
    || !isArtifactRefArray(candidate.upstreamArtifactRefs)
  ) {
    return null;
  }
  const legacy = {
    ...candidate,
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    executionId: candidate.executionId ?? null,
    harnessRunId: typeof candidate.harnessRunId === "string"
      ? candidate.harnessRunId
      : `harness:${candidate.executionId ?? candidate.taskId}`,
    nodeRunId: typeof candidate.nodeRunId === "string" ? candidate.nodeRunId : `node:${candidate.stepId}`,
    planGraphId: typeof candidate.planGraphId === "string" ? candidate.planGraphId : `plan:${candidate.workflowId}`,
    compensationModel: candidate.compensationModel ?? null,
  };
  return isWorkflowStepCheckpoint(legacy) ? legacy : null;
}

function isDecisionContext(value: unknown): value is WorkflowStepCheckpointDecisionContext {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.source === "string"
    && typeof candidate.request === "string"
    && (candidate.routeReason === null || typeof candidate.routeReason === "string")
    && isStringArray(candidate.priorStepSummaries)
    && isStringArray(candidate.dependsOnStepIds);
}

function isResumeContext(value: unknown): value is WorkflowStepCheckpointResumeContext {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isStringArray(candidate.completedStepIds)
    && (candidate.nextStepId === null || typeof candidate.nextStepId === "string")
    && isStringArray(candidate.outputKeys);
}

function isFileDiffSummary(value: unknown): value is WorkflowStepCheckpointFileDiffSummary {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (candidate.summary === null || typeof candidate.summary === "string")
    && isStringArray(candidate.createdPaths)
    && isStringArray(candidate.updatedPaths)
    && isStringArray(candidate.deletedPaths);
}

function isArtifactRefArray(value: unknown): value is ArtifactRef[] {
  return Array.isArray(value) && value.every((entry) => isArtifactRef(entry));
}

function isArtifactRef(value: unknown): value is ArtifactRef {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.artifactId === "string"
    && typeof candidate.kind === "string"
    && typeof candidate.uri === "string"
    && typeof candidate.createdAt === "string"
    && (candidate.mimeType === undefined || typeof candidate.mimeType === "string")
    && (candidate.sizeBytes === undefined || typeof candidate.sizeBytes === "number")
    && (candidate.checksum === undefined || typeof candidate.checksum === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
