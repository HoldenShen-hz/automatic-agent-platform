import test from "node:test";
import assert from "node:assert/strict";
import { TaskPhaseSchema, BlockerSchema, RelevantFileSchema, CodebaseSnapshotSchema, EnvironmentContextSchema, HistoricalContextSchema, UserIntentSchema, RetryPolicySchema, } from "../../../../../../src/platform/orchestration/oapeflir/types/shared.js";
test("TaskPhaseSchema accepts valid phases", () => {
    const phases = ["intake", "planning", "executing", "reviewing", "completed"];
    for (const phase of phases) {
        assert.equal(TaskPhaseSchema.parse(phase), phase);
    }
});
test("TaskPhaseSchema rejects invalid phase", () => {
    assert.throws(() => {
        TaskPhaseSchema.parse("invalid_phase");
    });
});
test("BlockerSchema parses valid blocker", () => {
    const input = {
        description: "Resource constraint",
        severity: "high",
    };
    const result = BlockerSchema.parse(input);
    assert.equal(result.severity, "high");
});
test("BlockerSchema accepts all severity levels", () => {
    const severities = ["low", "medium", "high", "critical"];
    for (const severity of severities) {
        const result = BlockerSchema.parse({ description: "Test", severity });
        assert.equal(result.severity, severity);
    }
});
test("RelevantFileSchema parses valid file", () => {
    const input = {
        path: "/src/main.ts",
        language: "typescript",
        linesOfCode: 500,
    };
    const result = RelevantFileSchema.parse(input);
    assert.equal(result.path, "/src/main.ts");
    assert.equal(result.language, "typescript");
});
test("RelevantFileSchema applies defaults", () => {
    const input = { path: "/src/main.ts" };
    const result = RelevantFileSchema.parse(input);
    assert.equal(result.language, undefined);
    assert.equal(result.linesOfCode, undefined);
});
test("CodebaseSnapshotSchema parses valid snapshot", () => {
    const input = {
        rootPath: "/project",
        fileCount: 100,
        relevantFiles: [{ path: "/src/main.ts" }],
        gitRef: "main",
    };
    const result = CodebaseSnapshotSchema.parse(input);
    assert.equal(result.fileCount, 100);
});
test("EnvironmentContextSchema parses valid context", () => {
    const input = {
        nodeVersion: "20.0.0",
        platform: "darwin",
        workingDirectory: "/project",
        availableTools: ["git", "npm"],
    };
    const result = EnvironmentContextSchema.parse(input);
    assert.deepEqual(result.availableTools, ["git", "npm"]);
});
test("HistoricalContextSchema applies defaults", () => {
    const input = {};
    const result = HistoricalContextSchema.parse(input);
    assert.deepEqual(result.previousTaskIds, []);
    assert.deepEqual(result.relatedMemoryRefs, []);
});
test("UserIntentSchema parses valid intent", () => {
    const input = {
        raw: "Fix the bug in login",
        normalized: "fix login bug",
        confidence: 0.95,
    };
    const result = UserIntentSchema.parse(input);
    assert.equal(result.confidence, 0.95);
});
test("UserIntentSchema rejects confidence outside [0, 1]", () => {
    assert.throws(() => {
        UserIntentSchema.parse({
            raw: "Test",
            normalized: "test",
            confidence: 1.5,
        });
    });
});
test("RetryPolicySchema parses valid policy", () => {
    const input = { maxRetries: 3, backoffMs: 1000 };
    const result = RetryPolicySchema.parse(input);
    assert.equal(result.maxRetries, 3);
    assert.equal(result.backoffMs, 1000);
});
test("RetryPolicySchema requires non-negative values", () => {
    assert.throws(() => {
        RetryPolicySchema.parse({ maxRetries: -1, backoffMs: 0 });
    });
    assert.throws(() => {
        RetryPolicySchema.parse({ maxRetries: 0, backoffMs: -100 });
    });
});
//# sourceMappingURL=shared.test.js.map