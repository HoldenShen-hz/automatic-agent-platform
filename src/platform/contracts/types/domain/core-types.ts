/**
 * @fileoverview Core Types - Core domain infrastructure types.
 *
 * Contains the core domain infrastructure types including trace context,
 * transition commands, and the task snapshot aggregate.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  TransitionEntityKind,
  TransitionActorType,
  Timestamp,
} from "./primitives.js";
import type {
  TaskRecord,
  WorkflowStateRecord,
} from "./task-types.js";
import type {
  ExecutionRecord,
} from "./execution-types.js";
import type {
  SessionRecord,
} from "./session-types.js";
import type {
  StepOutputRecord,
} from "./task-types.js";
import type {
  EventRecord,
} from "./session-types.js";
import type {
  TaskStatus,
  WorkflowStatus,
  ExecutionStatus,
  SessionStatus,
  ApprovalStatus,
} from "../status.js";

// ---------------------------------------------------------------------------
// Trace context
// ---------------------------------------------------------------------------

export interface TraceContext {
  traceId: string;
  spanId: string | null;
  parentSpanId: string | null;
  correlationId: string | null;
}

// ---------------------------------------------------------------------------
// Transition audit context
// ---------------------------------------------------------------------------

export interface TransitionAuditContext {
  reasonCode: string;
  reasonDetail?: string;
  traceId: string;
  spanId?: string;
  parentSpanId?: string | null;
  correlationId?: string;
  actorType: TransitionActorType;
  actorId?: string;
  idempotencyKey?: string;
  occurredAt: Timestamp;
  metadataJson?: string;
}

export interface TransitionPrincipalLike {
  principalId?: string;
  actorId?: string;
  tenantId?: string | null;
  roles?: readonly string[];
}

// ---------------------------------------------------------------------------
// Transition command
// ---------------------------------------------------------------------------

export interface TransitionCommand<TKind extends TransitionEntityKind, TStatus extends string> extends TransitionAuditContext {
  principal?: TransitionPrincipalLike;
  leaseId?: string;
  fencingToken?: string;
  event?: string;
  payload?: unknown;
  expectedVersion?: number | null;
  entityKind: TKind;
  entityId: string;
  fromStatus?: TStatus;
  toStatus: TStatus;
}

export type TaskStatusTransitionCommand = TransitionCommand<"task", TaskStatus> & {
  fromStatus: TaskStatus;
  executionId: string | null;
};

export type WorkflowStatusTransitionCommand = TransitionCommand<"workflow", WorkflowStatus> & {
  fromStatus: WorkflowStatus;
  currentStepIndex: number;
  outputsJson: string;
};

export type SessionStatusTransitionCommand = TransitionCommand<"session", SessionStatus> & {
  fromStatus: SessionStatus;
};

export type ExecutionStatusTransitionCommand = TransitionCommand<"execution", ExecutionStatus> & {
  fromStatus: ExecutionStatus;
};

export type ApprovalStatusTransitionCommand = TransitionCommand<"approval", ApprovalStatus> & {
  fromStatus: ApprovalStatus;
  responseJson: string;
};

// ---------------------------------------------------------------------------
// Task snapshot
// ---------------------------------------------------------------------------

export type TaskSnapshot = {
  task: TaskRecord;
  workflow: WorkflowStateRecord | null;
  execution: ExecutionRecord | null;
  session: SessionRecord | null;
  stepOutputs: StepOutputRecord[];
  events: EventRecord[];
};
