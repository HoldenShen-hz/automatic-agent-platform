/**
 * @fileoverview Task Types - Task, Workflow, and Step output records.
 *
 * Contains records related to task execution, workflow state management,
 * and step-level outputs within a workflow.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  TaskPriority,
  TaskSource,
  BudgetScope,
  MemoryLayer,
  MemorySourceTrustLevel,
  Timestamp,
} from "./primitives.js";
import type {
  TaskStatus,
  WorkflowStatus,
} from "../status.js";

export type { TaskPriority, TaskSource, BudgetScope, MemoryLayer, MemorySourceTrustLevel, Timestamp };

// ---------------------------------------------------------------------------
// Artifact types
// ---------------------------------------------------------------------------

/**
 * @deprecated ArtifactRef in domain/task-types.ts is deprecated per §5.3.
 * Use ArtifactRef from executable-contracts (canonical with artifactId, uri, hash?, version?).
 * This interface is retained for legacy adapter compatibility only.
 */
export type LegacyArtifactRef = {
  artifactId: string;
  kind: string;
  uri: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  createdAt: Timestamp;
};

// Re-export canonical ArtifactRef from executable-contracts for type compatibility
export type { ArtifactRef } from "../../executable-contracts/index.js";

export interface ArtifactRecord {
  artifactId: string;
  taskId: string;
  executionId: string | null;
  stepId: string | null;
  kind: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  lineageJson: string | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Task record
// ---------------------------------------------------------------------------

/**
 * Task record - represents the primary unit of work in the system.
 *
 * A task moves through states: queued → pending → in_progress → done/failed/cancelled.
 * Tasks may be created by users directly or by the system (e.g., perception triggers).
 * Hierarchical tracking via parentId/rootId supports task delegation and subtasks.
 */
export interface TaskRecord {
  id: string;
  /** Parent task ID if this is a subtask, null if top-level */
  parentId: string | null;
  /** Root task ID for the entire task tree (same as id for top-level tasks) */
  rootId: string;
  /** HarnessRun ID that authorizes this task's execution. Optional during migration of legacy task producers. */
  harnessRunId?: string | null;
  divisionId: string | null;
  tenantId?: string | null;
  title: string;
  status: TaskStatus;
  source: TaskSource;
  priority: TaskPriority;
  /** JSON-serialized original input/request */
  inputJson: string;
  /** Normalized form of input for deduplication/caching */
  normalizedInputJson: string | null;
  /** JSON-serialized output result */
  outputJson: string | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number;
  errorCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Workflow state record
// ---------------------------------------------------------------------------

/**
 * Workflow state record - tracks the state of a multi-step workflow attached to a task.
 *
 * A workflow progresses through steps defined in the workflow definition.
 * currentStepIndex indicates the currently executing step (0-indexed).
 * The outputsJson accumulates step outputs as the workflow progresses.
 */
export interface WorkflowStateRecord {
  taskId: string;
  divisionId: string;
  workflowId: string;
  /** Index of the currently executing step (0-indexed, starts at 0) */
  currentStepIndex: number;
  status: WorkflowStatus;
  /** JSON object accumulating outputs from completed steps: { stepKey: stepOutput } */
  outputsJson: string;
  lastErrorCode: string | null;
  retryCount: number;
  /** Step ID from which execution can resume after interruption */
  resumableFromStep: string | null;
  startedAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Step output record
// ---------------------------------------------------------------------------

/**
 * Step output record - captures the result of a single workflow step execution.
 *
 * @deprecated Per §5.5, stepId is a legacy semantic projection. Use nodeRunId for
 * canonical step execution references. This interface is retained for legacy adapter
 * compatibility only.
 *
 * Produced when a step completes (succeeded, failed, partial_success) or is skipped.
 * The dataJson contains the step's structured output defined by the workflow schema.
 * summary is a human-readable brief description for display/logging purposes.
 */
export interface StepOutputRecord {
  id: string;
  taskId: string;
  stepId: string;
  roleId: string;
  status: "succeeded" | "failed" | "partial_success" | "skipped";
  /** JSON-serialized step output defined by the workflow output schema */
  dataJson: string;
  summary: string | null;
  artifactsJson: string | null;
  tokenCost: number;
  durationMs: number;
  validationJson: string | null;
  producedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Cost event record
// ---------------------------------------------------------------------------

/**
 * Cost event record - tracks token usage and cost for LLM API calls.
 *
 * Records input/output token counts and calculated cost in USD.
 * Multiple cost events may be recorded per execution as different models are used.
 */
export interface CostEventRecord {
  id: string;
  taskId: string;
  sessionId: string | null;
  executionId: string | null;
  agentId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  budgetScope: BudgetScope;
  providerRequestId: string | null;
  pricingVersion: string | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Memory record
// ---------------------------------------------------------------------------

/**
 * Memory kind - categorizes the type of memory content.
 */
export type MemoryKind = "general" | "fact" | "episode" | "rule" | "decision";

/**
 * Memory status - indicates the current state of a memory record.
 */
export type MemoryStatus = "active" | "archived" | "superseded";

/**
 * Memory record - represents a retrievable memory unit in the memory system.
 *
 * Memories are classified and scoped for retrieval decisions.
 * Layer indicates the memory tier (layer_3/5/7), with different latency/retention tradeoffs.
 * Quality score and hit count support memory quality assessment and relevance ranking.
 */
export interface MemoryRecord {
  id: string;
  taskId: string | null;
  sessionId: string | null;
  agentId: string | null;
  executionId: string | null;
  memoryLayer: MemoryLayer;
  scope: string;
  contentJson: string;
  classification: string;
  sourceTrustLevel: MemorySourceTrustLevel;
  qualityScore: number | null;
  hitCount: number;
  createdAt: Timestamp;
  lastAccessedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  revokedAt: Timestamp | null;
  revocationReason: string | null;
  /** Kind of memory: general, fact, episode, rule, decision */
  kind: MemoryKind;
  /** Status: active, archived, superseded */
  status: MemoryStatus;
  /** Importance score 0-1 for retrieval ranking */
  importanceScore: number | null;
  /** Freshness score 0-1 for recency ranking */
  freshnessScore: number | null;
  /** SHA-256 hash of content for deduplication */
  contentHash: string | null;
}

/**
 * Session summary record - captures the outcome of a completed session.
 */
export interface SessionSummaryRecord {
  id: string;
  sessionId: string;
  taskId: string | null;
  agentId: string | null;
  summaryText: string;
  keyDecisions: string | null;
  keyOutcomes: string | null;
  memoryIdsReferenced: string | null;
  tokenCount: number | null;
  createdAt: Timestamp;
}
