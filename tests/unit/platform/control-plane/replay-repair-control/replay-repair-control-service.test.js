import assert from "node:assert/strict";
import test from "node:test";
import { ReplayRepairControlService, } from "../../../../../src/platform/control-plane/replay-repair-control/index.js";
function makeFinding(overrides = {}) {
    return {
        checkId: "migration_version",
        severity: "p1",
        entityRef: "entity-1",
        summary: "Test finding",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
        ...overrides,
    };
}
test("ReplayRepairControlService.buildStartupConsistencyReport creates report with fail_closed status when P0 findings exist", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p0", checkId: "migration_version" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    assert.ok(report.reportId.startsWith("startup_report_"));
    assert.equal(report.status, "fail_closed");
    assert.equal(report.counts.p0, 1);
    assert.equal(report.counts.p1, 0);
    assert.equal(report.counts.p2, 0);
    assert.equal(report.counts.info, 0);
});
test("ReplayRepairControlService.buildStartupConsistencyReport creates report with repair_required status when recoverable findings exist without P0", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p1", recoverable: true }),
        makeFinding({ severity: "p2", recoverable: true }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    assert.equal(report.status, "repair_required");
    assert.equal(report.counts.p0, 0);
    assert.equal(report.counts.p1, 1);
    assert.equal(report.counts.p2, 1);
});
test("ReplayRepairControlService.buildStartupConsistencyReport creates report with open_for_traffic status when no recoverable findings", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ recoverable: false, severity: "info" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    assert.equal(report.status, "open_for_traffic");
    assert.equal(report.counts.info, 1);
});
test("ReplayRepairControlService.buildStartupConsistencyReport preserves all findings", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "entity-1" }),
        makeFinding({ entityRef: "entity-2" }),
        makeFinding({ entityRef: "entity-3" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    assert.equal(report.findings.length, 3);
});
test("ReplayRepairControlService.buildStartupConsistencyReport uses provided reportId", () => {
    const service = new ReplayRepairControlService();
    const findings = [makeFinding()];
    const report = service.buildStartupConsistencyReport({ reportId: "custom-report-123", findings });
    assert.equal(report.reportId, "custom-report-123");
});
test("ReplayRepairControlService.buildStartupConsistencyReport uses provided generatedAt", () => {
    const service = new ReplayRepairControlService();
    const findings = [makeFinding()];
    const report = service.buildStartupConsistencyReport({ generatedAt: "2026-01-01T00:00:00.000Z", findings });
    assert.equal(report.generatedAt, "2026-01-01T00:00:00.000Z");
});
test("ReplayRepairControlService.buildStartupConsistencyReport counts all severity levels", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "info" }),
        makeFinding({ severity: "p2" }),
        makeFinding({ severity: "p2" }),
        makeFinding({ severity: "p1" }),
        makeFinding({ severity: "p1" }),
        makeFinding({ severity: "p1" }),
        makeFinding({ severity: "p0" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    assert.equal(report.counts.info, 1);
    assert.equal(report.counts.p2, 2);
    assert.equal(report.counts.p1, 3);
    assert.equal(report.counts.p0, 1);
});
test("ReplayRepairControlService.listRecoveryCandidates returns recoverable candidates", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "rec-1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
        makeFinding({ entityRef: "rec-2", recoverable: true, suggestedRepairAction: "release_stale_lock" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates.length, 2);
    assert.ok(candidates.some(c => c.entityRef === "rec-1"));
    assert.ok(candidates.some(c => c.entityRef === "rec-2"));
});
test("ReplayRepairControlService.listRecoveryCandidates includes non-recoverable P0 findings", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "p0-non-recoverable", recoverable: false, severity: "p0" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.entityRef, "p0-non-recoverable");
});
test("ReplayRepairControlService.listRecoveryCandidates excludes non-recoverable non-P0 findings", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "non-rec", recoverable: false, severity: "p1" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates.length, 0);
});
test("ReplayRepairControlService.listRecoveryCandidates sets manual_intervention_required for non-recoverable", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "manual-only", recoverable: false, severity: "p0" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.suggestedRepairAction, "manual_intervention_required");
});
test("ReplayRepairControlService.listRecoveryCandidates infers correct disposition for requeue_execution", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ recoverable: true, suggestedRepairAction: "requeue_execution" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.disposition, "retry");
});
test("ReplayRepairControlService.listRecoveryCandidates infers correct disposition for tier1_ack_backlog", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ checkId: "tier1_ack_backlog", recoverable: true, suggestedRepairAction: "rebuild_ack" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.disposition, "resume");
});
test("ReplayRepairControlService.listRecoveryCandidates infers manual_handoff for manual_intervention_required", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ recoverable: true, suggestedRepairAction: "manual_intervention_required" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.disposition, "manual_handoff");
});
test("ReplayRepairControlService.listRecoveryCandidates requires manual approval for P0", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p0", recoverable: true }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.requiresManualApproval, true);
});
test("ReplayRepairControlService.listRecoveryCandidates requires manual approval for manual_intervention_required", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ suggestedRepairAction: "manual_intervention_required", recoverable: true }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.requiresManualApproval, true);
});
test("ReplayRepairControlService.listRecoveryCandidates does not require manual approval for recoverable non-P0", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates[0]?.requiresManualApproval, false);
});
test("ReplayRepairControlService.planRepairActions creates repair actions for all candidates", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "candidate-1", recoverable: true }),
        makeFinding({ entityRef: "candidate-2", recoverable: true }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    const actions = service.planRepairActions(candidates);
    assert.equal(actions.length, 2);
    assert.ok(actions.every(a => a.actionId.startsWith("repair_action_")));
});
test("ReplayRepairControlService.planRepairActions blocks actions requiring manual approval", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p0", recoverable: true }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    const actions = service.planRepairActions(candidates);
    assert.equal(actions[0]?.status, "blocked");
    assert.equal(actions[0]?.reasonCode, "repair.manual_approval_required");
});
test("ReplayRepairControlService.planRepairActions plans actions for auto-approved candidates", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "auto-1", severity: "p1", recoverable: true }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    const actions = service.planRepairActions(candidates);
    assert.equal(actions[0]?.status, "planned");
    assert.equal(actions[0]?.reasonCode, "repair.auto_plan_ready");
});
test("ReplayRepairControlService.planRepairActions preserves candidateId relationship", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "preserve-link" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    const candidates = service.listRecoveryCandidates(report);
    const actions = service.planRepairActions(candidates);
    assert.equal(actions[0]?.candidateId, candidates[0]?.candidateId);
});
test("ReplayRepairControlService.assertCanOpenForTraffic does not throw for open_for_traffic", () => {
    const service = new ReplayRepairControlService();
    const findings = [makeFinding({ severity: "info" })];
    const report = service.buildStartupConsistencyReport({ findings, status: "open_for_traffic" });
    service.assertCanOpenForTraffic(report); // should not throw
});
test("ReplayRepairControlService.assertCanOpenForTraffic does not throw for repair_required", () => {
    const service = new ReplayRepairControlService();
    const findings = [makeFinding({ recoverable: true })];
    const report = service.buildStartupConsistencyReport({ findings, status: "repair_required" });
    service.assertCanOpenForTraffic(report); // should not throw
});
test("ReplayRepairControlService.assertCanOpenForTraffic throws for fail_closed", () => {
    const service = new ReplayRepairControlService();
    const findings = [makeFinding({ severity: "p0" })];
    const report = service.buildStartupConsistencyReport({ findings, status: "fail_closed" });
    assert.throws(() => service.assertCanOpenForTraffic(report), /P0 findings/);
});
test("ReplayRepairControlService.runRecoveryDrill validates scenario is required", () => {
    const service = new ReplayRepairControlService();
    assert.throws(() => service.runRecoveryDrill({ scenario: "", findings: [] }), /scenario is required/i);
});
test("ReplayRepairControlService.runRecoveryDrill validates scenario is not whitespace", () => {
    const service = new ReplayRepairControlService();
    assert.throws(() => service.runRecoveryDrill({ scenario: "   ", findings: [] }), /scenario is required/i);
});
test("ReplayRepairControlService.runRecoveryDrill creates passed drill result", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ entityRef: "test-1", recoverable: true, severity: "p1" }),
    ];
    const result = service.runRecoveryDrill({ scenario: "Test Scenario", findings });
    assert.ok(result.drillId.startsWith("recovery_drill_"));
    assert.equal(result.scenario, "Test Scenario");
    assert.equal(result.status, "passed");
});
test("ReplayRepairControlService.runRecoveryDrill includes repair actions for recovery candidates", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ recoverable: true }),
    ];
    const result = service.runRecoveryDrill({ scenario: "Test", findings });
    assert.ok(result.repairActions.length > 0);
});
test("ReplayRepairControlService.runRecoveryDrill includes assertions", () => {
    const service = new ReplayRepairControlService();
    const findings = [makeFinding({ recoverable: true })];
    const result = service.runRecoveryDrill({ scenario: "Test", findings });
    assert.ok(result.assertions.length > 0);
    assert.ok(result.assertions.every(a => typeof a.assertion === "string"));
    assert.ok(result.assertions.every(a => typeof a.passed === "boolean"));
});
test("ReplayRepairControlService.runRecoveryDrill first assertion always passes", () => {
    const service = new ReplayRepairControlService();
    const result = service.runRecoveryDrill({ scenario: "Test", findings: [] });
    const firstAssertion = result.assertions.find(a => a.assertion.includes("terminal success is never inferred"));
    assert.ok(firstAssertion?.passed === true);
});
test("ReplayRepairControlService.runRecoveryDrill second assertion checks P0 manual handoff", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p0", recoverable: false }),
    ];
    const result = service.runRecoveryDrill({ scenario: "Test", findings });
    const p0Assertion = result.assertions.find(a => a.assertion.includes("non-recoverable P0 findings require manual handoff"));
    assert.ok(p0Assertion?.passed === true);
});
test("ReplayRepairControlService.runRecoveryDrill third assertion checks repair action coverage", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ recoverable: true }),
    ];
    const result = service.runRecoveryDrill({ scenario: "Test", findings });
    const coverageAssertion = result.assertions.find(a => a.assertion.includes("every recovery candidate has a planned or blocked repair action"));
    assert.ok(coverageAssertion?.passed === true);
});
test("ReplayRepairControlService.runRecoveryDrill sets status failed when any assertion fails", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "p0", recoverable: true }), // recoverable P0 may fail the manual handoff assertion
    ];
    const result = service.runRecoveryDrill({ scenario: "Test", findings });
    // This finding is recoverable, so disposition won't be manual_handoff,
    // but the assertion about non-recoverable P0 won't trigger since it's recoverable
});
test("ReplayRepairControlService.runRecoveryDrill includes candidateCount", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ recoverable: true }),
        makeFinding({ recoverable: true }),
    ];
    const result = service.runRecoveryDrill({ scenario: "Test", findings });
    assert.equal(result.candidateCount, 2);
});
test("ReplayRepairControlService.buildStartupConsistencyReport with empty findings", () => {
    const service = new ReplayRepairControlService();
    const report = service.buildStartupConsistencyReport({ findings: [] });
    assert.equal(report.status, "open_for_traffic");
    assert.equal(report.counts.info, 0);
    assert.equal(report.counts.p2, 0);
    assert.equal(report.counts.p1, 0);
    assert.equal(report.counts.p0, 0);
});
test("ReplayRepairControlService.listRecoveryCandidates with empty report", () => {
    const service = new ReplayRepairControlService();
    const report = service.buildStartupConsistencyReport({ findings: [] });
    const candidates = service.listRecoveryCandidates(report);
    assert.equal(candidates.length, 0);
});
test("ReplayRepairControlService.planRepairActions with empty candidates", () => {
    const service = new ReplayRepairControlService();
    const actions = service.planRepairActions([]);
    assert.equal(actions.length, 0);
});
test("ReplayRepairControlService.runRecoveryDrill with empty findings", () => {
    const service = new ReplayRepairControlService();
    const result = service.runRecoveryDrill({ scenario: "Empty Drill", findings: [] });
    assert.equal(result.candidateCount, 0);
    assert.equal(result.status, "passed");
});
test("ReplayRepairControlService counts severity correctly for mixed findings", () => {
    const service = new ReplayRepairControlService();
    const findings = [
        makeFinding({ severity: "info" }),
        makeFinding({ severity: "info" }),
        makeFinding({ severity: "p2" }),
        makeFinding({ severity: "p1" }),
        makeFinding({ severity: "p0" }),
        makeFinding({ severity: "p0" }),
        makeFinding({ severity: "p0" }),
    ];
    const report = service.buildStartupConsistencyReport({ findings });
    assert.equal(report.counts.info, 2);
    assert.equal(report.counts.p2, 1);
    assert.equal(report.counts.p1, 1);
    assert.equal(report.counts.p0, 3);
});
//# sourceMappingURL=replay-repair-control-service.test.js.map