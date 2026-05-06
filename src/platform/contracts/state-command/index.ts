import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior } from "../executable-contracts/index.js";

// Runtime warning for imports from legacy contract path
console.warn(
  "[DEPRECATED] StateCommand from state-command/ is deprecated. " +
  "Use inter-plane commands (EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand) " +
  "from src/platform/contracts/executable-contracts instead. " +
  "See: https://docs.example.com/platform/contracts#state-command-migration",
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
  readonly expectedVersion?: number | null;
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
    const aggregateId = requireNonEmpty(
      input.aggregateId,
      "platform_contracts.state_command_aggregate_id_required",
      "aggregateId is required.",
    );
    const traceId = requireNonEmpty(
      input.traceId,
      "platform_contracts.state_command_trace_id_required",
      "traceId is required.",
    );
    const type = input.type;
    const emittedBy = input.emittedBy?.trim().length
      ? input.emittedBy
      : input.principal.actorId
        ?? input.principal.principalId
        ?? "unknown";

    return {
      commandId: input.commandId ?? newId("statecmd"),
      traceId,
      principal: input.principal,
      ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
      fencingToken: requireNonEmpty(
        input.fencingToken,
        "platform_contracts.state_command_fencing_token_required",
        "fencingToken is required.",
      ),
      ...(input.event != null ? { event: input.event } : {}),
      entityKind: input.aggregateType ?? "aggregate",
      entityId: aggregateId,
      action: normalizeAction(type),
      type,
      aggregateId,
      expectedVersion: input.expectedVersion ?? null,
      payload: structuredClone(input.payload),
      emittedBy,
      createdAt: input.createdAt ?? nowIso(),
    };
  }

  const entityKind = requireNonEmpty(
    input.entityKind,
    "platform_contracts.state_command_entity_kind_required",
    "entityKind is required.",
  );
  const entityId = requireNonEmpty(
    input.entityId,
    "platform_contracts.state_command_entity_id_required",
    "entityId is required.",
  );
  const emittedBy = requireNonEmpty(
    input.emittedBy,
    "platform_contracts.state_command_emitted_by_required",
    "emittedBy is required.",
  );

  if (input.action === "transition") {
    const nextStatus = (input.payload as { nextStatus?: unknown }).nextStatus;
    if (typeof nextStatus !== "string" || nextStatus.trim().length === 0) {
      throw new ValidationError(
        "platform_contracts.state_command_transition_next_status_required",
        "Transition commands require payload.nextStatus.",
      );
    }
  }

  return {
    commandId: input.commandId ?? newId("statecmd"),
    entityKind,
    entityId,
    action: input.action,
    expectedVersion: input.expectedVersion ?? null,
    payload: structuredClone(input.payload),
    emittedBy,
    createdAt: input.createdAt ?? nowIso(),
  };
}

// =============================================================================
// Re-exports from executable-contracts (canonical per §5.3)
// =============================================================================

export type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior };
