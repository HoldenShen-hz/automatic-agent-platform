import test from "node:test";
import assert from "node:assert/strict";
test("ConstraintPack type is exported and can be constructed", () => {
    const pack = {
        policyIds: ["policy-1"],
        approvalMode: "none",
        autonomyMode: "auto",
        toolPolicy: {
            allowedTools: ["tool-a", "tool-b"],
        },
        risk_policy: {
            maxRiskScore: 10,
            escalationThreshold: 8,
        },
        output_policy: {
            requiredEvidence: ["evidence-1"],
            redactSensitiveData: false,
        },
        budget: {
            maxSteps: 100,
            maxCost: 1000,
            maxDurationMs: 60000,
        },
    };
    assert.equal(pack.policyIds.length, 1);
    assert.equal(pack.approvalMode, "none");
    assert.equal(pack.autonomyMode, "auto");
    assert.equal(pack.toolPolicy.allowedTools.length, 2);
    assert.equal(pack.risk_policy.maxRiskScore, 10);
    assert.equal(pack.output_policy.requiredEvidence.length, 1);
    assert.equal(pack.budget.maxSteps, 100);
});
test("ConstraintPack allows different approval modes", () => {
    const packNone = {
        policyIds: [],
        approvalMode: "none",
        autonomyMode: "auto",
        toolPolicy: { allowedTools: [] },
        risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
        output_policy: { requiredEvidence: [], redactSensitiveData: false },
        budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    };
    assert.equal(packNone.approvalMode, "none");
    const packRequired = {
        policyIds: [],
        approvalMode: "required",
        autonomyMode: "auto",
        toolPolicy: { allowedTools: [] },
        risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
        output_policy: { requiredEvidence: [], redactSensitiveData: false },
        budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    };
    assert.equal(packRequired.approvalMode, "required");
    const packSupervised = {
        policyIds: [],
        approvalMode: "supervised",
        autonomyMode: "auto",
        toolPolicy: { allowedTools: [] },
        risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
        output_policy: { requiredEvidence: [], redactSensitiveData: false },
        budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    };
    assert.equal(packSupervised.approvalMode, "supervised");
});
test("ConstraintPack allows different autonomy modes", () => {
    const modes = ["manual", "supervised", "auto", "full_auto"];
    for (const mode of modes) {
        const pack = {
            policyIds: [],
            approvalMode: "none",
            autonomyMode: mode,
            toolPolicy: { allowedTools: [] },
            risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
            output_policy: { requiredEvidence: [], redactSensitiveData: false },
            budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
        };
        assert.equal(pack.autonomyMode, mode);
    }
});
//# sourceMappingURL=constraints.test.js.map