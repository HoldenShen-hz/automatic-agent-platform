import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export type DelegationPriority = "low" | "normal" | "high" | "critical";

export interface DelegationRequest {
  requestId: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string | null;
  capabilityRef: string | null;
  priority: DelegationPriority;
  reason: string;
  contextRef: string | null;
  tenantId: string | null;
  // R25-20 fix: budgetEnvelope and budgetReservationId for ADR-026 8-factor budget tracking
  // Budget tracking is the 6th factor in the 8-factor risk model
  budgetReservationId: string | null;
  budgetEnvelope: BudgetEnvelope | null;
  createdAt: string;
}

export interface BudgetEnvelope {
  amount: number;
  currency: string;
  resourceKinds: readonly string[];
}

export function createDelegationRequest(input: Omit<DelegationRequest, "requestId" | "createdAt" | "budgetReservationId" | "budgetEnvelope"> & {
  requestId?: string;
  createdAt?: string;
  budgetReservationId?: string | null;
  budgetEnvelope?: BudgetEnvelope | null;
}): DelegationRequest {
  assertRequired(input.taskId, "delegation.task_id_required");
  assertRequired(input.fromAgentId, "delegation.from_agent_required");
  if ((input.toAgentId == null || input.toAgentId.trim().length === 0) && (input.capabilityRef == null || input.capabilityRef.trim().length === 0)) {
    throw new ValidationError("delegation.target_required", "Delegation request requires a target agent or capability reference.");
  }
  return {
    requestId: input.requestId ?? newId("delegate"),
    taskId: input.taskId,
    fromAgentId: input.fromAgentId,
    toAgentId: normalizeNullable(input.toAgentId),
    capabilityRef: normalizeNullable(input.capabilityRef),
    priority: input.priority,
    reason: input.reason,
    contextRef: normalizeNullable(input.contextRef),
    tenantId: normalizeNullable(input.tenantId),
    budgetReservationId: input.budgetReservationId ?? null,
    budgetEnvelope: input.budgetEnvelope ?? null,
    createdAt: input.createdAt ?? nowIso(),
  };
}

function assertRequired(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, "Delegation request field is required.");
  }
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value == null || value.trim().length === 0 ? null : value;
}
