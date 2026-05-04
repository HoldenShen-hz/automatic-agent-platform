import test from "node:test";
import assert from "node:assert/strict";
import type { ToolExecutionMetadata } from "../../../../../src/platform/execution/tool-executor/tool-metadata.js";
import {
  isConcurrentSafe,
  requiresExclusiveExecution,
  partitionParallelToolGroups,
  canExecuteInParallel,
  partitionToolsByExecutionMode,
  executeToolsInParallel,
  executeToolItemsInParallel,
} from "../../../../../src/platform/execution/tool-executor/tool-parallel-executor.js";

function makeMetadata(overrides: Partial<ToolExecutionMetadata> = {}): ToolExecutionMetadata {
  return {
    toolName: "test_tool",
    readOnly: false,
    idempotent: true,
    sideEffectScope: "local_file",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 5000,
    retryableErrorCodes: [],
    approvalMode: "never",
    supportsCancellation: true,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
    ...overrides,
  } as ToolExecutionMetadata;
}

test("isConcurrentSafe returns explicit value when set", () => {
  const meta = makeMetadata({ isConcurrencySafe: true });
  assert.equal(isConcurrentSafe(meta), true);

  const meta2 = makeMetadata({ isConcurrencySafe: false });
  assert.equal(isConcurrentSafe(meta2), false);
});

test("isConcurrentSafe returns true for read-only tools", () => {
  assert.equal(isConcurrentSafe(makeMetadata({ readOnly: true })), true);
});

test("isConcurrentSafe returns true for no lock or read lock", () => {
  assert.equal(isConcurrentSafe(makeMetadata({ needsFileLock: "none" })), true);
  assert.equal(isConcurrentSafe(makeMetadata({ needsFileLock: "read" })), true);
});

test("isConcurrentSafe returns false for write lock", () => {
  assert.equal(isConcurrentSafe(makeMetadata({ needsFileLock: "write" })), false);
  assert.equal(isConcurrentSafe(makeMetadata({ needsFileLock: "dynamic" })), false);
});

test("requiresExclusiveExecution returns true for write/dynamic locks", () => {
  assert.equal(requiresExclusiveExecution(makeMetadata({ needsFileLock: "write" })), true);
  assert.equal(requiresExclusiveExecution(makeMetadata({ needsFileLock: "dynamic" })), true);
});

test("requiresExclusiveExecution returns true for remote/org_state side effects", () => {
  assert.equal(requiresExclusiveExecution(makeMetadata({ sideEffectScope: "remote_api" })), true);
  assert.equal(requiresExclusiveExecution(makeMetadata({ sideEffectScope: "org_state" })), true);
});

test("requiresExclusiveExecution returns true for non-idempotent local_file", () => {
  assert.equal(
    requiresExclusiveExecution(makeMetadata({ readOnly: false, idempotent: false, sideEffectScope: "local_file" })),
    true,
  );
});

test("partitionParallelToolGroups empty input", () => {
  assert.deepEqual(partitionParallelToolGroups([]), []);
});

test("partitionParallelToolGroups single tool", () => {
  const meta = [makeMetadata({ toolName: "tool1" })];
  assert.deepEqual(partitionParallelToolGroups(meta), [[0]]);
});

test("partitionParallelToolGroups separates exclusive tools and groups consecutive read-only", () => {
  // Three tools: read-only, exclusive (write lock), read-only
  // read1 and read2 cannot be in the same group because write1 separates them
  const meta = [
    makeMetadata({ toolName: "read1", readOnly: true }),
    makeMetadata({ toolName: "write1", needsFileLock: "write" }),
    makeMetadata({ toolName: "read2", readOnly: true }),
  ];
  const groups = partitionParallelToolGroups(meta);
  // write1 is in its own exclusive group
  assert.ok(groups.some(g => g.length === 1 && g[0] === 1));
  // read1 and read2 are in separate groups (write1 broke the grouping)
  // The algorithm creates [[0], [1], [2]]
  assert.equal(groups.length, 3);
});

test("partitionParallelToolGroups groups consecutive read-only tools together", () => {
  // Two consecutive read-only tools should be in the same group
  const meta = [
    makeMetadata({ toolName: "read1", readOnly: true }),
    makeMetadata({ toolName: "read2", readOnly: true }),
    makeMetadata({ toolName: "read3", readOnly: true }),
  ];
  const groups = partitionParallelToolGroups(meta);
  // All three should be in the same parallel group
  assert.deepEqual(groups, [[0, 1, 2]]);
});

test("canExecuteInParallel true for empty or single", () => {
  assert.equal(canExecuteInParallel([]), true);
  assert.equal(canExecuteInParallel([makeMetadata()]), true);
});

test("canExecuteInParallel false when any requires exclusive", () => {
  const meta = [
    makeMetadata({ readOnly: true }),
    makeMetadata({ needsFileLock: "write" }),
  ];
  assert.equal(canExecuteInParallel(meta), false);
});

test("canExecuteInParallel true when all concurrent-safe", () => {
  const meta = [
    makeMetadata({ readOnly: true }),
    makeMetadata({ readOnly: true }),
  ];
  assert.equal(canExecuteInParallel(meta), true);
});

test("partitionToolsByExecutionMode empty", () => {
  const result = partitionToolsByExecutionMode([]);
  assert.deepEqual(result.parallelIndices, []);
  assert.deepEqual(result.exclusiveIndices, []);
  assert.equal(result.isValid, true);
});

test("partitionToolsByExecutionMode all parallel", () => {
  const meta = [
    makeMetadata({ readOnly: true, toolName: "r1" }),
    makeMetadata({ readOnly: true, toolName: "r2" }),
  ];
  const result = partitionToolsByExecutionMode(meta);
  assert.deepEqual(result.parallelIndices, [0, 1]);
  assert.deepEqual(result.exclusiveIndices, []);
  assert.equal(result.isValid, true);
});

test("partitionToolsByExecutionMode mixed", () => {
  const meta = [
    makeMetadata({ readOnly: true, toolName: "r1" }),
    makeMetadata({ needsFileLock: "write", toolName: "w1" }),
    makeMetadata({ readOnly: true, toolName: "r2" }),
  ];
  const result = partitionToolsByExecutionMode(meta);
  assert.deepEqual(result.parallelIndices, [0, 2]);
  assert.deepEqual(result.exclusiveIndices, [1]);
  assert.equal(result.isValid, true);
});

test("executeToolsInParallel empty", async () => {
  const result = await executeToolsInParallel([], []);
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.allSucceeded, true);
  assert.equal(result.anyFailed, false);
});

test("executeToolsInParallel single success", async () => {
  const fns = [async () => ({ ok: true })];
  const metas = [makeMetadata({ toolName: "t1" })];
  const result = await executeToolsInParallel(fns, metas);
  assert.equal(result.allSucceeded, true);
  assert.equal(result.anyFailed, false);
  assert.deepEqual(result.results, [{ ok: true }]);
  assert.equal(result.errors.length, 0);
});

test("executeToolsInParallel single failure", async () => {
  const fns = [async () => { throw new Error("test error"); }];
  const metas = [makeMetadata({ toolName: "t1" })];
  const result = await executeToolsInParallel(fns, metas);
  assert.equal(result.allSucceeded, false);
  assert.equal(result.anyFailed, true);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.index, 0);
  assert.equal(result.errors[0]!.toolName, "t1");
});

test("executeToolsInParallel parallel execution", async () => {
  let order: number[] = [];
  const makeFn = (id: number) => async () => {
    order.push(id);
    return { id };
  };

  const fns = [makeFn(1), makeFn(2), makeFn(3)];
  const metas = [
    makeMetadata({ toolName: "t1", readOnly: true }),
    makeMetadata({ toolName: "t2", readOnly: true }),
    makeMetadata({ toolName: "t3", readOnly: true }),
  ];

  const result = await executeToolsInParallel(fns, metas, { maxParallelism: 3 });
  assert.equal(result.allSucceeded, true);
  assert.equal(result.results.length, 3);
});

test("executeToolsInParallel length mismatch throws", async () => {
  const fns = [async () => 1, async () => 2];
  const metas = [makeMetadata({ toolName: "t1" })];
  await assert.rejects(
    async () => executeToolsInParallel(fns, metas),
    /length_mismatch/,
  );
});

test("executeToolsInParallel failFast works between batches", async () => {
  // failFast stops execution of subsequent batches after an error in the current batch.
  // Within a single parallel batch (Promise.allSettled), all tools run regardless.
  let secondCalled = false;
  const fns = [
    async () => { throw new Error("first error"); },
    async () => { secondCalled = true; return 1; },
  ];
  const metas = [
    makeMetadata({ toolName: "t1", readOnly: true }),
    makeMetadata({ toolName: "t2", readOnly: true }),
  ];

  const result = await executeToolsInParallel(fns, metas, { failFast: true });
  assert.equal(result.anyFailed, true);
  // Within a parallel group, Promise.allSettled runs both before checking failFast
  assert.equal(secondCalled, true);
});

test("executeToolsInParallel marks failed slots explicitly instead of leaving sparse holes", async () => {
  const fns = [
    async () => "ok-0",
    async () => {
      throw new Error("boom");
    },
    async () => "ok-2",
  ];
  const metas = [
    makeMetadata({ toolName: "t0", readOnly: true }),
    makeMetadata({ toolName: "t1", readOnly: true }),
    makeMetadata({ toolName: "t2", readOnly: true }),
  ];

  const result = await executeToolsInParallel(fns, metas, { maxParallelism: 3 });

  assert.equal(result.anyFailed, true);
  assert.equal(1 in result.results, true);
  assert.equal(result.results[1], undefined);
  assert.deepEqual(result.results, ["ok-0", undefined, "ok-2"]);
});

test("executeToolItemsInParallel passes through correctly", async () => {
  const items: Array<{ metadata: ToolExecutionMetadata; execute: () => Promise<number> }> = [
    { metadata: makeMetadata({ toolName: "a", readOnly: true }), execute: async () => 1 },
    { metadata: makeMetadata({ toolName: "b", readOnly: true }), execute: async () => 2 },
  ];

  const result = await executeToolItemsInParallel(items);
  assert.equal(result.allSucceeded, true);
  assert.equal(result.results.length, 2);
});
