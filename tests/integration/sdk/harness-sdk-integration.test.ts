/**
 * SDK/CLI Integration Tests - Harness SDK
 *
 * Tests the harness SDK methods that work with the current API
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";
import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";
import { SqliteDurableHarnessStore } from "../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../tests/helpers/fs.js";
import { join } from "node:path";

test("harness SDK: decide produces decision based on evaluator score", () => {
  const sdk = new HarnessSdk();

  const acceptDecision = sdk.decide({ evaluatorScore: 0.9 });
  assert.equal(acceptDecision.action, "accept");
  assert.ok(acceptDecision.confidence > 0);

  const replanDecision = sdk.decide({ evaluatorScore: 0.4 });
  assert.equal(replanDecision.action, "replan");

  const abortDecision = sdk.decide({ evaluatorScore: 0.3, maxIterationsReached: true });
  assert.equal(abortDecision.action, "abort");

  const humanDecision = sdk.decide({ evaluatorScore: 0.8, requiresHuman: true });
  assert.equal(humanDecision.action, "escalate_to_human");
});

test("harness SDK: restore returns null for unknown runId", () => {
  const sdk = new HarnessSdk();
  const restored = sdk.restore("nonexistent-run-id");
  assert.equal(restored, null);
});

test("harness SDK: restoreFromCheckpoint returns null for unknown checkpoint", () => {
  const sdk = new HarnessSdk();
  const restored = sdk.restoreFromCheckpoint("nonexistent-checkpoint");
  assert.equal(restored, null);
});

test("harness SDK: durable store integration - SqliteDurableHarnessStore save and get", () => {
  const workspace = createTempWorkspace("aa-harness-durable-");
  const dbPath = join(workspace, "harness-durable.db");

  try {
    const db = new DatabaseSync(dbPath);
    const store = new SqliteDurableHarnessStore(db);

    // Verify store is operational by creating and retrieving a record
    const testRunId = "test-run-" + Date.now();

    // Insert a test run directly using the store's saveRecord
    // We need to create a minimal run that satisfies the type requirements
    const testRun = {
      harnessRunId: testRunId,
      tenantId: "test-tenant",
      taskId: "task-001",
      domainId: "domain-test",
      status: "created" as const,
      constraintPack: {
        policyIds: [] as readonly string[],
        approvalMode: "none" as const,
        autonomyMode: "auto" as const,
        toolPolicy: { allowedTools: [] as readonly string[] },
        risk_policy: { maxRiskScore: 10, escalationThreshold: 9 },
        output_policy: { requiredEvidence: [] as readonly string[], redactSensitiveData: false },
        budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
      },
      planGraphBundle: {
        graph: {
          graphId: "graph-1",
          nodes: [],
          edges: [],
          entryNodeIds: [],
          terminalNodeIds: [],
          joinStrategy: "all" as const,
          graphHash: "hash123",
        },
      },
      steps: [],
      nodeRunIds: [],
      maxIterations: 10,
      currentIteration: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
      pauseReason: null,
      decision: null,
      contextSnapshots: [],
      sleepLease: null,
      recoveryCheckpoint: null,
      feedbackEnvelope: null,
      toolbelt: null,
      guardrailAssessment: null,
      hitlRequest: null,
      timeline: [],
    };

    // Use any to bypass strict type checking for test record construction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.saveRecord({
      recordId: "rec_test",
      run: testRun as any,
      checkpointRef: null,
      persistedAt: nowIso(),
    });

    const restored = store.getRecord(testRunId);
    assert.ok(restored !== null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});