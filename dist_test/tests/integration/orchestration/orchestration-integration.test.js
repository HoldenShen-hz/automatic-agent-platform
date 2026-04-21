import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
test("Workflow plan creation", () => {
    const plan = {
        id: newId("wplan"),
        taskId: newId("task"),
        steps: ["validate", "execute", "finalize"],
        currentStepIndex: 0,
        status: "planning",
        createdAt: nowIso(),
    };
    assert.ok(plan.id.startsWith("wplan_"));
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.currentStepIndex, 0);
});
test("Workflow plan step progression", () => {
    const plan = {
        id: newId("wplan"),
        taskId: newId("task"),
        steps: ["validate", "execute", "finalize"],
        currentStepIndex: 0,
        status: "executing",
        createdAt: nowIso(),
    };
    plan.currentStepIndex++;
    assert.equal(plan.currentStepIndex, 1);
    plan.currentStepIndex++;
    assert.equal(plan.currentStepIndex, 2);
    plan.status = "completed";
    assert.equal(plan.status, "completed");
});
test("Workflow plan with many steps", () => {
    const stepNames = ["analyze", "plan", "validate", "execute", "verify", "report"];
    const plan = {
        id: newId("wplan"),
        taskId: newId("task"),
        steps: stepNames,
        currentStepIndex: 0,
        status: "planning",
        createdAt: nowIso(),
    };
    assert.equal(plan.steps.length, 6);
    assert.equal(plan.steps[0], "analyze");
    assert.equal(plan.steps[5], "report");
});
test("Agent team formation", () => {
    const team = {
        id: newId("team"),
        name: "Data Processing Team",
        memberIds: [newId("agent"), newId("agent"), newId("agent")],
        leaderId: newId("agent"),
        status: "forming",
    };
    assert.equal(team.memberIds.length, 3);
    assert.ok(team.leaderId !== "");
    assert.equal(team.status, "forming");
});
test("Agent team activation", () => {
    const team = {
        id: newId("team"),
        name: "Analysis Team",
        memberIds: [newId("agent"), newId("agent")],
        leaderId: newId("agent"),
        status: "forming",
    };
    team.status = "active";
    assert.equal(team.status, "active");
});
test("Agent team disbanding", () => {
    const team = {
        id: newId("team"),
        name: "Temp Team",
        memberIds: [newId("agent")],
        leaderId: newId("agent"),
        status: "active",
    };
    team.status = "disbanded";
    assert.equal(team.status, "disbanded");
});
test("Intake request routing", () => {
    const request = {
        id: newId("intake"),
        kind: "data_processing",
        priority: "normal",
        status: "received",
        submittedAt: nowIso(),
    };
    request.status = "routed";
    assert.equal(request.status, "routed");
    request.status = "processing";
    assert.equal(request.status, "processing");
});
test("Intake request priority levels", () => {
    const priorities = ["low", "normal", "high", "urgent"];
    const requests = [];
    for (const priority of priorities) {
        requests.push({
            id: newId("intake"),
            kind: "test",
            priority,
            status: "received",
            submittedAt: nowIso(),
        });
    }
    assert.equal(requests[0]?.priority, "low");
    assert.equal(requests[3]?.priority, "urgent");
});
test("Intake request urgent priority", () => {
    const request = {
        id: newId("intake"),
        kind: "system_alert",
        priority: "urgent",
        status: "received",
        submittedAt: nowIso(),
    };
    assert.equal(request.priority, "urgent");
});
test("Workflow plan failure handling", () => {
    const plan = {
        id: newId("wplan"),
        taskId: newId("task"),
        steps: ["validate", "execute", "finalize"],
        currentStepIndex: 1,
        status: "executing",
        createdAt: nowIso(),
    };
    plan.status = "failed";
    plan.currentStepIndex = -1;
    assert.equal(plan.status, "failed");
    assert.equal(plan.currentStepIndex, -1);
});
//# sourceMappingURL=orchestration-integration.test.js.map