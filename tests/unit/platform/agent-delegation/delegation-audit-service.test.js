import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DelegationAuditService } from "../../../../src/platform/orchestration/agent-delegation/delegation-audit-service.js";
function createService() {
    return new DelegationAuditService(mkdtempSync(join(tmpdir(), "delegation-audit-test-")));
}
test("DelegationAuditService.record creates audit event with id and timestamp", () => {
    const service = createService();
    const event = service.record({
        eventType: "delegation.created",
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        reasonCode: "test",
        metadata: {},
        actorId: "actor-1",
        actorType: "agent",
    });
    assert.ok(event.id.startsWith("dlg_audit_"));
    assert.ok(event.createdAt.length > 0);
    assert.equal(event.eventType, "delegation.created");
});
test("DelegationAuditService.recordGovernanceEvaluation records governance.denied for deny decision", () => {
    const service = createService();
    const event = service.recordGovernanceEvaluation({
        delegationId: null,
        parentAgentId: "parent-1",
        childAgentId: null,
        depth: 0,
        reasonCode: "test",
        decision: "deny",
        evaluatedRules: ["rule-1"],
        actorId: "actor-1",
        actorType: "system",
    });
    assert.equal(event.eventType, "delegation.governance.denied");
});
test("DelegationAuditService.recordGovernanceEvaluation records governance.evaluated for require_approval decision", () => {
    const service = createService();
    const event = service.recordGovernanceEvaluation({
        delegationId: null,
        parentAgentId: "parent-1",
        childAgentId: null,
        depth: 0,
        reasonCode: "test",
        decision: "require_approval",
        evaluatedRules: ["rule-1"],
        actorId: "actor-1",
        actorType: "system",
    });
    assert.equal(event.eventType, "delegation.governance.evaluated");
});
test("DelegationAuditService.recordGovernanceEvaluation records governance.approved for allow decision", () => {
    const service = createService();
    const event = service.recordGovernanceEvaluation({
        delegationId: null,
        parentAgentId: "parent-1",
        childAgentId: null,
        depth: 0,
        reasonCode: "test",
        decision: "allow",
        evaluatedRules: ["rule-1"],
        actorId: "actor-1",
        actorType: "system",
    });
    assert.equal(event.eventType, "delegation.governance.approved");
});
test("DelegationAuditService.recordDelegationCreated records delegation.created event", () => {
    const service = createService();
    const event = service.recordDelegationCreated({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    assert.equal(event.eventType, "delegation.created");
    assert.equal(event.delegationId, "dlg-1");
    assert.equal(event.depth, 1);
});
test("DelegationAuditService.recordDelegationCompleted records delegation.completed event", () => {
    const service = createService();
    const event = service.recordDelegationCompleted({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        durationMs: 5000,
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    assert.equal(event.eventType, "delegation.completed");
    assert.deepEqual(event.metadata, { durationMs: 5000 });
});
test("DelegationAuditService.recordDelegationFailed records delegation.failed event", () => {
    const service = createService();
    const event = service.recordDelegationFailed({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        error: "Something went wrong",
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    assert.equal(event.eventType, "delegation.failed");
    assert.deepEqual(event.metadata, { error: "Something went wrong" });
});
test("DelegationAuditService.recordPermissionNarrowed records delegation.permission_narrowed event", () => {
    const service = createService();
    const event = service.recordPermissionNarrowed({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        originalPermissions: { actions: ["read", "write"] },
        narrowedPermissions: { actions: ["read"] },
        actorId: "actor-1",
        actorType: "agent",
    });
    assert.equal(event.eventType, "delegation.permission_narrowed");
    assert.deepEqual(event.metadata.originalPermissions, { actions: ["read", "write"] });
    assert.deepEqual(event.metadata.narrowedPermissions, { actions: ["read"] });
});
test("DelegationAuditService.getByDelegation returns events for specific delegation", () => {
    const service = createService();
    service.recordDelegationCreated({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    service.recordDelegationCompleted({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        durationMs: 1000,
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    service.recordDelegationCreated({
        delegationId: "dlg-2",
        parentAgentId: "parent-1",
        childAgentId: "child-2",
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    const events = service.getByDelegation("dlg-1");
    assert.equal(events.length, 2);
    assert.ok(events.every((e) => e.delegationId === "dlg-1"));
});
test("DelegationAuditService.getByAgent returns events for specific agent", () => {
    const service = createService();
    service.record({
        eventType: "delegation.created",
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        reasonCode: "test",
        metadata: {},
        actorId: "actor-1",
        actorType: "agent",
    });
    service.record({
        eventType: "delegation.created",
        delegationId: "dlg-2",
        parentAgentId: "parent-2",
        childAgentId: "child-2",
        depth: 1,
        reasonCode: "test",
        metadata: {},
        actorId: "actor-2",
        actorType: "agent",
    });
    const events = service.getByAgent("actor-1");
    assert.equal(events.length, 1);
    assert.equal(events[0].actorId, "actor-1");
});
test("DelegationAuditService.getRecentEvents returns events sorted by createdAt descending", () => {
    const service = createService();
    // Create events with slight delay
    service.record({
        eventType: "delegation.created",
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        reasonCode: "first",
        metadata: {},
        actorId: "actor-1",
        actorType: "agent",
    });
    service.record({
        eventType: "delegation.completed",
        delegationId: "dlg-2",
        parentAgentId: "parent-2",
        childAgentId: "child-2",
        depth: 1,
        reasonCode: "second",
        metadata: {},
        actorId: "actor-2",
        actorType: "agent",
    });
    const recent = service.getRecentEvents(1);
    assert.equal(recent.length, 1);
});
test("DelegationAuditService.getRecentEvents respects limit parameter", () => {
    const service = createService();
    for (let i = 0; i < 5; i++) {
        service.record({
            eventType: "delegation.created",
            delegationId: `dlg-${i}`,
            parentAgentId: "parent-1",
            childAgentId: "child-1",
            depth: 1,
            reasonCode: "test",
            metadata: {},
            actorId: "actor-1",
            actorType: "agent",
        });
    }
    const recent = service.getRecentEvents(3);
    assert.equal(recent.length, 3);
});
test("DelegationAuditService.getSummary returns correct counts", () => {
    const service = createService();
    service.recordDelegationCreated({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    service.recordDelegationCompleted({
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        durationMs: 1000,
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    service.recordDelegationFailed({
        delegationId: "dlg-2",
        parentAgentId: "parent-1",
        childAgentId: "child-2",
        error: "error",
        depth: 1,
        actorId: "actor-1",
        actorType: "agent",
    });
    const summary = service.getSummary();
    assert.equal(summary.totalEvents, 3);
    assert.equal(summary.byType["delegation.created"], 1);
    assert.equal(summary.byType["delegation.completed"], 1);
    assert.equal(summary.byType["delegation.failed"], 1);
    assert.equal(summary.byAgent["parent-1"], 3);
});
test("DelegationAuditService.getSummary includes lastEventAt", () => {
    const service = createService();
    assert.equal(service.getSummary().lastEventAt, null);
    service.record({
        eventType: "delegation.created",
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        reasonCode: "test",
        metadata: {},
        actorId: "actor-1",
        actorType: "agent",
    });
    const summary = service.getSummary();
    assert.ok(summary.lastEventAt !== null);
});
test("DelegationAuditService.listEvents returns all events", () => {
    const service = createService();
    service.record({
        eventType: "delegation.created",
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        reasonCode: "test",
        metadata: {},
        actorId: "actor-1",
        actorType: "agent",
    });
    service.record({
        eventType: "delegation.completed",
        delegationId: "dlg-1",
        parentAgentId: "parent-1",
        childAgentId: "child-1",
        depth: 1,
        reasonCode: "test",
        metadata: {},
        actorId: "actor-1",
        actorType: "agent",
    });
    const events = service.listEvents();
    assert.equal(events.length, 2);
});
//# sourceMappingURL=delegation-audit-service.test.js.map
