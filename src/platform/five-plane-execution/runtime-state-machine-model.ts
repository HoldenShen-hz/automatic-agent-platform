import type {
  BudgetLedger,
  BudgetReservation,
  HarnessRun,
  HarnessRunStatus,
  NodeRun,
  NodeRunStatus,
  PlatformFactEvent,
  SideEffectRecord,
  SideEffectStatus,
} from "../contracts/executable-contracts/index.js";

export type RuntimeStateAggregate = HarnessRun | NodeRun | SideEffectRecord | BudgetLedger | BudgetReservation;

export type RuntimeStateAggregateType =
  | "HarnessRun"
  | "NodeRun"
  | "SideEffectRecord"
  | "BudgetLedger"
  | "BudgetReservation";

export type RuntimeStatus<TAggregate extends RuntimeStateAggregate> = TAggregate extends HarnessRun
  ? HarnessRunStatus
  : TAggregate extends NodeRun
    ? NodeRunStatus
    : TAggregate extends SideEffectRecord
      ? SideEffectStatus
      : TAggregate extends BudgetLedger
        ? BudgetLedger["status"]
        : TAggregate extends BudgetReservation
          ? BudgetReservation["status"]
          : never;

export interface RuntimeTransitionCommand<TAggregate extends RuntimeStateAggregate> {
  readonly commandId: string;
  readonly entityType: RuntimeStateAggregateType;
  readonly entityId: string;
  readonly aggregateType: RuntimeStateAggregateType;
  readonly aggregate: TAggregate;
  readonly fromStatus: RuntimeStatus<TAggregate>;
  readonly toStatus: RuntimeStatus<TAggregate>;
  readonly principal: string;
  readonly expectedSeq?: number;
  readonly expectedVersion?: number;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly traceId: string;
  readonly tenantId: string;
  readonly reasonCode: string;
  readonly emittedBy: string;
  readonly runVersionLockId?: string;
  readonly policyGuard?: RuntimePolicyGuard;
  readonly budgetPrecondition?: RuntimeBudgetPrecondition;
  readonly sideEffectSafety?: RuntimeSideEffectSafety;
  readonly auditRef?: string;
  readonly occurredAt?: string;
}

export interface RuntimePolicyGuard {
  readonly allowed: boolean;
  readonly policyProofRef: string;
}

export interface RuntimeBudgetPrecondition {
  readonly reservationId: string;
  readonly hardCapSatisfied: boolean;
}

export interface RuntimeSideEffectSafety {
  readonly idempotencyKey?: string;
  readonly preCommitPolicyProofRef?: string;
  readonly humanApprovalRef?: string;
  readonly reversible?: boolean;
}

export interface RuntimeTransitionResult<TAggregate extends RuntimeStateAggregate> {
  readonly aggregate: TAggregate;
  readonly event: PlatformFactEvent;
}

export type EventPersistenceCallback = (event: PlatformFactEvent) => void;

export type TransitionTable<TStatus extends string> = Record<TStatus, readonly TStatus[]>;

export const HARNESS_RUN_TRANSITIONS: TransitionTable<HarnessRunStatus> = {
  created: ["admitted", "failed", "cancelled", "aborted"],
  admitted: ["planning", "ready", "failed", "cancelled", "aborted"],
  planning: ["ready", "replanning", "failed", "cancelled", "aborted"],
  ready: ["running", "paused", "failed", "cancelled", "aborted"],
  running: ["pausing", "paused", "replanning", "compensating", "completed", "failed", "cancelled", "aborted"],
  pausing: ["paused", "failed", "cancelled", "aborted"],
  paused: ["resuming", "replanning", "failed", "cancelled", "aborted"],
  resuming: ["running", "failed", "cancelled", "aborted"],
  replanning: ["ready", "running", "failed", "cancelled", "aborted"],
  compensating: ["completed", "failed", "cancelled", "aborted"],
  completed: [],
  failed: [],
  cancelled: [],
  aborted: [],
};

export const NODE_RUN_TRANSITIONS: TransitionTable<NodeRunStatus> = {
  created: ["ready", "policy_blocked", "dependency_failed", "aborted"],
  ready: ["leased", "policy_blocked", "dependency_failed", "skipped", "aborted"],
  leased: ["running", "ready", "cancelled", "aborted"],
  running: ["retry_wait", "awaiting_hitl", "reconciling", "succeeded", "failed", "cancelled", "aborted"],
  retry_wait: ["ready", "failed", "aborted"],
  awaiting_hitl: ["ready", "running", "failed", "cancelled", "aborted"],
  reconciling: ["succeeded", "failed", "aborted"],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
  dependency_failed: [],
  policy_blocked: [],
  aborted: [],
};

export const SIDE_EFFECT_TRANSITIONS: TransitionTable<SideEffectStatus> = {
  proposed: ["approved", "reserved", "manual_review_required", "revoked", "expired", "failed"],
  approved: ["reserved", "committing", "revoked", "expired", "failed"],
  reserved: ["committing", "revoked", "expired", "failed"],
  committing: ["committed", "confirming", "confirmed", "ambiguous", "manual_review_required", "failed"],
  committed: ["confirming", "confirmed", "ambiguous", "compensation_required", "failed"],
  confirming: ["confirmed", "ambiguous", "manual_review_required", "failed"],
  confirmed: ["reconciling", "compensation_required", "compensating"],
  ambiguous: ["reconciling", "manual_review_required", "compensation_required", "compensating", "failed"],
  manual_review_required: ["approved", "reconciling", "compensation_required", "failed"],
  reconciling: ["confirmed", "ambiguous", "manual_review_required", "compensation_required", "compensating", "failed"],
  compensation_required: ["compensating", "failed"],
  compensating: ["compensated", "failed"],
  compensated: [],
  failed: [],
  revoked: [],
  expired: [],
};

export const BUDGET_LEDGER_TRANSITIONS: TransitionTable<BudgetLedger["status"]> = {
  open: ["soft_cap_reached", "hard_cap_reached", "closed"],
  soft_cap_reached: ["open", "hard_cap_reached", "closed"],
  hard_cap_reached: ["closed"],
  settling: ["closed"],
  reserving: ["closed"],
  releasing: ["closed"],
  closed: [],
};

export const BUDGET_RESERVATION_TRANSITIONS: TransitionTable<BudgetReservation["status"]> = {
  reserved: ["settled", "released", "expired", "rejected"],
  settled: [],
  released: [],
  expired: [],
  rejected: [],
};
