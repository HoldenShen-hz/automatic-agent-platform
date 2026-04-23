import assert from "node:assert/strict";
import test from "node:test";
test("SkillStepDefinition type accepts valid onFailure values", () => {
    const step1 = { stepId: "1", toolName: "read", onFailure: "fail" };
    const step2 = { stepId: "2", toolName: "write", onFailure: "continue" };
    const step3 = { stepId: "3", toolName: "edit", onFailure: "retry" };
    assert.equal(step1.onFailure, "fail");
    assert.equal(step2.onFailure, "continue");
    assert.equal(step3.onFailure, "retry");
});
test("SkillStepDefinition allows optional fields", () => {
    const minimal = { stepId: "1", toolName: "read" };
    assert.equal(minimal.stepId, "1");
    const withAll = {
        stepId: "1",
        toolName: "read",
        description: "Read a file",
        onFailure: "continue",
        maxAttempts: 3,
        input: { path: "/tmp" },
        modelOverrides: [],
    };
    assert.equal(withAll.description, "Read a file");
    assert.equal(withAll.maxAttempts, 3);
});
test("SkillStepModelOverride type structure", () => {
    const override = {
        toolName: "edit",
        profileNames: ["claude-3-5-sonnet"],
        tiers: ["balanced"],
        requiredCapabilities: ["code"],
    };
    assert.equal(override.toolName, "edit");
    assert.ok(override.profileNames.includes("claude-3-5-sonnet"));
    assert.ok(override.tiers.includes("balanced"));
    assert.ok(override.requiredCapabilities.includes("code"));
});
test("SkillStepModelOverride allows minimal definition", () => {
    const override = { toolName: "edit" };
    assert.equal(override.toolName, "edit");
});
test("SkillDefinition type structure", () => {
    const skill = {
        skillId: "file-editor",
        version: "1.0.0",
        description: "Edits files",
        requiredTools: ["edit", "read"],
        steps: [
            { stepId: "1", toolName: "read" },
            { stepId: "2", toolName: "edit" },
        ],
    };
    assert.equal(skill.skillId, "file-editor");
    assert.equal(skill.version, "1.0.0");
    assert.equal(skill.steps.length, 2);
    assert.ok(skill.requiredTools.includes("edit"));
});
//# sourceMappingURL=skill-execution-support.test.js.map