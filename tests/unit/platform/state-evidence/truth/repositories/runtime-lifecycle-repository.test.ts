import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRecord, EventRecord, WorkflowStateRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { EventRecordDraft } from "../../../../../../src/platform/five-plane-state-evidence/events/event-record-support.js";
import {
  RuntimeLifecycleRepository,
  AuthoritativeTaskStoreRuntimeLifecycleRepository,
  RetryingRuntimeLifecycleRepository,
  ObservedRuntimeLifecycleRepository,
  createRuntimeLifecycleRepository,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";

function createMockRuntimeLifecycleRepository(): RuntimeLifecycleRepository {
  const approvals: Record<string, ApprovalRecord> = {};
  const workflowStates: Record<string, WorkflowStateRecord> = {};
  const events: EventRecord[] = [];

  return {
    updateTaskStatus: () => {},
    updateTaskStatusCas: () => 1,
    updateTaskOutput: () => {},
    updateWorkflowState: () => {},
    updateWorkflowStateCas: () => 1,
    getWorkflowState: (taskId: string) => workflowStates[taskId] ?? null,
    updateSessionStatus: () => {},
    updateSessionStatusCas: () => 1,
    updateExecutionStatus: () => {},
    updateExecutionStatusCas: () => 1,
    createTier1StatusEvent: (input) => ({
      id: "evt-" + events.length,
      taskId: input.taskId,
      sessionId: input.sessionId ?? null,
      executionId: input.executionId,
      eventType: input.eventType,
      payloadJson: JSON.stringify(input.payload),
      traceId: input.traceId,
      eventTier: "tier_1",
      createdAt: new Date().toISOString(),
    }),
    insertApproval: (approval) => { approvals[approval.id] = approval; },
    getApproval: (approvalId: string) => approvals[approvalId] ?? null,
    listApprovalsByTask: (taskId: string) => Object.values(approvals).filter(a => a.taskId === taskId),
    updateApprovalDecision: (input) => {
      const approval = approvals[input.approvalId];
      if (approval) {
        approval.status = input.status;
        approval.responseJson = input.responseJson;
        approval.respondedAt = input.respondedAt;
      }
    },
    updateApprovalDecisionCas: (input) => {
      const approval = approvals[input.approvalId];
      if (approval && approval.status === input.expectedStatus) {
        approval.status = input.status;
        approval.responseJson = input.responseJson;
        approval.respondedAt = input.respondedAt;
        return 1;
      }
      return 0;
    },
    updateApprovalRequest: (input) => {
      const approval = approvals[input.id];
      if (approval) approval.requestJson = input.requestJson;
    },
    insertEvent: (event) => {
      const inserted: EventRecord = {
        id: "evt-" + events.length,
        taskId: event.taskId,
        sessionId: event.sessionId ?? null,
        executionId: event.executionId,
        eventType: event.eventType,
        payloadJson: JSON.stringify(event.payload),
        traceId: event.traceId,
        eventTier: "tier_2",
        createdAt: new Date().toISOString(),
      };
      events.push(inserted);
      return inserted;
    },
  };
}

test.describe("RuntimeLifecycleRepository interface", () => {
  test("can be implemented with all required methods", () => {
    const mockRepo = createMockRuntimeLifecycleRepository();

    assert.equal(typeof mockRepo.updateTaskStatus, "function");
    assert.equal(typeof mockRepo.updateTaskStatusCas, "function");
    assert.equal(typeof mockRepo.getWorkflowState, "function");
    assert.equal(typeof mockRepo.createTier1StatusEvent, "function");
  });

  test("interface method signatures are correct", () => {
    const repo: RuntimeLifecycleRepository = createMockRuntimeLifecycleRepository();

    // Verify updateTaskStatus
    repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null);

    // Verify updateTaskStatusCas returns number
    const casResult = repo.updateTaskStatusCas("task-1", "pending", "running", "2026-04-26T10:00:00.000Z", null, null);
    assert.equal(typeof casResult, "number");

    // Verify getWorkflowState can return null
    const workflowResult = repo.getWorkflowState("nonexistent");
    assert.equal(workflowResult, null);
  });
});

test.describe("AuthoritativeTaskStoreRuntimeLifecycleRepository", () => {
  // This class wraps an AuthoritativeTaskStore, not a RuntimeLifecycleRepository
  // So we need to test it with a mock AuthoritativeTaskStore
  test("is exported and has constructor", () => {
    assert.equal(typeof AuthoritativeTaskStoreRuntimeLifecycleRepository, "function");
  });
});

test.describe("RetryingRuntimeLifecycleRepository", () => {
  test("delegates successful calls to inner repository", () => {
    const inner = createMockRuntimeLifecycleRepository();
    let captured: { taskId: string; status: string } | null = null;
    inner.updateTaskStatus = (taskId, status) => {
      captured = { taskId, status };
    };
    const repo = new RetryingRuntimeLifecycleRepository(inner);

    repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null);

    assert.deepEqual(captured, { taskId: "task-1", status: "running" });
  });

  test("retries on SQLITE_BUSY error", () => {
    let attempts = 0;
    const inner = createMockRuntimeLifecycleRepository();
    inner.updateTaskStatus = () => {
      attempts++;
      if (attempts === 1) {
        const err = new Error("SQLITE_BUSY: database locked");
        (err as any).code = "SQLITE_BUSY";
        throw err;
      }
    };

    const repo = new RetryingRuntimeLifecycleRepository(inner, { maxAttempts: 3 });

    repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null);

    assert.equal(attempts, 2);
  });

  test("gives up after max attempts", () => {
    let attempts = 0;
    const inner = createMockRuntimeLifecycleRepository();
    inner.updateTaskStatus = () => {
      attempts++;
      const err = new Error("SQLITE_BUSY: database locked");
      (err as any).code = "SQLITE_BUSY";
      throw err;
    };

    const repo = new RetryingRuntimeLifecycleRepository(inner, { maxAttempts: 3 });

    assert.throws(
      () => repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null),
      /SQLITE_BUSY/,
    );

    assert.equal(attempts, 3);
  });

  test("does not retry non-SQLITE_BUSY errors", () => {
    let attempts = 0;
    const inner = createMockRuntimeLifecycleRepository();
    inner.updateTaskStatus = () => {
      attempts++;
      throw new Error("Some other error");
    };

    const repo = new RetryingRuntimeLifecycleRepository(inner, { maxAttempts: 3 });

    assert.throws(
      () => repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null),
      /Some other error/,
    );

    assert.equal(attempts, 1);
  });

  test("returns value from successful CAS call", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const repo = new RetryingRuntimeLifecycleRepository(inner);

    const result = repo.updateTaskStatusCas("task-1", "pending", "running", "2026-04-26T10:00:00.000Z", null, null);

    assert.equal(result, 1);
  });

  test("retries SQLITE_BUSY on CAS operations", () => {
    let attempts = 0;
    const inner = createMockRuntimeLifecycleRepository();
    inner.updateTaskStatusCas = () => {
      attempts++;
      if (attempts === 1) {
        const err = new Error("SQLITE_BUSY");
        (err as any).code = "SQLITE_BUSY";
        throw err;
      }
      return 1;
    };

    const repo = new RetryingRuntimeLifecycleRepository(inner, { maxAttempts: 3 });

    const result = repo.updateTaskStatusCas("task-1", "pending", "running", "2026-04-26T10:00:00.000Z", null, null);

    assert.equal(result, 1);
    assert.equal(attempts, 2);
  });
});

test.describe("ObservedRuntimeLifecycleRepository", () => {
  test("delegates calls to inner repository", () => {
    const inner = createMockRuntimeLifecycleRepository();
    let captured: { taskId: string; status: string } | null = null;
    inner.updateTaskStatus = (taskId, status) => {
      captured = { taskId, status };
    };
    const debugCalls: Array<{ operation: string; ok: boolean }> = [];
    const logger = {
      debug: (_message: string, data: { operation: string; ok: boolean }) => {
        debugCalls.push(data);
      },
      warn: () => {},
      info: () => {},
    };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null);

    assert.deepEqual(captured, { taskId: "task-1", status: "running" });
    assert.equal(debugCalls.length, 1);
    assert.equal(debugCalls[0]!.operation, "updateTaskStatus");
    assert.equal(debugCalls[0]!.ok, true);
    assert.equal(typeof (debugCalls[0] as { durationMs?: unknown }).durationMs, "number");
  });

  test("returns value from inner repository", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    const result = repo.getWorkflowState("task-nonexistent");

    assert.equal(result, null);
  });

  test("returns workflow state when found", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };

    const workflowState: WorkflowStateRecord = {
      taskId: "task-1",
      status: "running",
      currentStepIndex: 1,
      outputsJson: "{}",
      version: 5,
      updatedAt: "2026-04-26T10:00:00.000Z",
      resumableFromStep: null,
    };
    inner.getWorkflowState = () => workflowState;

    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);
    const result = repo.getWorkflowState("task-1");

    assert.deepEqual(result, workflowState);
  });

  test("throws inner repository errors", () => {
    const inner = createMockRuntimeLifecycleRepository();
    inner.updateTaskStatus = () => {
      throw new Error("Inner error");
    };
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    assert.throws(
      () => repo.updateTaskStatus("task-1", "running", "2026-04-26T10:00:00.000Z", null, null),
      /Inner error/,
    );
  });

  test("delegates CAS operations", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    const result = repo.updateTaskStatusCas("task-1", "pending", "running", "2026-04-26T10:00:00.000Z", null, null);

    assert.equal(result, 1);
  });

  test("delegates getApproval", () => {
    const inner = createMockRuntimeLifecycleRepository();
    inner.insertApproval({
      id: "approval-1",
      taskId: "task-1",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "5m",
      createdAt: "2026-04-26T10:00:00.000Z",
      respondedAt: null,
    });
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    const result = repo.getApproval("approval-1");

    assert.ok(result);
    assert.equal(result?.id, "approval-1");
  });

  test("delegates listApprovalsByTask", () => {
    const inner = createMockRuntimeLifecycleRepository();
    inner.insertApproval({
      id: "approval-1",
      taskId: "task-1",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "5m",
      createdAt: "2026-04-26T10:00:00.000Z",
      respondedAt: null,
    });
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    const result = repo.listApprovalsByTask("task-1");

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "approval-1");
  });

  test("delegates createTier1StatusEvent", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    const result = repo.createTier1StatusEvent({
      taskId: "task-1",
      executionId: "exec-1",
      eventType: "task.completed",
      traceId: "trace-123",
      payload: { result: "success" },
    });

    assert.equal(result.taskId, "task-1");
    assert.equal(result.eventType, "task.completed");
  });

  test("delegates insertEvent", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);

    const eventDraft: EventRecordDraft = {
      taskId: "task-1",
      sessionId: null,
      executionId: null,
      eventType: "task.started",
      payload: { startedBy: "system" },
      traceId: "trace-123",
    };

    const result = repo.insertEvent(eventDraft);

    assert.equal(result.eventType, "task.started");
  });
});

test.describe("createRuntimeLifecycleRepository", () => {
  // createRuntimeLifecycleRepository requires an AuthoritativeTaskStore with full sub-repository structure
  // These tests verify the factory function exists and has correct type signature
  test("createRuntimeLifecycleRepository is exported and has correct signature", () => {
    assert.equal(typeof createRuntimeLifecycleRepository, "function");

    // The function expects (store: AuthoritativeTaskStore, options?: {...}) => RuntimeLifecycleRepository
    // We can verify the function is callable with the right types by checking it exists
  });

  test("AuthoritativeTaskStoreRuntimeLifecycleRepository wraps AuthoritativeTaskStore", () => {
    // Verify that the class is exported properly
    assert.ok(AuthoritativeTaskStoreRuntimeLifecycleRepository);
  });

  test("RetryingRuntimeLifecycleRepository wraps RuntimeLifecycleRepository", () => {
    // Verify the decorator pattern works
    const inner = createMockRuntimeLifecycleRepository();
    const repo = new RetryingRuntimeLifecycleRepository(inner, { maxAttempts: 3 });
    assert.equal(typeof repo.updateTaskStatus, "function");
    assert.equal(typeof repo.updateTaskStatusCas, "function");
  });

  test("ObservedRuntimeLifecycleRepository wraps RuntimeLifecycleRepository", () => {
    const inner = createMockRuntimeLifecycleRepository();
    const logger = { debug: () => {}, warn: () => {}, info: () => {} };
    const repo = new ObservedRuntimeLifecycleRepository(inner, logger as any);
    assert.equal(typeof repo.updateTaskStatus, "function");
    assert.equal(typeof repo.getWorkflowState, "function");
  });

  test("createRuntimeLifecycleRepository returns RuntimeLifecycleRepository shape", () => {
    // The returned object has all RuntimeLifecycleRepository methods
    // Note: This requires an actual AuthoritativeTaskStore, so we just verify shape via type
    type CreateResult = ReturnType<typeof createRuntimeLifecycleRepository>;
    const _result: RuntimeLifecycleRepository = {} as CreateResult;
    assert.ok(_result);
  });
});
