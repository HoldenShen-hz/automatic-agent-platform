export type ReplayMode = "trace_replay" | "reexecution_replay" | "projection_replay";

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
    // trace_replay: blocks operations with real side effects
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

    // reexecution_replay: allows real side effects, blocks tombstone violations on non-projection resources
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

    // projection_replay: allows all operations including real side effects and tombstones,
    // as it only projects/replays the trace without actual side effects
    if (mode === "projection_replay") {
      return { allowed: true, reasonCode: "replay.allowed", blockedOperationIds: [] };
    }

    return { allowed: true, reasonCode: "replay.allowed", blockedOperationIds: [] };
  }
}
