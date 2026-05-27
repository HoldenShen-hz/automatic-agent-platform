import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior } from "../executable-contracts/index.js";

// Runtime warning for imports from legacy contract path
process.emitWarning(
  "[DEPRECATED] StateCommand from state-command/ is deprecated. " +
  "Use inter-plane commands (EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand) " +
  "from src/platform/contracts/executable-contracts instead. " +
  "See: docs_zh/contracts/README.md",
  { code: "AA_LEGACY_STATE_COMMAND" },
);

export type StateCommandAction = "upsert" | "transition" | "append_event" | "delete";
export type LegacyStateCommandType = "update_truth" | "append_event" | "write_checkpoint" | "store_artifact";

interface PlatformPrincipalLike {
  readonly actorId?: string;
  readonly principalId?: string;
  readonly tenantId?: string | null;
  readonly roles?: readonly string[];
}

/**
 * @deprecated StateCommand from state-command/ is a legacy contract.
 * Use canonical contracts from executable-contracts instead.
 * The inter-plane commands (EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand)
 * are defined in executable-contracts.
 */
export interface StateCommand<TPayload = unknown> {
  readonly commandId: string;
  readonly traceId?: string;
  readonly principal?: PlatformPrincipalLike;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly event?: string;
  readonly entityKind: string;
  readonly entityId: string;
  readonly action: StateCommandAction;
  readonly type?: LegacyStateCommandType;
  readonly aggregateId?: string;
  readonly expectedVersion: number | null;
  readonly expectedStatus?: string | null;
  readonly payload: TPayload;
  readonly emittedBy: string;
  readonly createdAt: string;
}

/**
 * @deprecated Use canonical contracts from executable-contracts instead.
 */
type SimpleStateCommandInput<TPayload> = {
  readonly entityKind: string;
  readonly entityId: string;
  readonly action: StateCommandAction;
  readonly traceId?: string;
  readonly principal?: PlatformPrincipalLike;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly event?: string;
  readonly expectedVersion?: number | null;
  readonly expectedStatus?: string | null;
  readonly payload: TPayload;
  readonly emittedBy: string;
  readonly commandId?: string;
  readonly createdAt?: string;
};

type CompatibilityStateCommandInput<TPayload> = {
  readonly traceId: string;
  readonly principal: PlatformPrincipalLike;
  readonly leaseId?: string;
  readonly fencingToken: string;
  readonly event?: string;
  readonly type: LegacyStateCommandType;
  readonly aggregateId: string;
  readonly aggregateType?: string;
  readonly expectedVersion?: number | null;
  readonly expectedStatus?: string | null;
  readonly payload: TPayload;
  readonly emittedBy?: string;
  readonly commandId?: string;
  readonly createdAt?: string;
};

function isCompatibilityInput<TPayload>(
  input: SimpleStateCommandInput<TPayload> | CompatibilityStateCommandInput<TPayload>,
): input is CompatibilityStateCommandInput<TPayload> {
  return "traceId" in input || "type" in input || "aggregateId" in input;
}

function requireNonEmpty(value: string | undefined, code: string, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(code, message);
  }
  return value;
}

function normalizeAction(type: LegacyStateCommandType): StateCommandAction {
  switch (type) {
    case "append_event":
      return "append_event";
    case "update_truth":
      return "upsert";
    case "write_checkpoint":
      return "transition";
    case "store_artifact":
      return "upsert";
  }
}

export function createStateCommand<TPayload>(
  input: SimpleStateCommandInput<TPayload> | CompatibilityStateCommandInput<TPayload>,
): StateCommand<TPayload> {
  if (isCompatibilityInput(input)) {
    const entityId = requireNonEmpty(
      input.aggregateId,
      "state_command.aggregate_id_required",
      "State command requires a non-empty aggregateId.",
    );
    const type = input.type;
    const action = normalizeAction(type);
    return {
      commandId: input.commandId ?? newId("statecmd"),
      ...(input.traceId != null ? { traceId: input.traceId } : {}),
      ...(input.principal != null ? { principal: input.principal } : {}),
      ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
      ...(input.fencingToken != null ? { fencingToken: input.fencingToken } : {}),
      ...(input.event != null ? { event: input.event } : {}),
      entityKind: input.aggregateType ?? "aggregate",
      entityId,
      action,
      ...(type != null ? { type } : {}),
      ...(entityId != null ? { aggregateId: entityId } : {}),
      expectedVersion: input.expectedVersion ?? null,
      ...(input.expectedStatus !== undefined ? { expectedStatus: input.expectedStatus ?? null } : {}),
      payload: clonePayload(input.payload),
      emittedBy: input.emittedBy ?? input.principal.actorId ?? input.principal.principalId ?? "system",
      createdAt: input.createdAt ?? nowIso(),
    };
  }

  const entityKind = requireNonEmpty(
    input.entityKind,
    "state_command.entity_kind_required",
    "State command requires a non-empty entityKind.",
  );
  const entityId = requireNonEmpty(
    input.entityId,
    "state_command.entity_id_required",
    "State command requires a non-empty entityId.",
  );
  const emittedBy = requireNonEmpty(
    input.emittedBy,
    "state_command.emitted_by_required",
    "State command requires a non-empty emittedBy.",
  );
  if (input.action === "transition") {
    const nextStatus = (input.payload as { nextStatus?: string } | null | undefined)?.nextStatus;
    if (typeof nextStatus !== "string" || nextStatus.trim().length === 0) {
      throw new ValidationError(
        "state_command.transition_next_status_required",
        "Transition state commands require payload.nextStatus.",
      );
    }
  }
  return {
    commandId: input.commandId ?? newId("statecmd"),
    ...(input.traceId != null ? { traceId: input.traceId } : {}),
    ...(input.principal != null ? { principal: input.principal } : {}),
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    ...(input.fencingToken != null ? { fencingToken: input.fencingToken } : {}),
    ...(input.event != null ? { event: input.event } : {}),
    entityKind,
    entityId,
    action: input.action,
    expectedVersion: input.expectedVersion ?? null,
    ...(input.expectedStatus !== undefined ? { expectedStatus: input.expectedStatus ?? null } : {}),
    payload: clonePayload(input.payload),
    emittedBy,
    createdAt: input.createdAt ?? nowIso(),
  };
}

function clonePayload<TPayload>(payload: TPayload): TPayload {
  if (payload == null || typeof payload !== "object") {
    return payload;
  }
  if (Array.isArray(payload)) {
    return [...payload] as TPayload;
  }
  return { ...(payload as Record<string, unknown>) } as TPayload;
}

// =============================================================================
// Re-exports from executable-contracts (canonical per §5.3)
// =============================================================================

export type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior };
