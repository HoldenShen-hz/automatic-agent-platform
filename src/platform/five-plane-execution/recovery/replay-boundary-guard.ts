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
    // Replay modes must not trigger real side effects. Projection replay is the
    // only exception, and only for projection resources.
    const realSideEffectIds = operations
      .filter((operation) => {
        if (!operation.hasRealSideEffect) {
          return false;
        }
        return mode !== "projection_replay" || operation.resourceKind !== "projection";
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
