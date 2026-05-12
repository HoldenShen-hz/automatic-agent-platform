import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

/**
 * @deprecated ControlDirective is deprecated per §4.3. Use OperationalDirective or DecisionDirective instead.
 * This type is retained for legacy adapter compatibility only.
 * NOTE: This type should NOT be used in new code. The factory createControlDirective always throws.
 */
export interface ControlDirective {
  directiveId: string;
  kind: ControlDirectiveKind;
  targetRef: string;
  reasonCode: string;
  issuedBy: string;
  tenantId: string | null;
  executionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * @deprecated ControlDirectiveKind is deprecated per §4.3. Use OperationalDirective or DecisionDirective instead.
 */
export type ControlDirectiveKind = "pause" | "resume" | "cancel" | "rollback" | "escalate";

// =============================================================================
// Canonical Directive Types (P2 → P3/P4 per §4.3)
// =============================================================================

/**
 * OperationalDirective - P2 sends to P3/P4 for runtime control operations.
 * Used for mode switches, pause, resume, quota adjustments, and emergency kill.
 * Canonical replacement for legacy ControlDirective.
 */
export type OperationalDirectiveType =
  | "mode_switch"
  | "pause"
  | "resume"
  | "quota_adjust"
  | "kill"
  | "rollback";

export interface OperationalDirectiveScope {
  readonly tenantId?: string;
  readonly harnessRunId?: string;
  readonly nodeRunId?: string;
  readonly workerId?: string;
}

export interface OperationalDirective<TParams extends Record<string, unknown> = Record<string, unknown>> {
  readonly operationalDirectiveId: string;
  readonly type: OperationalDirectiveType;
  readonly scope: OperationalDirectiveScope;
  readonly issuedBy: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
  };
  readonly reason: string;
  readonly params: TParams;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

/**
 * DecisionDirective - P2 sends to P3/P4 for business/approval decisions.
 * Used for approve, deny, override, patch, takeover, and expire_approval.
 */
export type DecisionDirectiveType =
  | "approve"
  | "deny"
  | "override"
  | "patch"
  | "takeover"
  | "expire_approval";

export interface DecisionDirectiveScope {
  readonly tenantId?: string | undefined;
  readonly harnessRunId?: string | undefined;
  readonly nodeRunId?: string | undefined;
  readonly humanResponsibilityRecordId?: string | undefined;
}

export interface DecisionDirective<TPayload = unknown> {
  readonly decisionDirectiveId: string;
  readonly type: DecisionDirectiveType;
  readonly scope: DecisionDirectiveScope;
  readonly issuedBy: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
    readonly displayName?: string;
  };
  readonly targetRef: string;
  readonly payload: TPayload;
  readonly reason: string;
  readonly riskAcknowledged: boolean;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createOperationalDirective<TParams extends Record<string, unknown>>(input: {
  type: OperationalDirectiveType;
  scope?: OperationalDirectiveScope;
  issuedBy: OperationalDirective["issuedBy"];
  reason: string;
  params?: TParams;
  operationalDirectiveId?: string;
  createdAt?: string;
  expiresAt?: string;
}): OperationalDirective<TParams> {
  requireNonEmpty(input.type, "operational_directive.type_required");
  return {
    operationalDirectiveId: input.operationalDirectiveId ?? newId("opdir"),
    type: input.type,
    scope: input.scope ?? {},
    issuedBy: input.issuedBy,
    reason: input.reason,
    params: (input.params ?? {}) as TParams,
    createdAt: input.createdAt ?? nowIso(),
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
  };
}

export function createDecisionDirective<TPayload = unknown>(input: {
  type: DecisionDirectiveType;
  scope?: DecisionDirectiveScope;
  issuedBy: DecisionDirective["issuedBy"];
  targetRef: string;
  payload: TPayload;
  reason: string;
  riskAcknowledged?: boolean;
  decisionDirectiveId?: string;
  createdAt?: string;
  expiresAt?: string;
}): DecisionDirective<TPayload> {
  requireNonEmpty(input.type, "decision_directive.type_required");
  requireNonEmpty(input.targetRef, "decision_directive.target_ref_required");
  return {
    decisionDirectiveId: input.decisionDirectiveId ?? newId("decDir"),
    type: input.type,
    scope: input.scope ?? {},
    issuedBy: input.issuedBy,
    targetRef: input.targetRef,
    payload: input.payload,
    reason: input.reason,
    riskAcknowledged: input.riskAcknowledged ?? false,
    createdAt: input.createdAt ?? nowIso(),
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
  };
}

function requireNonEmpty(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, "Required string cannot be empty.");
  }
}

// =============================================================================
// Legacy Factory - Fail-Fast Enforcement (R4-1)
// =============================================================================

/**
 * @deprecated ControlDirective is deprecated per §4.3. Use OperationalDirective or DecisionDirective instead.
 * This factory exists only for backward compatibility and always throws.
 * @throws {ValidationError} Always throws with code "platform_contracts.legacy_control_directive_forbidden"
 */
export function createControlDirective(input: {
  directiveId?: string;
  kind: ControlDirectiveKind;
  targetRef: string;
  reasonCode: string;
  issuedBy: string;
  tenantId: string | null;
  executionId: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): never {
  requireNonEmpty(input.targetRef, "control_directive.target_ref_required");
  requireNonEmpty(input.reasonCode, "control_directive.reason_code_required");
  requireNonEmpty(input.issuedBy, "control_directive.issued_by_required");
  throw new ValidationError(
    "control_directive.legacy_contract_forbidden",
    `ControlDirective is deprecated per §4.3. Use OperationalDirective or DecisionDirective instead. ` +
    `See: https://docs.example.com/platform/contracts#control-directive-migration`,
    { userMessage: "Legacy ControlDirective contract is forbidden. Use OperationalDirective or DecisionDirective." },
  );
}
