import { UnimplementedError, ValidationError } from "../errors.js";
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
  _input: SimpleStateCommandInput<TPayload> | CompatibilityStateCommandInput<TPayload>,
): StateCommand<TPayload> {
  // R16-79: StateCommand is deprecated - throw UnimplementedError
  throw new UnimplementedError("DEPRECATED_STATE_COMMAND", "createStateCommand is no longer supported. StateCommand is deprecated. Use canonical contracts from executable-contracts instead.");
}

// =============================================================================
// Re-exports from executable-contracts (canonical per §5.3)
// =============================================================================

export type { EventAppendCommand, AuditAppendCommand, ArtifactWriteCommand, EventReplayBehavior };
