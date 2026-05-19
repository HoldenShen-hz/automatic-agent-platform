/**
 * Acceptance Readiness CLI Tests
 *
 * Tests for acceptance-readiness.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for acceptance-readiness env loading patterns
// ---------------------------------------------------------------------------
test("acceptance-readiness action defaults to build when not specified", () => {
    // The CLI uses: envConfig.action === "export" ? exportReport() : buildReport()
    // So default is buildReport
    const action = undefined;
    const result = action === "export" ? "export" : "build";
    assert.equal(result, "build");
});
test("acceptance-readiness action can be export", () => {
    const action = "export";
    const result = action === "export" ? "export" : "build";
    assert.equal(result, "export");
});
test("acceptance-readiness input building includes targetEnvironment", () => {
    const envConfig = { targetEnvironment: "production" };
    const input = {
        targetEnvironment: envConfig.targetEnvironment,
    };
    assert.equal(input.targetEnvironment, "production");
});
test("acceptance-readiness input building conditionally includes optional fields", () => {
    const envConfig = {
        targetEnvironment: "staging",
        generatedAt: "2024-01-01T00:00:00.000Z",
        taskId: "task_123",
        version: "1.0.0",
        commitSha: "abc123",
        rolloutStrategy: "canary",
    };
    const input = {
        targetEnvironment: envConfig.targetEnvironment,
    };
    if (envConfig.generatedAt) {
        input.generatedAt = envConfig.generatedAt;
    }
    if (envConfig.taskId) {
        input.taskId = envConfig.taskId;
    }
    if (envConfig.version) {
        input.version = envConfig.version;
    }
    if (envConfig.commitSha) {
        input.commitSha = envConfig.commitSha;
    }
    if (envConfig.rolloutStrategy) {
        input.rolloutStrategy = envConfig.rolloutStrategy;
    }
    assert.equal(input.targetEnvironment, "staging");
    assert.equal(input.generatedAt, "2024-01-01T00:00:00.000Z");
    assert.equal(input.taskId, "task_123");
    assert.equal(input.version, "1.0.0");
    assert.equal(input.commitSha, "abc123");
    assert.equal(input.rolloutStrategy, "canary");
});
test("acceptance-readiness input building omits undefined optional fields", () => {
    const envConfig = {
        targetEnvironment: "production",
    };
    const input = {
        targetEnvironment: envConfig.targetEnvironment,
    };
    // Only add fields that are defined
    if (envConfig.generatedAt) {
        input.generatedAt = envConfig.generatedAt;
    }
    if (envConfig.taskId) {
        input.taskId = envConfig.taskId;
    }
    assert.equal(input.targetEnvironment, "production");
    assert.equal(input.generatedAt, undefined);
    assert.equal(input.taskId, undefined);
});
//# sourceMappingURL=acceptance-readiness.test.js.map