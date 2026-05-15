import assert from "node:assert/strict";
import test from "node:test";

import {
  ReplayBoundaryGuard,
  type ReplayMode,
  type ReplayOperation,
  type ReplayBoundaryDecision,
} from "../../../../../src/platform/five-plane-execution/recovery/replay-boundary-guard.js";

test("ReplayBoundaryGuard is instantiable", () => {
  const guard = new ReplayBoundaryGuard();
  assert.ok(guard != null);
});

test("ReplayMode type accepts trace_replay", () => {
  const mode: ReplayMode = "trace_replay";
  assert.equal(mode, "trace_replay");
});

test("ReplayMode type accepts reexecution_replay", () => {
  const mode: ReplayMode = "reexecution_replay";
  assert.equal(mode, "reexecution_replay");
});

test("ReplayMode type accepts projection_replay", () => {
  const mode: ReplayMode = "projection_replay";
  assert.equal(mode, "projection_replay");
});

test("ReplayOperation interface structure", () => {
  const operation: ReplayOperation = {
    operationId: "op-1",
    resourceKind: "tool",
    hasRealSideEffect: false,
    tombstoneReplay: false,
  };
  assert.equal(operation.operationId, "op-1");
  assert.equal(operation.resourceKind, "tool");
  assert.equal(operation.hasRealSideEffect, false);
  assert.equal(operation.tombstoneReplay, false);
});

test("ReplayBoundaryDecision interface structure - allowed", () => {
  const decision: ReplayBoundaryDecision = {
    allowed: true,
    reasonCode: "replay.allowed",
    blockedOperationIds: [],
  };
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "replay.allowed");
  assert.deepEqual(decision.blockedOperationIds, []);
});

test("ReplayBoundaryDecision interface structure - blocked real side effect", () => {
  const decision: ReplayBoundaryDecision = {
    allowed: false,
    reasonCode: "replay.real_side_effect_blocked",
    blockedOperationIds: ["op-1", "op-2"],
  };
  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(decision.blockedOperationIds, ["op-1", "op-2"]);
});

test("ReplayBoundaryDecision interface structure - tombstone boundary violation", () => {
  const decision: ReplayBoundaryDecision = {
    allowed: false,
    reasonCode: "replay.tombstone_boundary_violation",
    blockedOperationIds: ["op-3"],
  };
  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "replay.tombstone_boundary_violation");
  assert.deepEqual(decision.blockedOperationIds, ["op-3"]);
});

test("evaluate allows empty operations array for trace_replay", () => {
  const guard = new ReplayBoundaryGuard();
  const result = guard.evaluate("trace_replay", []);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "replay.allowed");
  assert.deepEqual(result.blockedOperationIds, []);
});

test("evaluate allows empty operations array for reexecution_replay", () => {
  const guard = new ReplayBoundaryGuard();
  const result = guard.evaluate("reexecution_replay", []);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "replay.allowed");
  assert.deepEqual(result.blockedOperationIds, []);
});

test("evaluate allows empty operations array for projection_replay", () => {
  const guard = new ReplayBoundaryGuard();
  const result = guard.evaluate("projection_replay", []);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "replay.allowed");
  assert.deepEqual(result.blockedOperationIds, []);
});

test("evaluate blocks trace_replay with real side effect operation", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate allows trace_replay without real side effect", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: false,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "replay.allowed");
  assert.deepEqual(result.blockedOperationIds, []);
});

test("evaluate blocks reexecution_replay with real side effect", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("reexecution_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate blocks projection_replay with non-projection real side effect", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("projection_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate blocks tombstoneReplay on non-projection resource", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate blocks tombstoneReplay on projection resource outside reexecution replay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate allows tombstoneReplay on llm resource kind", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "llm",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate allows tombstoneReplay on connector resource kind", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "connector",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate blocks multiple operations with real side effects in trace_replay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
    {
      operationId: "op-2",
      resourceKind: "llm",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(result.blockedOperationIds, ["op-1", "op-2"]);
});

test("evaluate handles mixed operations - some blocked, some allowed", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
    {
      operationId: "op-2",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
    {
      operationId: "op-3",
      resourceKind: "tool",
      hasRealSideEffect: false,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(result.blockedOperationIds, ["op-1"]);
});

test("evaluate blocks projection tombstones outside reexecution replay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
    {
      operationId: "op-2",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
  assert.deepEqual(result.blockedOperationIds, ["op-1", "op-2"]);
});

test("evaluate checks real side effect before tombstone violation", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
});

test("resourceKind tool is blocked with tombstoneReplay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-tool",
      resourceKind: "tool",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
});

test("resourceKind llm is blocked with tombstoneReplay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-llm",
      resourceKind: "llm",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
});

test("resourceKind connector is blocked with tombstoneReplay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-connector",
      resourceKind: "connector",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
});

test("resourceKind projection is blocked with tombstoneReplay outside reexecution replay", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-projection",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
});

test("reexecution_replay blocks real side effect", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
    {
      operationId: "op-2",
      resourceKind: "llm",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("reexecution_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
});

test("projection_replay blocks real side effect on non-projection resource", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("projection_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
});

test("reexecution_replay blocks tombstone boundary violation", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("reexecution_replay", operations);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.tombstone_boundary_violation");
});

test("reexecution_replay allows tombstone on projection", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: true,
    },
  ];
  const result = guard.evaluate("reexecution_replay", operations);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "replay.allowed");
});

test("trace_replay with all safe operations is allowed", () => {
  const guard = new ReplayBoundaryGuard();
  const operations: ReplayOperation[] = [
    {
      operationId: "op-1",
      resourceKind: "tool",
      hasRealSideEffect: false,
      tombstoneReplay: false,
    },
    {
      operationId: "op-2",
      resourceKind: "llm",
      hasRealSideEffect: false,
      tombstoneReplay: false,
    },
    {
      operationId: "op-3",
      resourceKind: "connector",
      hasRealSideEffect: false,
      tombstoneReplay: false,
    },
    {
      operationId: "op-4",
      resourceKind: "projection",
      hasRealSideEffect: false,
      tombstoneReplay: false,
    },
  ];
  const result = guard.evaluate("trace_replay", operations);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "replay.allowed");
  assert.deepEqual(result.blockedOperationIds, []);
});
