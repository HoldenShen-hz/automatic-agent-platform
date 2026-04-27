export interface ChineseWallAccessStep {
  readonly stepId: string;
  readonly action: "prepare_grant" | "commit_grant" | "prepare_release" | "commit_release" | "audit";
  readonly succeeded: boolean;
}

export interface ChineseWallAccessSagaReceipt {
  readonly accessId: string;
  readonly status: "committed" | "rolled_back";
  readonly committedActions: readonly ChineseWallAccessStep["action"][];
  readonly rollbackRequired: boolean;
}

export class ChineseWallAccessSaga {
  public execute(accessId: string, steps: readonly ChineseWallAccessStep[]): ChineseWallAccessSagaReceipt {
    const failed = steps.some((step) => !step.succeeded);
    return {
      accessId,
      status: failed ? "rolled_back" : "committed",
      committedActions: failed ? [] : steps.map((step) => step.action),
      rollbackRequired: failed,
    };
  }
}
