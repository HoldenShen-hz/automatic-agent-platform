/**
 * @fileoverview Execution Types - Core execution records.
 *
 * Contains the primary execution record and related execution-level
 * records (precheck, dead letter).
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  RunKind,
  Timestamp,
} from "./primitives.js";
import type {
  ExecutionStatus,
} from "../status.js";

// ---------------------------------------------------------------------------
// Execution record
// ---------------------------------------------------------------------------

/**
 * Execution record - represents a single attempt to execute work for a task.
 *
 * An execution is created when a task moves to in_progress. Multiple executions
 * may exist for the same task if retries occur. Each execution has a unique
 * attempt number and maintains its own lease for worker assignment.
 *
 * The execution record captures resource allocation (budget, timeout, tools)
 * and the current status through the lifecycle: created → prechecking →
 * executing → succeeded/failed/cancelled.
 */
export interface ExecutionRecord {
  id: string;
  taskId: string;
  workflowId: string | null;
  /** Parent execution ID for nested executions (e.g., spawned sub-agents) */
  parentExecutionId: string | null;
  agentId: string;
  roleId: string | null;
  runKind: RunKind;
  status: ExecutionStatus;
  inputRef: string | null;
  traceId: string;
  /** Attempt number within this execution's retry lifecycle (starts at 1) */
  attempt: number;
  timeoutMs: number;
  budgetUsdLimit: number | null;
  budgetReservationId: string | null;
  budgetLedgerId: string | null;
  requiresApproval: 0 | 1;
  sandboxMode: string | null;
  allowedToolsJson: string | null;
  allowedPathsJson: string | null;
  maxRetries: number;
  retryBackoff: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Execution precheck record
// ---------------------------------------------------------------------------

/**
 * Execution precheck record - validates resource readiness before execution begins.
 *
 * Prechecks verify that required resources (budget, tools, paths) are available
 * and within limits. If any check fails, the execution transitions to blocked
 * or failed rather than attempting to run.
 */
export interface ExecutionPrecheckRecord {
  id: string;
  executionId: string;
  /** Whether all prechecks passed (1 = allowed, 0 = denied) */
  allowed: 0 | 1;
  reasonCode: string | null;
  resolvedBudgetUsd: number | null;
  resolvedTimeoutMs: number;
  resolvedSandboxMode: string;
  resolvedToolsJson: string | null;
  resolvedPathsJson: string | null;
  checkedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Dead letter record
// ---------------------------------------------------------------------------

/**
 * Dead letter record - preserves failed executions for manual inspection.
 *
 * When an execution fails after all retries or requires manual intervention,
 * it is moved to the dead letter queue (DLQ). The record preserves the
 * error context (reason code, message, retry count) for debugging.
 */
export interface DeadLetterRecord {
  id: string;
  executionId: string;
  taskId: string;
  finalReasonCode: string;
  /** Number of retry attempts made before moving to DLQ */
  retryCount: number;
  lastErrorMessage: string | null;
  movedAt: Timestamp;
}
