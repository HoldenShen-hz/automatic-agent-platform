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
  readonly compensatedActions: readonly ChineseWallAccessStep["action"][];
  readonly failedAction: ChineseWallAccessStep["action"] | null;
}

export class ChineseWallAccessSaga {
  public execute(accessId: string, steps: readonly ChineseWallAccessStep[]): ChineseWallAccessSagaReceipt {
    const committedActions: ChineseWallAccessStep["action"][] = [];
    let failedAction: ChineseWallAccessStep["action"] | null = null;

    for (const step of steps) {
      if (!step.succeeded) {
        failedAction = step.action;
        break;
      }
      if (step.action !== "audit") {
        committedActions.push(step.action);
      }
    }

    const failed = failedAction != null;
    const compensatedActions = failed
      ? [...committedActions]
        .reverse()
        .map((action) => action === "commit_grant"
          ? "prepare_release"
          : action === "prepare_grant"
            ? "commit_release"
            : action)
      : [];
    return {
      accessId,
      status: failed ? "rolled_back" : "committed",
      committedActions: failed ? [] : committedActions,
      rollbackRequired: failed,
      compensatedActions,
      failedAction,
    };
  }
}
