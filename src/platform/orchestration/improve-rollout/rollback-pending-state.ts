export type ImprovementReleaseState = "released" | "rollback_pending" | "rolled_back";

export interface ImprovementRollbackReceipt {
  readonly improvementId: string;
  readonly fromState: ImprovementReleaseState;
  readonly toState: ImprovementReleaseState;
  readonly postmortemRequired: boolean;
  readonly reasonCode: "improvement.rollback_pending" | "improvement.rolled_back";
}

export class ImprovementRollbackStateMachine {
  public requestRollback(improvementId: string, state: ImprovementReleaseState): ImprovementRollbackReceipt {
    if (state !== "released") {
      throw new Error(`improvement.rollback_requires_released:${improvementId}`);
    }
    return {
      improvementId,
      fromState: state,
      toState: "rollback_pending",
      postmortemRequired: true,
      reasonCode: "improvement.rollback_pending",
    };
  }

  public completeRollback(improvementId: string, state: ImprovementReleaseState): ImprovementRollbackReceipt {
    if (state !== "rollback_pending") {
      throw new Error(`improvement.rollback_complete_requires_pending:${improvementId}`);
    }
    return {
      improvementId,
      fromState: state,
      toState: "rolled_back",
      postmortemRequired: true,
      reasonCode: "improvement.rolled_back",
    };
  }
}
