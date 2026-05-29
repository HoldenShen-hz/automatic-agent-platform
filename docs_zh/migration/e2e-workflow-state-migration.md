# E2E Test Migration: insertWorkflowState → runMultiStepOrchestration

> **Canonical location**: `docs_zh/migration/`
## Issue Reference

R18-17, R18-18, R18-19: E2E tests still use legacy WorkflowStateRecord API

## Root Cause

E2E tests were written against the old direct-insert API (`store.insertWorkflowState()`) and bypass the canonical execution path through `runMultiStepOrchestration()`.

## Migration Pattern

### OLD Pattern (Legacy - Do Not Use)

```typescript
import { WorkflowStateRecord } from "../../src/platform/contracts/types/domain.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-workflow.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);
  return { workspace, db, store, transitions };
}

test("legacy: multi-step workflow", () => {
  const h = createE2eHarness("e2e-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const now = nowIso();

  h.db.transaction(() => {
    h.store.insertTask({ /* ... */ });
    h.store.insertExecution({ /* ... */ });
    h.store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId: "multi_step_test",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
  });
});
```

### NEW Pattern (Canonical - Preferred)

#### Option A: Full Execution via runMultiStepOrchestration

```typescript
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import { runMultiStepOrchestration, type MultiStepToolExecutionInput } from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

test("canonical: multi-step workflow via runMultiStepOrchestration", async () => {
  const dbPath = join(__dirname, "test-canonical-workflow.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Multi-step workflow test",
    request: "Run multi-step test with steps",
    stepOutputOverrides: {
      "step_0": { step0_output: "result_from_step_0" },
      "step_1": { step1_output: "result_from_step_1" },
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot, "Should have snapshot");
    assert.ok(result.plannedWorkflow, "Should have planned workflow");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});
```
