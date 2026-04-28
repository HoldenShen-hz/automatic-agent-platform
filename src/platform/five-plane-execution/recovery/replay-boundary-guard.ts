export type ReplayMode = "trace_replay" | "reexecution_replay";

export interface ReplayOperation {
  readonly operationId: string;
  readonly resourceKind: "tool" | "llm" | "connector" | "projection";
  readonly hasRealSideEffect: boolean;
  readonly tombstoneReplay: boolean;
}

export interface ReplayBoundaryDecision {
  readonly allowed: boolean;
  readonly reasonCode:
    | "replay.allowed"
    | "replay.real_side_effect_blocked"
    | "replay.tombstone_boundary_violation";
  readonly blockedOperationIds: readonly string[];
}

export class ReplayBoundaryGuard {
  public evaluate(mode: ReplayMode, operations: readonly ReplayOperation[]): ReplayBoundaryDecision {
    const realSideEffectIds = operations
      .filter((operation) => mode === "trace_replay" && operation.hasRealSideEffect)
      .map((operation) => operation.operationId);
    if (realSideEffectIds.length > 0) {
      return {
        allowed: false,
        reasonCode: "replay.real_side_effect_blocked",
        blockedOperationIds: realSideEffectIds,
      };
    }

    const tombstoneViolations = operations
      .filter((operation) => operation.tombstoneReplay && operation.resourceKind !== "projection")
      .map((operation) => operation.operationId);
    if (tombstoneViolations.length > 0) {
      return {
        allowed: false,
        reasonCode: "replay.tombstone_boundary_violation",
        blockedOperationIds: tombstoneViolations,
      };
    }

    return { allowed: true, reasonCode: "replay.allowed", blockedOperationIds: [] };
  }
}
