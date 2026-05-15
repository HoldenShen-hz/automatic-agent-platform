import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-execution.js";
import { runMultiStepOrchestration } from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function parseArtifacts(raw: string | null): Array<{ artifactId: string; uri: string; kind: string }> {
  if (!raw) {
    return [];
  }
  return JSON.parse(raw) as Array<{ artifactId: string; uri: string; kind: string }>;
}

test("single-task execution stores a step artifact snapshot and indexes it", async () => {
  const workspace = createTempWorkspace("aa-artifact-runtime-");
  const dbPath = join(workspace, "single-task.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Artifact task",
      request: "Persist a recoverable artifact snapshot.",
    });
    const stepArtifacts = parseArtifacts(snapshot.stepOutputs[0]?.artifactsJson ?? null);

    assert.equal(stepArtifacts.length, 1);
    assert.equal(stepArtifacts[0]?.kind, "workflow_step_snapshot");
    assert.equal(existsSync(stepArtifacts[0]?.uri ?? ""), true);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const indexedArtifacts = store.listArtifactsByTask(snapshot.task.id);

    assert.equal(indexedArtifacts.length, 1);
    assert.equal(indexedArtifacts[0]?.artifactId, stepArtifacts[0]?.artifactId);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration stores one artifact snapshot per completed workflow step", async () => {
  const workspace = createTempWorkspace("aa-artifact-runtime-");
  const dbPath = join(workspace, "multi-step.db");

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Full Workflow Test",
      request: "Execute a complete multi-step workflow",
      stepOutputOverrides: {
        intake_triage: {
          summary: "Triaged the request",
          result: "Request triaged successfully",
          data: { nextStep: "code_generation" },
        },
      },
    });

    const completedStepOutputs = result.snapshot.stepOutputs.filter((stepOutput) => stepOutput.status === "succeeded");
    assert.equal(completedStepOutputs.length >= 1, true);
    for (const stepOutput of completedStepOutputs) {
      const refs = parseArtifacts(stepOutput.artifactsJson);
      assert.equal(refs.length, 1);
      assert.equal(refs[0]?.kind, "workflow_step_snapshot");
      assert.equal(existsSync(refs[0]?.uri ?? ""), true);
    }

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    assert.equal(
      store.listArtifactsByTask(result.snapshot.task.id).length,
      completedStepOutputs.length,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow step snapshot artifacts include decision and resume checkpoint context", async () => {
  const workspace = createTempWorkspace("aa-artifact-runtime-");
  const dbPath = join(workspace, "multi-step-checkpoint.db");

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Full Workflow Test",
      request: "Execute a complete multi-step workflow",
      stepOutputOverrides: {
        intake_triage: {
          summary: "Triaged the request",
          result: "Request triaged successfully",
          data: { nextStep: "code_generation" },
        },
      },
    });

    const finalStepOutput = result.snapshot.stepOutputs.filter((stepOutput) => stepOutput.status === "succeeded").at(-1);
    const refs = parseArtifacts(finalStepOutput?.artifactsJson ?? null);
    const persisted = JSON.parse(readFileSync(refs[0]?.uri ?? "", "utf8")) as {
      schemaVersion: string;
      decisionContext: {
        source: string;
        priorStepSummaries: string[];
      };
      resumeContext: {
        completedStepIds: string[];
        nextStepId: string | null;
        outputKeys: string[];
      };
      upstreamArtifactRefs: Array<{ artifactId: string }>;
    };

    assert.equal(persisted.schemaVersion, "workflow_step_checkpoint.v1");
    assert.equal(persisted.decisionContext.source, "multi_step_orchestration");
    assert.equal(Array.isArray(persisted.decisionContext.priorStepSummaries), true);
    assert.equal(persisted.resumeContext.completedStepIds.length, result.snapshot.stepOutputs.length);
    assert.equal(persisted.resumeContext.nextStepId, null);
    assert.equal(persisted.resumeContext.outputKeys.length, result.snapshot.stepOutputs.length);
    assert.equal(Array.isArray(persisted.upstreamArtifactRefs), true);
  } finally {
    cleanupPath(workspace);
  }
});
