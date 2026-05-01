import { ValidationError } from "../errors.js";
import type {
  PrincipalRef,
  PlatformFactEvent,
  EventAppendCommand,
  AuditAppendCommand,
  ArtifactWriteCommand,
  EventReplayBehavior,
} from "../executable-contracts/index.js";

// Runtime warning for imports from legacy contract path
console.warn(
  "[DEPRECATED] StateCommand from state-command/ is deprecated. " +
  "Use inter-plane commands (EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand) " +
  "from src/platform/contracts/executable-contracts instead. " +
  "See: https://docs.example.com/platform/contracts#state-command-migration",
);

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
  readonly event: PlatformFactEvent;
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
  void input.commandId;
  void input.createdAt;
  throw new ValidationError(
    "state_command.legacy_contract_forbidden",
    "StateCommand is deprecated. Use canonical contracts from executable-contracts instead.",
  );
}

// =============================================================================
// Re-exports from executable-contracts (canonical per §5.3)
// =============================================================================

export type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior };
