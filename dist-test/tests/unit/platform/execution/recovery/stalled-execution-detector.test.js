import assert from "node:assert/strict";
import test from "node:test";
import { StalledExecutionDetector, } from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";
// Mock store for testing
function createMockStore(records) {
    return {
        operations: {
            listActiveExecutionActivity: () => records,
        },
    };
}
test("StalledExecutionDetector.detect returns empty array when no active executions", () => {
    const store = createMockStore([]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect();
    assert.deepEqual(results, []);
});
test("StalledExecutionDetector.detect returns empty when executions are not stale", () => {
    const now = new Date().toISOString();
    const recent = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: recent,
            latestEventAt: recent,
            latestHeartbeatAt: now,
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({ now, staleAfterMs: 5 * 60 * 1000 }); // 5 minute threshold
    assert.deepEqual(results, []);
});
test("StalledExecutionDetector.detect detects stale execution with missing heartbeat", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null, // No heartbeat
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({
        now,
        staleAfterMs: 5 * 60 * 1000,
        heartbeatGraceMs: 2 * 60 * 1000,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].executionId, "exec-1");
    assert.equal(results[0].staleKind, "missing_heartbeat");
    assert.equal(results[0].recommendedAction, "lease_reclaim");
});
test("StalledExecutionDetector.detect detects stale execution with no progress despite heartbeat", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    const recentHeartbeat = new Date(Date.now() - 1 * 60 * 1000).toISOString(); // 1 minute ago
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: recentHeartbeat, // Has heartbeat but no progress
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({
        now,
        staleAfterMs: 5 * 60 * 1000,
        heartbeatGraceMs: 2 * 60 * 1000,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].executionId, "exec-1");
    assert.equal(results[0].staleKind, "no_progress");
    assert.equal(results[0].recommendedAction, "restart_or_escalate");
});
test("StalledExecutionDetector.detect uses maxIso to determine lastProgressAt", () => {
    const now = new Date().toISOString();
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const newerTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: oldTime,
            latestEventAt: newerTime, // latestEventAt is newer
            latestHeartbeatAt: null,
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({
        now,
        staleAfterMs: 3 * 60 * 1000, // 3 minute threshold
        heartbeatGraceMs: 2 * 60 * 1000,
    });
    assert.equal(results.length, 1);
    // lastProgressAt should be newerTime (maxIso picks the later time)
    assert.equal(results[0].lastProgressAt, newerTime);
});
test("StalledExecutionDetector.detect returns multiple findings", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const store = createMockStore([
        {
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        },
        {
            executionId: "exec-2",
            taskId: "task-2",
            agentId: "agent-2",
            status: "prechecking",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        },
    ]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({ now, staleAfterMs: 5 * 60 * 1000 });
    assert.equal(results.length, 2);
});
test("StalledExecutionDetector.detect uses default options", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        }]);
    const detector = new StalledExecutionDetector(store);
    // Call without options - should use defaults
    const results = detector.detect();
    assert.equal(results.length, 1);
    assert.equal(results[0].staleKind, "missing_heartbeat");
});
test("StalledExecutionDetector.isoMinusMs correctly calculates timestamps", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        }]);
    const detector = new StalledExecutionDetector(store);
    // Threshold is 5 minutes
    // staleTime is 10 minutes ago
    // So staleTime < staleBefore (5 minutes ago), should be detected as stale
    const results = detector.detect({
        now,
        staleAfterMs: 5 * 60 * 1000,
        heartbeatGraceMs: 2 * 60 * 1000,
    });
    assert.equal(results.length, 1);
});
test("StalledExecutionFinding has correct structure", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({ now });
    const finding = results[0];
    assert.ok("executionId" in finding);
    assert.ok("taskId" in finding);
    assert.ok("agentId" in finding);
    assert.ok("status" in finding);
    assert.ok("lastProgressAt" in finding);
    assert.ok("lastHeartbeatAt" in finding);
    assert.ok("staleKind" in finding);
    assert.ok("recommendedAction" in finding);
});
test("StalledExecutionDetectionOptions defaults", () => {
    const store = createMockStore([]);
    const detector = new StalledExecutionDetector(store);
    // Should not throw with empty options
    const results = detector.detect({});
    assert.deepEqual(results, []);
});
test("staleKind is one of the expected values", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({ now });
    const staleKind = results[0].staleKind;
    assert.ok(staleKind === "missing_heartbeat" || staleKind === "no_progress");
});
test("recommendedAction is one of the expected values", () => {
    const now = new Date().toISOString();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const store = createMockStore([{
            executionId: "exec-1",
            taskId: "task-1",
            agentId: "agent-1",
            status: "executing",
            updatedAt: staleTime,
            latestEventAt: staleTime,
            latestHeartbeatAt: null,
        }]);
    const detector = new StalledExecutionDetector(store);
    const results = detector.detect({ now });
    const recommendedAction = results[0].recommendedAction;
    assert.ok(recommendedAction === "lease_reclaim" || recommendedAction === "restart_or_escalate");
});
//# sourceMappingURL=stalled-execution-detector.test.js.map