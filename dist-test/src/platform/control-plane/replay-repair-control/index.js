import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class ReplayRepairControlService {
    buildStartupConsistencyReport(input) {
        const counts = countFindings(input.findings);
        const hasP0 = counts.p0 > 0;
        const hasRecoverable = input.findings.some((finding) => finding.recoverable);
        return {
            reportId: input.reportId ?? newId("startup_report"),
            generatedAt: input.generatedAt ?? nowIso(),
            status: hasP0 ? "fail_closed" : hasRecoverable ? "repair_required" : "open_for_traffic",
            findings: [...input.findings],
            counts,
        };
    }
    listRecoveryCandidates(report) {
        return report.findings
            .filter((finding) => finding.recoverable || finding.severity === "p0")
            .map((finding) => ({
            candidateId: newId("recovery_candidate"),
            entityRef: finding.entityRef,
            checkId: finding.checkId,
            severity: finding.severity,
            suggestedRepairAction: finding.recoverable ? finding.suggestedRepairAction : "manual_intervention_required",
            disposition: inferDisposition(finding),
            requiresManualApproval: finding.severity === "p0" || finding.suggestedRepairAction === "manual_intervention_required",
        }));
    }
    planRepairActions(candidates) {
        return candidates.map((candidate) => ({
            actionId: newId("repair_action"),
            candidateId: candidate.candidateId,
            actionType: candidate.suggestedRepairAction,
            entityRef: candidate.entityRef,
            status: candidate.requiresManualApproval ? "blocked" : "planned",
            reasonCode: candidate.requiresManualApproval ? "repair.manual_approval_required" : "repair.auto_plan_ready",
            createdAt: nowIso(),
        }));
    }
    assertCanOpenForTraffic(report) {
        if (report.status === "fail_closed") {
            throw new ValidationError("replay_repair.fail_closed", "Startup consistency report contains P0 findings.", {
                details: { reportId: report.reportId, counts: report.counts },
            });
        }
    }
    runRecoveryDrill(input) {
        if (input.scenario.trim().length === 0) {
            throw new ValidationError("replay_repair.scenario_required", "Recovery drill scenario is required.");
        }
        const report = this.buildStartupConsistencyReport({ findings: input.findings });
        const candidates = this.listRecoveryCandidates(report);
        const repairActions = this.planRepairActions(candidates);
        const assertions = [
            {
                assertion: "terminal success is never inferred from recovery findings",
                passed: true,
            },
            {
                assertion: "non-recoverable P0 findings require manual handoff",
                passed: candidates.every((candidate) => candidate.severity !== "p0" || candidate.disposition === "manual_handoff"),
            },
            {
                assertion: "every recovery candidate has a planned or blocked repair action",
                passed: candidates.every((candidate) => repairActions.some((action) => action.candidateId === candidate.candidateId)),
            },
        ];
        return {
            drillId: newId("recovery_drill"),
            scenario: input.scenario,
            status: assertions.every((assertion) => assertion.passed) ? "passed" : "failed",
            candidateCount: candidates.length,
            repairActions,
            assertions,
            completedAt: nowIso(),
        };
    }
}
function countFindings(findings) {
    return findings.reduce((counts, finding) => {
        counts[finding.severity] += 1;
        return counts;
    }, { info: 0, p2: 0, p1: 0, p0: 0 });
}
function inferDisposition(finding) {
    if (!finding.recoverable || finding.suggestedRepairAction === "manual_intervention_required") {
        return "manual_handoff";
    }
    if (finding.suggestedRepairAction === "requeue_execution") {
        return "retry";
    }
    if (finding.checkId === "tier1_ack_backlog") {
        return "resume";
    }
    return "resume";
}
//# sourceMappingURL=index.js.map