export class ValidationRepairLoopService {
    buildRepairEvidencePackage(input) {
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
    decide(input) {
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
//# sourceMappingURL=validation-repair-loop.js.map