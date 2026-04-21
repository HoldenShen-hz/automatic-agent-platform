import assert from "node:assert/strict";
import test from "node:test";
test("ArtifactWriteInput structure is correct", () => {
    const input = {
        taskId: "task_1",
        executionId: "exec_1",
        stepId: "step_1",
        kind: "code",
        fileName: "solution.ts",
        content: "const x = 1;",
        mimeType: "text/typescript",
    };
    assert.equal(input.taskId, "task_1");
    assert.equal(input.kind, "code");
    assert.equal(input.fileName, "solution.ts");
});
test("ArtifactWriteInput with optional fields", () => {
    const input = {
        taskId: "task_1",
        kind: "document",
        fileName: "readme.md",
        content: "# Hello",
    };
    assert.equal(input.executionId, undefined);
    assert.equal(input.stepId, undefined);
});
test("ArtifactStoreOptions structure is correct", () => {
    const options = {
        rootDir: "/tmp/artifacts",
    };
    assert.equal(options.rootDir, "/tmp/artifacts");
});
test("ArtifactStoreOptions with sandbox policy", () => {
    const options = {
        rootDir: "/tmp/artifacts",
        sandboxPolicy: {
            policyId: "sandbox_1",
            mode: "read_only",
            allowedRoots: ["/tmp"],
            deniedRoots: [],
            realpathEnforced: true,
            symlinkPolicy: "deny",
            processRuleMode: "deny",
        },
    };
    assert.ok(options.sandboxPolicy !== undefined);
    assert.deepEqual(options.sandboxPolicy.allowedRoots, ["/tmp"]);
    assert.equal(options.sandboxPolicy.mode, "read_only");
});
//# sourceMappingURL=index.test.js.map