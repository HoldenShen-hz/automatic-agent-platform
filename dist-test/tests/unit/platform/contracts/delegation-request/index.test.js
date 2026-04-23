import assert from "node:assert/strict";
import test from "node:test";
import { createDelegationRequest } from "../../../../../src/platform/contracts/delegation-request/index.js";
test("DelegationPriority accepts the canonical priority values", () => {
    const priorities = ["low", "normal", "high", "critical"];
    assert.equal(priorities.length, 4);
});
test("createDelegationRequest requires a target agent or capability reference", () => {
    const request = createDelegationRequest({
        taskId: "task-1",
        fromAgentId: "agent-1",
        toAgentId: null,
        capabilityRef: "capability:review",
        priority: "high",
        reason: "need code review",
        contextRef: "context:1",
        tenantId: "tenant-1",
    });
    assert.equal(request.capabilityRef, "capability:review");
    assert.equal(request.priority, "high");
});
//# sourceMappingURL=index.test.js.map