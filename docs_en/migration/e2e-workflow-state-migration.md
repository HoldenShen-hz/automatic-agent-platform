# E2E Test Migration: insertWorkflowState to runMultiStepOrchestration

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
    h.store.insertWorkflowState({   // <-- LEGACY API
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

  // Then manually update workflow state...
  h.db.transaction(() => {
    h.store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step0_output: "result" }), now, null);
  });
});
```

### NEW Pattern (Canonical - Preferred)

#### Option A: Full Execution via runMultiStepOrchestration (Recommended for E2E)

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
    // Optional: override step outputs for testing
    stepOutputOverrides: {
      "step_0": { step0_output: "result_from_step_0" },
      "step_1": { step1_output: "result_from_step_1" },
    },
    // Optional: inject step failures
    stepFailureInjection: new Set(["step_1"]),
    stepFailurePlans: {
      "step_1": [{ errorCode: "workflow.step_failed", summary: "Step 1 failed" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify result structure
    assert.ok(result.snapshot, "Should have snapshot");
    assert.ok(result.snapshot.task, "Should have task");
    assert.ok(result.plannedWorkflow, "Should have planned workflow");
    assert.ok(result.plannedWorkflow.executionSteps, "Should have execution steps");

    // Verify workflow completion
    const task = result.snapshot.task;
    // Task should be in terminal state
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});
```

#### Option B: Using oapeflir://plan for explicit step definitions

```typescript
test("canonical: explicit workflow plan", async () => {
  const dbPath = join(__dirname, "test-explicit-plan.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_1",
      dependencies: [],
      outputs: ["output_1"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
    {
      stepId: "step_2",
      dependencies: ["step_1"],  // step_2 depends on step_1
      outputs: ["output_2"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Explicit Plan Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"));
    // Verify step ordering and outputs
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});
```

#### Option C: RuntimeTruthRepository with seed() for Unit Tests

```typescript
import { RuntimeTruthRepository } from "../../src/platform/five-plane-state-evidence/truth/runtime-truth-repository.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { createHarnessRun, createBudgetLedger, createRunVersionLock } from "../../src/platform/contracts/executable-contracts/index.js";

test("canonical: RuntimeTruthRepository seed pattern", () => {
  const repo = new RuntimeTruthRepository();

  // Create harness run via canonical factory
  const budgetLedger = createBudgetLedger({
    tenantId: "tenant:local",
    budgetPlanRef: "plan:default",
  });
  const runVersionLock = createRunVersionLock({
    harnessRunId: "hrun_test_001",
    runtimeProfileVersion: "runtime-profile:default",
  });
  const harnessRun = createHarnessRun({
    tenantId: "tenant:local",
    confirmedTaskSpecId: "spec:test",
    requestEnvelopeId: "req:test",
    requestHash: "hash:test",
    constraintPackRef: "constraint:default",
    versionLockId: runVersionLock.runVersionLockId,
    budgetLedgerId: budgetLedger.budgetLedgerId,
    status: "created",
  });

  // Seed the repository with initial state
  repo.seed("BudgetLedger", budgetLedger);
  repo.seed("RunVersionLock", runVersionLock);
  repo.seed("HarnessRun", harnessRun);

  // Use transition() to advance state
  const result = repo.transition({
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    command: { type: "admit" },
    auditRef: "test:admit",
  });

  assert.ok(result.event, "Should emit event");
  assert.equal(result.aggregate.status, "admitted", "Status should update");
});
```

## Migration Cheat Sheet

| Legacy API | Canonical Replacement |
|------------|----------------------|
| `store.insertWorkflowState()` | `runMultiStepOrchestration()` |
| `store.updateWorkflowState()` | `runMultiStepOrchestration()` handles automatically |
| `store.insertTask()` + `store.insertExecution()` | `runMultiStepOrchestration()` creates all |
| `store.insertSession()` | `runMultiStepOrchestration()` creates session |
| `TransitionService` for workflow state | `runMultiStepOrchestration()` handles state transitions |
| Manual `WorkflowStateRecord` manipulation | Built into `MultiStepOrchestrationResult.snapshot` |

## File Inventory (27+ files to migrate)

### E2E Tests (use Option A or B)
- `tests/e2e/multi-step-workflow.test.ts` — **PRIMARY EXAMPLE**
- `tests/e2e/access-governance-flow.test.ts`
- `tests/e2e/agent-delegation-workflow-e2e.test.ts`
- `tests/e2e/approval-event-flow.test.ts`
- `tests/e2e/approval-flows.test.ts`
- `tests/e2e/approval-state-transition-e2e.test.ts`
- `tests/e2e/billing-revenue-collection-flow.test.ts`
- `tests/e2e/budget-enforcement-flow.test.ts`
- `tests/e2e/checkpoint-artifact-flow.test.ts`
- `tests/e2e/compensation-manager-e2e.test.ts`
- `tests/e2e/context-compaction-e2e.test.ts`
- `tests/e2e/critical-workflows.test.ts`
- `tests/e2e/delegation-chain-flow.test.ts`
- `tests/e2e/dispatch-ticket-lifecycle.test.ts`

### Integration Tests (use Option A)
- `tests/integration/cross-plane-event-propagation.test.ts`
- `tests/integration/core/runtime/kernel.test.ts`
- `tests/integration/platform/platform-wide-integration.test.ts`
- `tests/integration/platform/five-plane-interface/scheduler.test.ts`
- `tests/integration/platform/five-plane-state-evidence/truth/async-repositories/workflow-repository.test.ts`

### Unit Tests (use Option C for complex scenarios)
- `tests/unit/platform/five-plane-state-evidence/truth/authoritative-task-store.test.ts`
- `tests/unit/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store.test.ts`
- `tests/unit/platform/five-plane-state-evidence/truth/async-repositories/workflow-repository.test.ts`
- `tests/unit/platform/five-plane-state-evidence/truth/repositories/workflow-repository.test.ts`
- `tests/unit/runtime/execution-dispatch-service.test.ts`
- `tests/unit/runtime/transition-service.test.ts`

## Key Result Properties

After migration, access workflow state via `result.snapshot`:

```typescript
const result = await runMultiStepOrchestration(input);

// Snapshot contains:
result.snapshot.task          // TaskRecord
result.snapshot.execution     // ExecutionRecord | null
result.snapshot.workflow      // WorkflowStateRecord | null
result.snapshot.session       // SessionRecord | null

// Also available:
result.plannedWorkflow.workflow        // PlanGraph workflow definition
result.plannedWorkflow.executionSteps  // Step execution plan
result.routing                          // IntakeRouteDecision
result.compaction                      // ContextCompactionResult | null
result.streamFrames                    // StreamEventFrame[]
```

## Verification

Run the migrated test:
```bash
npm run build && node --test dist/tests/e2e/multi-step-workflow.test.js
```

Compare behavior between legacy and canonical:
```bash
# Before (legacy - should fail or show old behavior)
# After (canonical - should show new behavior)
```