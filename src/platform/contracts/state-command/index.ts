import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type {
  PrincipalRef,
  EventAppendCommand,
  AuditAppendCommand,
  ArtifactWriteCommand,
  EventReplayBehavior,
} from "../executable-contracts/index.js";

export type StateCommandAction = "upsert" | "transition" | "append_event" | "delete";

/**
 * @deprecated StateCommand from state-command/ is a legacy contract.
 * Use canonical contracts from executable-contracts instead.
 * The inter-plane commands (EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand)
 * are defined in executable-contracts.
 */
export interface StateCommand<TPayload = unknown> {
  readonly commandId: string;
  readonly traceId: string;
  readonly principal: PrincipalRef;
  readonly leaseId: string;
  readonly fencingToken: string;
  readonly event: string;
  readonly entityKind: string;
  readonly entityId: string;
  readonly action: StateCommandAction;
  readonly expectedVersion: number | null;
  readonly payload: TPayload;
  readonly emittedBy: string;
  readonly createdAt: string;
}

/**
 * @deprecated Use canonical contracts from executable-contracts instead.
 */
export function createStateCommand<TPayload>(input: Omit<StateCommand<TPayload>, "commandId" | "createdAt"> & {
  commandId?: string;
  createdAt?: string;
}): StateCommand<TPayload> {
  if (input.entityKind.trim().length === 0 || input.entityId.trim().length === 0 || input.emittedBy.trim().length === 0) {
    throw new ValidationError("state_command.required_fields_missing", "State command requires entity kind, entity id, and emitter.");
  }
  if (input.action === "transition" && typeof input.payload.nextStatus !== "string") {
    throw new ValidationError("state_command.next_status_required", "Transition commands require payload.nextStatus.");
  }
  return {
    commandId: input.commandId ?? newId("statecmd"),
    traceId: input.traceId,
    principal: input.principal,
    leaseId: input.leaseId,
    fencingToken: input.fencingToken,
    event: input.event,
    entityKind: input.entityKind,
    entityId: input.entityId,
    action: input.action,
    expectedVersion: input.expectedVersion ?? null,
    payload: { ...input.payload },
    emittedBy: input.emittedBy,
    createdAt: input.createdAt ?? nowIso(),
  };
}

// =============================================================================
// Re-exports from executable-contracts (canonical per §5.3)
// =============================================================================

export type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior };
