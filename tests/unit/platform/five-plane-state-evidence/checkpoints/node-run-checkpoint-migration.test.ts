import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  NODE_RUN_CHECKPOINT_SCHEMA_VERSION,
  createNodeRunCheckpoint,
  readNodeRunCheckpoint,
  summarizeNodeRunCheckpoint,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";

test("createNodeRunCheckpoint writes canonical node-run fields", () => {
  const checkpoint = createNodeRunCheckpoint({
    harnessRunId: "harness-run-1",
    nodeRunId: "node-run-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 3,
    planGraphId: "graph-1",
    nodeId: "node-1",
    taskId: "task-1",
    executionId: "exec-1",
    divisionId: "division-1",
    roleId: "role-1",
    outputKey: "result",
    status: "succeeded",
    producedAt: "2026-05-08T00:00:00.000Z",
    output: { summary: "done" },
    decisionContext: {
      source: "multi_step_orchestration",
      request: "run the plan",
      routeReason: "dependency satisfied",
      priorNodeSummaries: ["node-a completed"],
      dependsOnNodeIds: ["node-a"],
    },
    resumeContext: {
      completedNodeIds: ["node-a", "node-1"],
      nextNodeId: "node-2",
      outputKeys: ["result"],
    },
  });

  assert.equal(checkpoint.schemaVersion, NODE_RUN_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(checkpoint.nodeRunId, "node-run-1");
  assert.equal(checkpoint.graphVersion, 3);
  assert.deepEqual(checkpoint.decisionContext.dependsOnNodeIds, ["node-a"]);
  assert.deepEqual(checkpoint.resumeContext.completedNodeIds, ["node-a", "node-1"]);
});

test("readNodeRunCheckpoint only accepts node_run_snapshot artifacts", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "node-run-checkpoint-"));
  try {
    const storagePath = join(tempDir, "node-run-1.json");
    const checkpoint = createNodeRunCheckpoint({
      harnessRunId: "harness-run-1",
      nodeRunId: "node-run-1",
      planGraphBundleId: "bundle-1",
      graphVersion: 2,
      planGraphId: "graph-1",
      nodeId: "node-1",
      taskId: "task-1",
      executionId: null,
      divisionId: "division-1",
      roleId: "role-1",
      outputKey: "result",
      status: "succeeded",
      producedAt: "2026-05-08T00:00:00.000Z",
      output: { summary: "done" },
      decisionContext: {
        source: "single_task_execution",
        request: "run",
        routeReason: null,
        priorNodeSummaries: [],
        dependsOnNodeIds: [],
      },
      resumeContext: {
        completedNodeIds: ["node-1"],
        nextNodeId: null,
        outputKeys: ["result"],
      },
    });
    writeFileSync(storagePath, JSON.stringify(checkpoint), "utf8");

    const artifactRecord = {
      artifactId: "artifact-1",
      taskId: "task-1",
      executionId: null,
      stepId: "node-1",
      kind: "node_run_snapshot",
      storagePath,
      fileName: "node-run-1.json",
      mimeType: "application/json",
      sizeBytes: 0,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-08T00:00:00.000Z",
    };

    const restored = readNodeRunCheckpoint(artifactRecord);
    assert.ok(restored);
    assert.equal(restored.nodeRunId, "node-run-1");
    assert.equal(restored.planGraphId, "graph-1");

    const summary = summarizeNodeRunCheckpoint("artifact-1", restored);
    assert.equal(summary.nextNodeId, null);
    assert.equal(summary.summary, "done");

    const legacyRecord = {
      ...artifactRecord,
      kind: "workflow_step_snapshot",
    };
    assert.equal(readNodeRunCheckpoint(legacyRecord), null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
