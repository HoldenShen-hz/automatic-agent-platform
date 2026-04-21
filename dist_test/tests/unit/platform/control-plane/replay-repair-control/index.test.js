import assert from "node:assert/strict";
import test from "node:test";
import { ReplayRepairControlService } from "../../../../../src/platform/control-plane/replay-repair-control/index.js";
test("ReplayRepairControlService marks P0 findings as fail-closed and blocks traffic", () => {
    const service = new ReplayRepairControlService();
    const report = service.buildStartupConsistencyReport({
        findings: [
            {
                checkId: "execution_owner_conflict",
                severity: "p0",
                entityRef: "task:1",
                summary: "two active executions",
                recoverable: false,
                suggestedRepairAction: "manual_intervention_required",
            },
        ],
    });
    assert.equal(report.status, "fail_closed");
    assert.throws(() => service.assertCanOpenForTraffic(report), (error) => error instanceof Error && "code" in error && error.code === "replay_repair.fail_closed");
});
test("ReplayRepairControlService creates blocked repair plans for manual recovery candidates", () => {
    const service = new ReplayRepairControlService();
    const report = service.buildStartupConsistencyReport({
        findings: [
            {
                checkId: "stale_execution",
                severity: "p1",
                entityRef: "execution:1",
                summary: "heartbeat expired",
                recoverable: true,
                suggestedRepairAction: "requeue_execution",
            },
            {
                checkId: "execution_owner_conflict",
                severity: "p0",
                entityRef: "task:1",
                summary: "two active executions",
                recoverable: false,
                suggestedRepairAction: "manual_intervention_required",
            },
        ],
    });
    const candidates = service.listRecoveryCandidates(report);
    const plan = service.planRepairActions(candidates);
    assert.equal(candidates.length, 2);
    assert.ok(plan.some((action) => action.status === "blocked"));
    assert.ok(plan.some((action) => action.actionType === "requeue_execution"));
});
test("ReplayRepairControlService runs a recovery drill with explicit assertions", () => {
    const service = new ReplayRepairControlService();
    const result = service.runRecoveryDrill({
        scenario: "crash before ack rebuild",
        findings: [
            {
                checkId: "tier1_ack_backlog",
                severity: "p1",
                entityRef: "event:1",
                summary: "tier1 ack backlog",
                recoverable: true,
                suggestedRepairAction: "rebuild_ack",
            },
        ],
    });
    assert.equal(result.status, "passed");
    assert.equal(result.assertions.every((assertion) => assertion.passed), true);
});
//# sourceMappingURL=index.test.js.map