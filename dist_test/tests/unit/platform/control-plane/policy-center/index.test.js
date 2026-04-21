import assert from "node:assert/strict";
import test from "node:test";
import { PolicyCenterService } from "../../../../../src/platform/control-plane/policy-center/index.js";
test("PolicyCenterService escalates high-risk org changes in auto mode", () => {
    const service = new PolicyCenterService({
        subjectRoles: { "agent-1": ["operator"] },
        allowedActionsByRole: {
            operator: ["org_change", "advance_rollout"],
        },
    });
    const result = service.evaluate({
        decisionId: "decision-1",
        taskId: "task-1",
        subjectType: "agent",
        subjectId: "agent-1",
        action: "org_change",
        riskCategory: "org_changing",
        mode: "auto",
        stage: "release",
    });
    assert.equal(result.decision, "escalate_for_approval");
    assert.equal(result.requiresApproval, true);
});
test("PolicyCenterService denies file writes outside the allowed path scope", () => {
    const service = new PolicyCenterService({
        subjectRoles: { "user-1": ["developer"] },
        allowedActionsByRole: { developer: ["write_file"] },
        allowedPathPrefixes: ["/workspace/src/"],
    });
    const result = service.evaluate({
        decisionId: "decision-2",
        taskId: "task-2",
        subjectType: "user",
        subjectId: "user-1",
        action: "write_file",
        resourceRef: "/tmp/outside.txt",
        riskCategory: "sensitive_data",
        mode: "supervised",
        stage: "execute",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reasonCode, "policy.path_scope_denied");
});
test("PolicyCenterService allows constrained network access for approved hosts", () => {
    const service = new PolicyCenterService({
        subjectRoles: { "user-1": ["developer"] },
        allowedActionsByRole: { developer: ["network_access"] },
        allowedNetworkHosts: ["api.internal.example.com"],
    });
    const result = service.evaluate({
        decisionId: "decision-3",
        taskId: "task-3",
        subjectType: "user",
        subjectId: "user-1",
        action: "network_access",
        resourceRef: "https://api.internal.example.com/v1/status",
        riskCategory: "sensitive_data",
        mode: "full-auto",
        stage: "execute",
    });
    assert.equal(result.decision, "allow_with_constraints");
    assert.deepEqual(result.enforcedConstraints.allowedNetworkHosts, ["api.internal.example.com"]);
});
//# sourceMappingURL=index.test.js.map