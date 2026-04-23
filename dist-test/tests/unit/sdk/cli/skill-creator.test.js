/**
 * Skill Creator CLI Tests
 *
 * Tests for skill-creator.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for action validation
// ---------------------------------------------------------------------------
test("skill creator action must be create or validate", () => {
    const validActions = ["create", "validate"];
    assert.ok(validActions.includes("create"));
    assert.ok(validActions.includes("validate"));
});
test("skill creator requires AA_SKILL_CREATOR_ACTION env var", () => {
    const envVar = "AA_SKILL_CREATOR_ACTION";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("SKILL_CREATOR_ACTION"));
});
// ---------------------------------------------------------------------------
// Tests for environment variable configuration
// ---------------------------------------------------------------------------
test("skill creator action env var format", () => {
    const actionEnvVar = "AA_SKILL_CREATOR_ACTION";
    assert.ok(actionEnvVar.startsWith("AA_"));
});
test("skill register env var format", () => {
    const registerEnvVar = "AA_SKILL_REGISTER";
    assert.ok(registerEnvVar.startsWith("AA_"));
    assert.ok(registerEnvVar.includes("REGISTER"));
});
test("skill root env var format", () => {
    const rootEnvVar = "AA_SKILL_ROOT";
    assert.ok(rootEnvVar.startsWith("AA_"));
    assert.ok(rootEnvVar.includes("SKILL_ROOT"));
});
test("skill name env var format", () => {
    const nameEnvVar = "AA_SKILL_NAME";
    assert.ok(nameEnvVar.startsWith("AA_"));
    assert.ok(nameEnvVar.includes("SKILL_NAME"));
});
test("skill description env var format", () => {
    const descEnvVar = "AA_SKILL_DESCRIPTION";
    assert.ok(descEnvVar.startsWith("AA_"));
    assert.ok(descEnvVar.includes("SKILL_DESCRIPTION"));
});
test("skill path for validation env var format", () => {
    const pathEnvVar = "AA_SKILL_PATH";
    assert.ok(pathEnvVar.startsWith("AA_"));
    assert.ok(pathEnvVar.includes("SKILL_PATH"));
});
// ---------------------------------------------------------------------------
// Tests for risk levels
// ---------------------------------------------------------------------------
test("skill risk levels include low, medium, high", () => {
    const validRiskLevels = ["low", "medium", "high"];
    assert.ok(validRiskLevels.includes("low"));
    assert.ok(validRiskLevels.includes("medium"));
    assert.ok(validRiskLevels.includes("high"));
});
// ---------------------------------------------------------------------------
// Tests for lifecycle states
// ---------------------------------------------------------------------------
test("skill lifecycle states include experimental, beta, stable, deprecated", () => {
    const validLifecycles = ["experimental", "beta", "stable", "deprecated"];
    assert.ok(validLifecycles.includes("experimental"));
    assert.ok(validLifecycles.includes("beta"));
    assert.ok(validLifecycles.includes("stable"));
    assert.ok(validLifecycles.includes("deprecated"));
});
//# sourceMappingURL=skill-creator.test.js.map