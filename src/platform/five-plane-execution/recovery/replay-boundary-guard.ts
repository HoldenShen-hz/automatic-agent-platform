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
    // trace_replay blocks real side effects; projection_replay allows them only for projections.
    const realSideEffectIds = operations
      .filter((operation) => {
        if (!operation.hasRealSideEffect) {
          return false;
        }
        if (mode === "trace_replay") {
          return true;
        }
        if (mode === "projection_replay") {
          return operation.resourceKind !== "projection";
        }
        return false;
      })
      .map((operation) => operation.operationId);
    if (realSideEffectIds.length > 0) {
      return {
        allowed: false,
        reasonCode: "replay.real_side_effect_blocked",
        blockedOperationIds: realSideEffectIds,
      };
    }

    // reexecution_replay allows tombstone only for projection resources.
    const tombstoneViolations = operations
      .filter((operation) => operation.tombstoneReplay && (mode !== "reexecution_replay" || operation.resourceKind !== "projection"))
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
