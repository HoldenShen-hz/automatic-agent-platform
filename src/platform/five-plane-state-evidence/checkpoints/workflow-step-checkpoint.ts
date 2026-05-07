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

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ArtifactRecord, ArtifactRef, StepOutputRecord } from "../../contracts/types/domain.js";
import type { CompensationModel } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export const WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION = "workflow_step_checkpoint.v1";

// R8-10: NodeRun-based checkpoint schema version
export const NODE_RUN_CHECKPOINT_SCHEMA_VERSION = "node_run_checkpoint.v1";

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
  dependsOnNodeRunIds: string[];
  /** @deprecated legacy projection alias; use dependsOnNodeRunIds */
  dependsOnStepIds: string[];
}

/**
 * Context for resuming workflow execution after interruption.
 *
 * Tracks which steps have completed, what the next step to execute is,
 * and which output keys are available for downstream steps.
 */
export interface WorkflowStepCheckpointResumeContext {
  completedNodeRunIds: string[];
  nextNodeRunId: string | null;
  /** @deprecated legacy projection alias; use completedNodeRunIds */
  completedStepIds: string[];
  /** @deprecated legacy projection alias; use nextNodeRunId */
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

/**
 * Complete checkpoint data for a workflow step execution.
 *
 * A checkpoint captures the full state needed to resume execution later,
 * including output, decision reasoning, resume position, file changes,
 * and artifact dependencies.
 */
export interface WorkflowStepCheckpoint {
  schemaVersion: typeof WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION;
  harnessRunId: string;
  nodeRunId: string;
  planGraphBundleId: string;
  taskId: string;
  executionId: string | null;
  workflowId: string;
  divisionId: string;
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
  compensationModel: CompensationModel | null;
}

/**
 * Input for creating a workflow step checkpoint.
 *
 * Used by the workflow executor to capture step state at completion
 * or during critical points in execution.
 */
export interface CreateWorkflowStepCheckpointInput {
  harnessRunId: string;
  nodeRunId: string;
  planGraphBundleId: string;
  taskId: string;
  executionId: string | null;
  workflowId: string;
  divisionId: string;
  stepId: string;
  roleId: string;
  outputKey: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  output: Record<string, unknown>;
  decisionContext: Omit<WorkflowStepCheckpointDecisionContext, "dependsOnNodeRunIds" | "dependsOnStepIds"> & {
    dependsOnNodeRunIds?: string[];
    dependsOnStepIds?: string[];
  };
  resumeContext: Omit<WorkflowStepCheckpointResumeContext, "completedNodeRunIds" | "nextNodeRunId" | "completedStepIds" | "nextStepId"> & {
    completedNodeRunIds?: string[];
    nextNodeRunId?: string | null;
    completedStepIds?: string[];
    nextStepId?: string | null;
  };
  upstreamArtifactRefs?: ArtifactRef[];
  fileDiffSummary?: Partial<WorkflowStepCheckpointFileDiffSummary>;
  compensationModel?: CompensationModel | null;
}

/**
 * Summary view of a checkpoint for listing/display purposes.
 *
 * A condensed view that excludes full output and context to allow
 * listing checkpoints without loading all data.
 * §5.5: Uses canonical harnessRunId/nodeRunId/planGraphBundleId identifiers.
 */
export interface WorkflowStepCheckpointSummary {
  artifactId: string;
  harnessRunId: string;
  nodeRunId: string | null;
  planGraphBundleId: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  nextNodeRunId: string | null;
  nextStepId: string | null;
  outputKeys: string[];
  summary: string | null;
  source: string;
}

// =============================================================================
// R8-10: NodeRun-based Checkpoint Types
// These checkpoint types are based on NodeRun/NodeAttempt rather than workflow-step.
// Includes planGraphBundleId and graphVersion fields for graph versioning support.
// =============================================================================

/**
 * Context about how the node decision was made.
 *
 * Captures the source of the decision, the original request, why a particular
 * route was chosen, prior node summaries for context, and which node IDs this
 * node depends on.
 */
export interface NodeRunCheckpointDecisionContext {
  source: string;
  request: string;
  routeReason: string | null;
  priorNodeSummaries: string[];
  dependsOnNodeIds: string[];
}

/**
 * Context for resuming node execution after interruption.
 *
 * Tracks which nodes have completed, what the next node to execute is,
 * and which output keys are available for downstream nodes.
 */
export interface NodeRunCheckpointResumeContext {
  completedNodeIds: string[];
  nextNodeId: string | null;
  outputKeys: string[];
}

/**
 * Summary of file system changes made by the node.
 *
 * Tracks which files were created, modified, or deleted so the system
 * can understand the side effects of each node for audit and compensation.
 */
export interface NodeRunCheckpointFileDiffSummary {
  summary: string | null;
  createdPaths: string[];
  updatedPaths: string[];
  deletedPaths: string[];
}

/**
 * Complete checkpoint data for a NodeRun execution.
 *
 * A checkpoint captures the full state needed to resume execution later,
 * including output, decision reasoning, resume position, file changes,
 * and artifact dependencies. Based on NodeRun/NodeAttempt with graphVersion
 * and planGraphId for graph versioning support.
 *
 * R8-10: Includes graphVersion and planGraphId fields for proper graph versioning.
 */
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
  decisionContext: NodeRunCheckpointDecisionContext;
  resumeContext: NodeRunCheckpointResumeContext;
  fileDiffSummary: NodeRunCheckpointFileDiffSummary;
  upstreamArtifactRefs: ArtifactRef[];
  compensationModel: CompensationModel | null;
}

/**
 * Input for creating a NodeRun checkpoint.
 *
 * Used by the node executor to capture node state at completion
 * or during critical points in execution.
 */
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
  decisionContext: NodeRunCheckpointDecisionContext;
  resumeContext: NodeRunCheckpointResumeContext;
  upstreamArtifactRefs?: ArtifactRef[];
  fileDiffSummary?: Partial<NodeRunCheckpointFileDiffSummary>;
  compensationModel?: CompensationModel | null;
}

/**
 * Summary view of a NodeRun checkpoint for listing/display purposes.
 *
 * A condensed view that excludes full output and context to allow
 * listing checkpoints without loading all data.
 * R8-10: Uses canonical NodeRun identifiers including graphVersion and planGraphId.
 */
export interface NodeRunCheckpointSummary {
  artifactId: string;
  harnessRunId: string;
  nodeRunId: string;
  planGraphBundleId: string;
  graphVersion: number;
  planGraphId: string;
  status: StepOutputRecord["status"];
  producedAt: string;
  nextNodeId: string | null;
  outputKeys: string[];
  summary: string | null;
  source: string;
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
  const dependsOnNodeRunIds = selectCanonicalIds(
    input.decisionContext.dependsOnNodeRunIds,
    input.decisionContext.dependsOnStepIds,
  );
  const completedNodeRunIds = selectCanonicalIds(
    input.resumeContext.completedNodeRunIds,
    input.resumeContext.completedStepIds,
  );
  const nextNodeRunId = selectCanonicalId(
    input.resumeContext.nextNodeRunId,
    input.resumeContext.nextStepId,
  );

  return {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    harnessRunId: input.harnessRunId,
    nodeRunId: input.nodeRunId,
    planGraphBundleId: input.planGraphBundleId,
    taskId: input.taskId,
    executionId: input.executionId,
    workflowId: input.workflowId,
    divisionId: input.divisionId,
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
      dependsOnNodeRunIds,
      dependsOnStepIds: [...dependsOnNodeRunIds],
    },
    resumeContext: {
      completedNodeRunIds,
      nextNodeRunId,
      completedStepIds: [...completedNodeRunIds],
      nextStepId: nextNodeRunId,
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
    const content = readFileSync(record.storagePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    return normalizeWorkflowStepCheckpoint(parsed);
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
 * Extracts key fields for display: step ID, status, timestamps,
 * next step, output keys, and summary text.
 * §5.5: Uses canonical harnessRunId/nodeRunId/planGraphBundleId identifiers.
 */
export function summarizeWorkflowStepCheckpoint(
  artifactId: string,
  checkpoint: WorkflowStepCheckpoint,
): WorkflowStepCheckpointSummary {
  const output = checkpoint.output as { summary?: unknown } | null;
  return {
    artifactId,
    harnessRunId: checkpoint.harnessRunId,
    nodeRunId: checkpoint.nodeRunId,
    planGraphBundleId: checkpoint.planGraphBundleId,
    status: checkpoint.status,
    producedAt: checkpoint.producedAt,
    nextNodeRunId: checkpoint.resumeContext.nextNodeRunId,
    nextStepId: checkpoint.resumeContext.nextStepId,
    outputKeys: [...checkpoint.resumeContext.outputKeys],
    summary: typeof output?.summary === "string" ? output.summary : null,
    source: checkpoint.decisionContext.source,
  };
}

function isWorkflowStepCheckpoint(value: unknown): value is WorkflowStepCheckpoint {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION
    || typeof candidate.harnessRunId !== "string"
    || typeof candidate.nodeRunId !== "string"
    || typeof candidate.planGraphBundleId !== "string"
    || typeof candidate.taskId !== "string"
    || (candidate.executionId !== null && typeof candidate.executionId !== "string")
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
  ) {
    return false;
  }

  if (candidate.compensationModel !== null
    && candidate.compensationModel !== undefined
    && typeof candidate.compensationModel !== "string"
    && typeof candidate.compensationModel !== "object") {
    return false;
  }

  return isDecisionContext(candidate.decisionContext)
    && isResumeContext(candidate.resumeContext)
    && isFileDiffSummary(candidate.fileDiffSummary)
    && isArtifactRefArray(candidate.upstreamArtifactRefs);
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
    && (
      isStringArray(candidate.dependsOnNodeRunIds)
      || isStringArray(candidate.dependsOnStepIds)
    );
}

function isResumeContext(value: unknown): value is WorkflowStepCheckpointResumeContext {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isStringArray(candidate.completedNodeRunIds)
    || isStringArray(candidate.completedStepIds)
  )
    && (
      candidate.nextNodeRunId === null
      || typeof candidate.nextNodeRunId === "string"
      || candidate.nextStepId === null
      || typeof candidate.nextStepId === "string"
    )
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

function selectCanonicalIds(
  canonicalIds: readonly string[] | undefined,
  legacyIds: readonly string[] | undefined,
): string[] {
  if (canonicalIds != null && canonicalIds.length > 0) {
    return [...canonicalIds];
  }
  if (legacyIds != null && legacyIds.length > 0) {
    return [...legacyIds];
  }
  return [...(canonicalIds ?? legacyIds ?? [])];
}

function selectCanonicalId(
  canonicalId: string | null | undefined,
  legacyId: string | null | undefined,
): string | null {
  if (canonicalId != null && canonicalId.length > 0) {
    return canonicalId;
  }
  if (legacyId != null && legacyId.length > 0) {
    return legacyId;
  }
  return canonicalId ?? legacyId ?? null;
}

function normalizeWorkflowStepCheckpoint(value: unknown): WorkflowStepCheckpoint | null {
  if (!isWorkflowStepCheckpoint(value)) {
    return null;
  }

  const checkpoint = value as WorkflowStepCheckpoint & {
    readonly decisionContext: WorkflowStepCheckpointDecisionContext & { dependsOnNodeRunIds?: string[] };
    readonly resumeContext: WorkflowStepCheckpointResumeContext & {
      completedNodeRunIds?: string[];
      nextNodeRunId?: string | null;
    };
  };

  const dependsOnNodeRunIds = checkpoint.decisionContext.dependsOnNodeRunIds ?? checkpoint.decisionContext.dependsOnStepIds;
  const completedNodeRunIds = checkpoint.resumeContext.completedNodeRunIds ?? checkpoint.resumeContext.completedStepIds;
  const nextNodeRunId = checkpoint.resumeContext.nextNodeRunId ?? checkpoint.resumeContext.nextStepId;

  return {
    ...checkpoint,
    decisionContext: {
      ...checkpoint.decisionContext,
      dependsOnNodeRunIds: [...dependsOnNodeRunIds],
      dependsOnStepIds: [...dependsOnNodeRunIds],
    },
    resumeContext: {
      ...checkpoint.resumeContext,
      completedNodeRunIds: [...completedNodeRunIds],
      nextNodeRunId,
      completedStepIds: [...completedNodeRunIds],
      nextStepId: nextNodeRunId,
    },
  };
}

// =============================================================================
// R8-10: NodeRun-based Checkpoint Functions
// =============================================================================

/**
 * Creates a NodeRun checkpoint from input data.
 *
 * Validates and structures the checkpoint data, making defensive copies
 * of arrays to prevent accidental mutation.
 */
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
    output: input.output,
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
 * Reads a NodeRun checkpoint from an artifact record.
 *
 * Validates that the artifact is a node_run_snapshot type and that
 * the file exists, then parses and validates the JSON content.
 */
export function readNodeRunCheckpoint(record: ArtifactRecord): NodeRunCheckpoint | null {
  if (record.kind !== "node_run_snapshot" || !existsSync(record.storagePath)) {
    return null;
  }

  try {
    const content = readFileSync(record.storagePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    return isNodeRunCheckpoint(parsed) ? parsed : null;
  } catch (err) {
    logger.log({
      level: "warn",
      message: "Failed to read NodeRun checkpoint",
      data: { error: err instanceof Error ? err.message : String(err), storagePath: record.storagePath },
    });
    return null;
  }
}

/**
 * Creates a summary view of a NodeRun checkpoint.
 *
 * Extracts key fields for display: node ID, status, timestamps,
 * next node, output keys, and summary text.
 * R8-10: Uses canonical NodeRun identifiers including graphVersion and planGraphId.
 */
export function summarizeNodeRunCheckpoint(
  artifactId: string,
  checkpoint: NodeRunCheckpoint,
): NodeRunCheckpointSummary {
  const output = checkpoint.output as { summary?: unknown } | null;
  return {
    artifactId,
    harnessRunId: checkpoint.harnessRunId,
    nodeRunId: checkpoint.nodeRunId,
    planGraphBundleId: checkpoint.planGraphBundleId,
    graphVersion: checkpoint.graphVersion,
    planGraphId: checkpoint.planGraphId,
    status: checkpoint.status,
    producedAt: checkpoint.producedAt,
    nextNodeId: checkpoint.resumeContext.nextNodeId,
    outputKeys: [...checkpoint.resumeContext.outputKeys],
    summary: typeof output?.summary === "string" ? output.summary : null,
    source: checkpoint.decisionContext.source,
  };
}

function isNodeRunCheckpoint(value: unknown): value is NodeRunCheckpoint {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== NODE_RUN_CHECKPOINT_SCHEMA_VERSION
    || typeof candidate.harnessRunId !== "string"
    || typeof candidate.nodeRunId !== "string"
    || typeof candidate.planGraphBundleId !== "string"
    || typeof candidate.graphVersion !== "number"
    || typeof candidate.planGraphId !== "string"
    || typeof candidate.nodeId !== "string"
    || typeof candidate.taskId !== "string"
    || (candidate.executionId !== null && typeof candidate.executionId !== "string")
    || typeof candidate.divisionId !== "string"
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

  if (candidate.compensationModel !== null
    && candidate.compensationModel !== undefined
    && typeof candidate.compensationModel !== "string"
    && typeof candidate.compensationModel !== "object") {
    return false;
  }

  return isNodeRunDecisionContext(candidate.decisionContext)
    && isNodeRunResumeContext(candidate.resumeContext)
    && isNodeRunFileDiffSummary(candidate.fileDiffSummary)
    && isArtifactRefArray(candidate.upstreamArtifactRefs);
}

function isNodeRunDecisionContext(value: unknown): value is NodeRunCheckpointDecisionContext {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.source === "string"
    && typeof candidate.request === "string"
    && (candidate.routeReason === null || typeof candidate.routeReason === "string")
    && isStringArray(candidate.priorNodeSummaries)
    && isStringArray(candidate.dependsOnNodeIds);
}

function isNodeRunResumeContext(value: unknown): value is NodeRunCheckpointResumeContext {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isStringArray(candidate.completedNodeIds)
    && (candidate.nextNodeId === null || typeof candidate.nextNodeId === "string")
    && isStringArray(candidate.outputKeys);
}

function isNodeRunFileDiffSummary(value: unknown): value is NodeRunCheckpointFileDiffSummary {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (candidate.summary === null || typeof candidate.summary === "string")
    && isStringArray(candidate.createdPaths)
    && isStringArray(candidate.updatedPaths)
    && isStringArray(candidate.deletedPaths);
}
