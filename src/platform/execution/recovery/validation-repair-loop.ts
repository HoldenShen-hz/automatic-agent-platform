export type ValidationLoopStage =
  | "planned"
  | "built"
  | "review_failed"
  | "validation_failed"
  | "failed_repairable"
  | "failed_blocking"
  | "escalated"
  | "released"
  | "rolled_back";

export interface ValidationFailureRecord {
  check: string;
  details: string;
}

export interface RepairEvidencePackage {
  taskId: string;
  failedChecks: ValidationFailureRecord[];
  changedFiles: string[];
  allowedFixScope: string[];
  forbiddenScope: string[];
  maxDiffLines: number;
  repairRound: number;
}

export interface ValidationDecision {
  stage: ValidationLoopStage;
  reasonCode: string;
  requiresRepair: boolean;
  requiresEscalation: boolean;
}

export interface ValidationLoopInput {
  taskId: string;
  reviewPassed: boolean;
  validationPassed: boolean;
  failedChecks: readonly ValidationFailureRecord[];
  changedFiles: readonly string[];
  allowedFixScope: readonly string[];
  forbiddenScope: readonly string[];
  maxDiffLines: number;
  repairRound: number;
  maxRepairRounds: number;
  touchedForbiddenScope?: boolean;
}

export class ValidationRepairLoopService {
  public buildRepairEvidencePackage(input: ValidationLoopInput): RepairEvidencePackage {
    return {
      taskId: input.taskId,
      failedChecks: [...input.failedChecks],
      changedFiles: [...input.changedFiles],
      allowedFixScope: [...input.allowedFixScope],
      forbiddenScope: [...input.forbiddenScope],
      maxDiffLines: input.maxDiffLines,
      repairRound: input.repairRound,
    };
  }

  public decide(input: ValidationLoopInput): ValidationDecision {
    if (input.touchedForbiddenScope === true) {
      return {
        stage: "failed_blocking",
        reasonCode: "validation.forbidden_scope_touched",
        requiresRepair: false,
        requiresEscalation: true,
      };
    }

    if (!input.reviewPassed) {
      return {
        stage: input.repairRound >= input.maxRepairRounds ? "escalated" : "failed_repairable",
        reasonCode: "validation.review_failed",
        requiresRepair: input.repairRound < input.maxRepairRounds,
        requiresEscalation: input.repairRound >= input.maxRepairRounds,
      };
    }

    if (!input.validationPassed) {
      return {
        stage: input.repairRound >= input.maxRepairRounds ? "escalated" : "failed_repairable",
        reasonCode: "validation.checks_failed",
        requiresRepair: input.repairRound < input.maxRepairRounds,
        requiresEscalation: input.repairRound >= input.maxRepairRounds,
      };
    }

    return {
      stage: "released",
      reasonCode: "validation.released",
      requiresRepair: false,
      requiresEscalation: false,
    };
  }
}
