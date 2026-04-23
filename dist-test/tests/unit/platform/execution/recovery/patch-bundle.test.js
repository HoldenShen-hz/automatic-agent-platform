import assert from "node:assert/strict";
import test from "node:test";
import { createPatchBundle, validatePatchBundle, } from "../../../../../src/platform/execution/recovery/patch-bundle.js";
test("createPatchBundle creates bundle with calculated totalDiffLines", () => {
    const changedFiles = [
        {
            path: "/src/index.ts",
            operation: "modify",
            hunks: [
                {
                    originalStart: 1,
                    originalCount: 10,
                    finalStart: 1,
                    finalCount: 15,
                    lines: ["line1", "line2", "line3"],
                },
            ],
        },
        {
            path: "/src/utils.ts",
            operation: "create",
            hunks: [
                {
                    originalStart: 0,
                    originalCount: 0,
                    finalStart: 1,
                    finalCount: 5,
                    lines: ["line1", "line2"],
                },
            ],
        },
    ];
    const bundle = createPatchBundle({
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles,
        authorAgentId: "agent_1",
    });
    assert.equal(bundle.bundleId, "bundle_1");
    assert.equal(bundle.taskId, "task_1");
    assert.equal(bundle.authorAgentId, "agent_1");
    assert.equal(bundle.status, "pending");
    assert.equal(bundle.totalDiffLines, 5); // 3 + 2
    assert.ok(bundle.createdAt);
});
test("createPatchBundle handles empty changedFiles", () => {
    const bundle = createPatchBundle({
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [],
        authorAgentId: "agent_1",
    });
    assert.equal(bundle.totalDiffLines, 0);
    assert.equal(bundle.changedFiles.length, 0);
});
test("validatePatchBundle returns valid for compliant bundle", () => {
    const bundle = {
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [],
        totalDiffLines: 10,
        createdAt: new Date().toISOString(),
        authorAgentId: "agent_1",
        status: "pending",
    };
    const taskCard = {
        maxChangedFiles: 10,
        maxDiffLines: 100,
        forbiddenPaths: ["**/secrets/**"],
    };
    const result = validatePatchBundle(bundle, taskCard);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});
test("validatePatchBundle returns error for too many changed files", () => {
    const bundle = {
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [
            { path: "/src/file1.ts", operation: "modify", hunks: [] },
            { path: "/src/file2.ts", operation: "modify", hunks: [] },
            { path: "/src/file3.ts", operation: "modify", hunks: [] },
            { path: "/src/file4.ts", operation: "modify", hunks: [] },
            { path: "/src/file5.ts", operation: "modify", hunks: [] },
        ],
        totalDiffLines: 10,
        createdAt: new Date().toISOString(),
        authorAgentId: "agent_1",
        status: "pending",
    };
    const taskCard = {
        maxChangedFiles: 3,
        maxDiffLines: 100,
        forbiddenPaths: [],
    };
    const result = validatePatchBundle(bundle, taskCard);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("exceeds maximum")));
});
test("validatePatchBundle returns error for too many diff lines", () => {
    const bundle = {
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [],
        totalDiffLines: 150,
        createdAt: new Date().toISOString(),
        authorAgentId: "agent_1",
        status: "pending",
    };
    const taskCard = {
        maxChangedFiles: 10,
        maxDiffLines: 100,
        forbiddenPaths: [],
    };
    const result = validatePatchBundle(bundle, taskCard);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Total diff lines")));
});
test("validatePatchBundle returns error for forbidden paths", () => {
    const bundle = {
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [
            { path: "/src/secrets/api-key.ts", operation: "modify", hunks: [] },
        ],
        totalDiffLines: 10,
        createdAt: new Date().toISOString(),
        authorAgentId: "agent_1",
        status: "pending",
    };
    const taskCard = {
        maxChangedFiles: 10,
        maxDiffLines: 100,
        forbiddenPaths: ["**/secrets/**"],
    };
    const result = validatePatchBundle(bundle, taskCard);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("forbidden")));
});
test("validatePatchBundle returns warning at 80% of diff limit", () => {
    const bundle = {
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [],
        totalDiffLines: 85,
        createdAt: new Date().toISOString(),
        authorAgentId: "agent_1",
        status: "pending",
    };
    const taskCard = {
        maxChangedFiles: 10,
        maxDiffLines: 100,
        forbiddenPaths: [],
    };
    const result = validatePatchBundle(bundle, taskCard);
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(w => w.includes("80%")));
});
test("validatePatchBundle rejects forbidden path with ** glob", () => {
    const bundle = {
        bundleId: "bundle_1",
        taskId: "task_1",
        changedFiles: [
            { path: "/src/secrets/api-key.ts", operation: "modify", hunks: [] },
        ],
        totalDiffLines: 10,
        createdAt: new Date().toISOString(),
        authorAgentId: "agent_1",
        status: "pending",
    };
    const taskCard = {
        maxChangedFiles: 10,
        maxDiffLines: 100,
        forbiddenPaths: ["**/secrets/**"],
    };
    const result = validatePatchBundle(bundle, taskCard);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("forbidden")));
});
test("PatchStatus type accepts all valid values", () => {
    const statuses = ["pending", "applied", "rejected", "rolled_back"];
    assert.equal(statuses.length, 4);
});
test("ChangedFile operation type accepts all valid values", () => {
    const operations = ["create", "modify", "delete", "rename"];
    assert.equal(operations.length, 4);
});
//# sourceMappingURL=patch-bundle.test.js.map