import { ValidationError } from "../errors.js";
import type { PlanStep } from "../../orchestration/oapeflir/types/plan.js";
import type { SideEffectStatus } from "../executable-contracts/index.js";
import { newId, nowIso } from "./ids.js";

export interface PlatformPrincipal {
  readonly actorId: string;
  readonly tenantId: string | null;
  readonly roles: readonly string[];
  readonly authMethod?: string;
  readonly displayName?: string;
}

export interface RequestEnvelope<TPayload = unknown> {
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly tenantId: string;
  readonly timestamp: string;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, string>>;
}

export type ControlDirectiveType =
  | "mode_switch"
  | "pause"
  | "resume"
  | "rollback"
  | "quota_adjust"
  | "kill";

export interface ControlDirectiveScope {
  readonly tenantId?: string;
  readonly workflowId?: string;
  readonly workerId?: string;
}

export interface ControlDirective<TParams extends Record<string, unknown> = Record<string, unknown>> {
  readonly directiveId: string;
  readonly type: ControlDirectiveType;
  readonly targetScope: ControlDirectiveScope;
  readonly issuedBy: PlatformPrincipal;
  readonly reason: string;
  readonly params: TParams;
  readonly expiresAt?: string;
}

export interface SideEffectExpectation {
  readonly effectId: string;
  readonly category: "read" | "write" | "notification" | "artifact" | "external_api";
  readonly targetRef: string;
  readonly requiredReceipt: boolean;
  readonly reversible: boolean;
}

export interface SideEffectRecord {
  readonly effectId: string;
  readonly category: SideEffectExpectation["category"];
  readonly targetRef: string;
  readonly status: SideEffectStatus | "rolled_back";
  readonly summary?: string;
  readonly evidenceRef?: string;
}

export interface ExecutionPlanBudget {
  readonly maxSteps: number;
  readonly maxDurationMs: number;
  readonly maxCost: number;
}

export interface ExecutionPlan {
  readonly planId: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly workflowRunId: string;
  readonly steps: readonly PlanStep[];
  readonly fallbackStrategy: "retry" | "replan" | "escalate" | "abort";
  readonly approvalGates: readonly string[];
  readonly sideEffectExpectations: readonly SideEffectExpectation[];
  readonly budget: ExecutionPlanBudget;
  readonly createdAt: string;
}

export interface ExecutionReceiptErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ExecutionReceipt {
  readonly receiptId: string;
  readonly planId: string;
  readonly stepId: string;
  readonly status: "succeeded" | "failed" | "timeout" | "cancelled" | "awaiting_approval";
  readonly durationMs: number;
  readonly sideEffects: readonly SideEffectRecord[];
  readonly evidenceRefs: readonly string[];
  readonly errorDetail?: ExecutionReceiptErrorDetail;
}

export type StateCommandType =
  | "update_truth"
  | "append_event"
  | "write_checkpoint"
  | "store_artifact";

export interface StateCommand<TPayload = unknown> {
  readonly commandId: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly type: StateCommandType;
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly fencingToken: string;
  readonly payload: TPayload;
}

function stringifyRecord(input?: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  if (input == null) {
    return {};
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
}

export function createPlatformPrincipal(input: {
  actorId: string;
  tenantId: string | null;
  roles?: readonly string[];
  authMethod?: string;
  displayName?: string;
}): PlatformPrincipal {
  return {
    actorId: input.actorId,
    tenantId: input.tenantId,
    roles: input.roles ?? [],
    ...(input.authMethod != null ? { authMethod: input.authMethod } : {}),
    ...(input.displayName != null ? { displayName: input.displayName } : {}),
  };
}

export function createRequestEnvelope<TPayload>(input: {
  principal: PlatformPrincipal;
  tenantId?: string;
  payload: TPayload;
  metadata?: Readonly<Record<string, unknown>>;
  requestId?: string;
  idempotencyKey?: string;
  traceId?: string;
  timestamp?: string;
}): RequestEnvelope<TPayload> {
  return {
    requestId: input.requestId ?? newId("request"),
    idempotencyKey: input.idempotencyKey ?? newId("idem"),
    traceId: input.traceId ?? newId("trace"),
    principal: input.principal,
    tenantId: input.tenantId ?? input.principal.tenantId ?? "global",
    timestamp: input.timestamp ?? nowIso(),
    payload: input.payload,
    metadata: stringifyRecord(input.metadata),
  };
}

export function createControlDirective<TParams extends Record<string, unknown>>(input: {
  type: ControlDirectiveType;
  targetScope?: ControlDirectiveScope;
  issuedBy: PlatformPrincipal;
  reason: string;
  params?: TParams;
  directiveId?: string;
  expiresAt?: string;
}): ControlDirective<TParams> {
  void input;
  throw new ValidationError(
    "platform_contracts.legacy_control_directive_forbidden",
    "Legacy ControlDirective factory is disabled. Use executable-contracts or governance plane directives.",
  );
}

export function createExecutionPlan(input: {
  traceId: string;
  principal: PlatformPrincipal;
  workflowRunId: string;
  steps: readonly PlanStep[];
  fallbackStrategy?: ExecutionPlan["fallbackStrategy"];
  approvalGates?: readonly string[];
  sideEffectExpectations?: readonly SideEffectExpectation[];
  budget: ExecutionPlanBudget;
  planId?: string;
  createdAt?: string;
}): ExecutionPlan {
  void input;
  throw new ValidationError(
    "platform_contracts.legacy_execution_plan_forbidden",
    "Legacy ExecutionPlan factory is disabled. Use PlanGraphBundle from executable-contracts.",
  );
}

export function createExecutionReceipt(input: {
  planId: string;
  stepId: string;
  status: ExecutionReceipt["status"];
  durationMs: number;
  sideEffects?: readonly SideEffectRecord[];
  evidenceRefs?: readonly string[];
  errorDetail?: ExecutionReceiptErrorDetail;
  receiptId?: string;
}): ExecutionReceipt {
  void input;
  throw new ValidationError(
    "platform_contracts.legacy_execution_receipt_forbidden",
    "Legacy ExecutionReceipt factory is disabled. Use NodeAttemptReceipt from executable-contracts.",
  );
}

export function createStateCommand<TPayload>(input: {
  traceId: string;
  principal: PlatformPrincipal;
  type: StateCommandType;
  aggregateId: string;
  expectedVersion: number;
  fencingToken: string;
  payload: TPayload;
  commandId?: string;
}): StateCommand<TPayload> {
  return {
    commandId: input.commandId ?? newId("statecmd"),
    traceId: input.traceId,
    principal: input.principal,
    type: input.type,
    aggregateId: input.aggregateId,
    expectedVersion: input.expectedVersion,
    fencingToken: input.fencingToken,
    payload: input.payload,
  };
}

export interface EvidenceRecord {
  readonly recordId: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly category: "decision" | "execution" | "approval" | "audit" | "compliance";
  readonly targetRef: string;
  readonly content: unknown;
  readonly timestamp: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ProjectionUpdate {
  readonly projectionId: string;
  readonly projectionType: string;
  readonly version: number;
  readonly timestamp: string;
  readonly sourceEvents: readonly string[];
  readonly patch: Readonly<Record<string, unknown>>;
  readonly metadata: {
    readonly rebuiltAt?: string | undefined;
    readonly triggeredBy: string;
    readonly idempotencyKey: string;
  };
}

export function createEvidenceRecord(input: {
  traceId: string;
  principal: PlatformPrincipal;
  category: EvidenceRecord["category"];
  targetRef: string;
  content: unknown;
  metadata?: Readonly<Record<string, string>>;
  recordId?: string;
}): EvidenceRecord {
  return {
    recordId: input.recordId ?? newId("evid"),
    traceId: input.traceId,
    principal: input.principal,
    category: input.category,
    targetRef: input.targetRef,
    content: input.content,
    timestamp: nowIso(),
    metadata: input.metadata ?? {},
  };
}

export function createProjectionUpdate(input: {
  projectionId: string;
  projectionType: string;
  version: number;
  sourceEvents: readonly string[];
  patch: Readonly<Record<string, unknown>>;
  triggeredBy: string;
  rebuiltAt?: string;
  idempotencyKey?: string;
}): ProjectionUpdate {
  return {
    projectionId: input.projectionId,
    projectionType: input.projectionType,
    version: input.version,
    timestamp: nowIso(),
    sourceEvents: input.sourceEvents,
    patch: input.patch,
    metadata: {
      ...(input.rebuiltAt != null ? { rebuiltAt: input.rebuiltAt } : {}),
      triggeredBy: input.triggeredBy,
      idempotencyKey: input.idempotencyKey ?? newId("projupd"),
    },
  };
}
