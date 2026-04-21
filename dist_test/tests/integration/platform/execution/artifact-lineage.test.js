import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runSingleTaskExecution } from "../../../../src/platform/execution/execution-engine/single-task-execution.js";
import { runMultiStepOrchestration } from "../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function parseArtifacts(raw) {
    if (!raw) {
        return [];
    }
    return JSON.parse(raw);
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
    }
    finally {
        cleanupPath(workspace);
    }
});
test("multi-step orchestration stores one artifact snapshot per completed workflow step", async () => {
    const workspace = createTempWorkspace("aa-artifact-runtime-");
    const dbPath = join(workspace, "multi-step.db");
    try {
        const result = await runMultiStepOrchestration({
            dbPath,
            title: "Implement code change",
            request: "Analyze requirements, implement the patch, and review the output.",
        });
        assert.equal(result.snapshot.stepOutputs.length >= 3, true);
        for (const stepOutput of result.snapshot.stepOutputs) {
            const refs = parseArtifacts(stepOutput.artifactsJson);
            assert.equal(refs.length, 1);
            assert.equal(refs[0]?.kind, "workflow_step_snapshot");
            assert.equal(existsSync(refs[0]?.uri ?? ""), true);
        }
        const db = new SqliteDatabase(dbPath);
        const store = new AuthoritativeTaskStore(db);
        assert.equal(store.listArtifactsByTask(result.snapshot.task.id).length, result.snapshot.stepOutputs.length);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("workflow step snapshot artifacts include decision and resume checkpoint context", async () => {
    const workspace = createTempWorkspace("aa-artifact-runtime-");
    const dbPath = join(workspace, "multi-step-checkpoint.db");
    try {
        const result = await runMultiStepOrchestration({
            dbPath,
            title: "Checkpoint rich snapshot",
            request: "Analyze, draft, and review a change with stable recovery checkpoints.",
        });
        const finalStepOutput = result.snapshot.stepOutputs.at(-1);
        const refs = parseArtifacts(finalStepOutput?.artifactsJson ?? null);
        const persisted = JSON.parse(readFileSync(refs[0]?.uri ?? "", "utf8"));
        assert.equal(persisted.schemaVersion, "workflow_step_checkpoint.v1");
        assert.equal(persisted.decisionContext.source, "multi_step_orchestration");
        assert.equal(persisted.decisionContext.priorStepSummaries.length >= 2, true);
        assert.equal(persisted.resumeContext.completedStepIds.length, result.snapshot.stepOutputs.length);
        assert.equal(persisted.resumeContext.nextStepId, null);
        assert.equal(persisted.resumeContext.outputKeys.length, result.snapshot.stepOutputs.length);
        assert.equal(persisted.upstreamArtifactRefs.length >= 2, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=artifact-lineage.test.js.map