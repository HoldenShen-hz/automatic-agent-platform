import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionResourceCeilingFinding } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import {
  SkillExecutionService,
  type SkillDefinition,
  type SkillStepExecutionResult,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-execution-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createService(
  runner: (request: {
    skillId: string;
    skillVersion: string;
    executionId: string;
    taskId: string;
    traceId: string;
    stepId: string;
    toolName: string;
    attempt: number;
    maxAttempts: number;
    timeoutMs: number;
    recoveryStrategy: string;
    input: Record<string, unknown>;
  }) => Promise<{ success: boolean; summary?: string; output?: string; errorCode?: string | null; retryable?: boolean; durationMs?: number }>,
) {
  const workspace = createTempWorkspace("aa-skill-cache-methods-");
  const db = new SqliteDatabase(join(workspace, "skill-cache-methods.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  seedTaskAndExecution(db, store, {
    taskId: "task-cache-methods",
    executionId: "exec-cache-methods",
    traceId: "trace-cache-methods",
  });
  const service = new SkillExecutionService(db, store, runner);
  return { workspace, db, store, service };
}

test("getCacheEntry returns null for missing keys [skill-execution-cache-methods]", () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const result = service.getCacheEntry("missing-key", "2026-04-24T00:00:00.000Z");
    assert.equal(result, null);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("resolveCacheLookup and storeCacheEntry work together to cache and retrieve entries [skill-execution-cache-methods]", async () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const skill: SkillDefinition = {
      skillId: "cache-entry-test",
      version: "1.0.0",
      description: "Test cache entry",
      requiredTools: ["read"],
      cacheable: true,
      cacheTtlSeconds: 3600,
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const steps = [
      service.buildCachedStepResult({
        step: {
          stepId: "s1",
          requestedToolName: "read",
          resolvedToolName: "read",
          description: undefined,
          onFailure: "fail",
          maxAttempts: 1,
          input: undefined,
          modelOverrideApplied: false,
        },
        status: "succeeded",
        attempts: 1,
        maxAttempts: 1,
        result: { success: true, status: "succeeded", summary: "ok", retryable: false, durationMs: 5 },
      }),
    ];

    const firstLookup = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "abc123",
      parameters: { path: "test.txt" },
    });

    assert.equal(firstLookup.metadata.status, "miss");
    assert.ok(firstLookup.metadata.key);

    service.storeCacheEntry(skill, firstLookup.metadata, steps, 0);

    const secondLookup = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "abc123",
      parameters: { path: "test.txt" },
    });

    assert.equal(secondLookup.metadata.status, "hit");
    assert.ok(secondLookup.entry);
    assert.equal(secondLookup.entry?.skillId, "cache-entry-test");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("resolveCacheLookup returns miss for expired cached entries [skill-execution-cache-methods]", async () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const skill: SkillDefinition = {
      skillId: "expired-entry-test",
      version: "1.0.0",
      description: "Test expired entry",
      requiredTools: ["read"],
      cacheable: true,
      cacheTtlSeconds: 3600,
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const steps = [
      service.buildCachedStepResult({
        step: {
          stepId: "s1",
          requestedToolName: "read",
          resolvedToolName: "read",
          description: undefined,
          onFailure: "fail",
          maxAttempts: 1,
          input: undefined,
          modelOverrideApplied: false,
        },
        status: "succeeded",
        attempts: 1,
        maxAttempts: 1,
        result: { success: true, status: "succeeded", summary: "ok", retryable: false, durationMs: 5 },
      }),
    ];

    const firstLookup = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "abc123",
      parameters: { path: "test.txt" },
    });

    assert.ok(firstLookup.metadata.key);
    service.storeCacheEntry(skill, firstLookup.metadata, steps, 0);

    const cachedEntry = service.cache.get(firstLookup.metadata.key!);
    assert.ok(cachedEntry);
    cachedEntry!.expiresAt = "2000-01-01T00:00:00.000Z";

    const secondLookup = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "abc123",
      parameters: { path: "test.txt" },
    });

    assert.equal(secondLookup.metadata.status, "miss");
    assert.equal(service.cache.has(firstLookup.metadata.key!), false);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("publishEvent dispatches events through the event bus [skill-execution-cache-methods]", () => {
  const { workspace, db, store, service } = createService(async () => ({ success: true }));
  try {
    let publishedEvent: unknown = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service.bus as any).publish = function (event: unknown) {
      publishedEvent = event;
    };

    service.publishEvent(
      "skill:step_started",
      "task-cache-methods",
      "exec-cache-methods",
      "trace-cache-methods",
      {
        skillId: "test-skill",
        stepId: "step-1",
        toolName: "read",
        attempt: 1,
        maxAttempts: 3,
      },
    );

    assert.ok(publishedEvent);
    const event = publishedEvent as { eventType: string; taskId: string; executionId: string; traceId: string; payload: Record<string, unknown> };
    assert.equal(event.eventType, "skill:step_started");
    assert.equal(event.taskId, "task-cache-methods");
    assert.equal(event.executionId, "exec-cache-methods");
    assert.equal(event.traceId, "trace-cache-methods");
    assert.equal((event.payload as Record<string, unknown>).skillId, "test-skill");
    assert.equal((event.payload as Record<string, unknown>).stepId, "step-1");
    assert.equal((event.payload as Record<string, unknown>).toolName, "read");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("upsertAgentExecutionRecord creates new record when none exists [skill-execution-cache-methods]", () => {
  const { workspace, db, store, service } = createService(async () => ({ success: true }));
  try {
    const execution = store.dispatch.getExecution("exec-cache-methods")!;

    const record = service.upsertAgentExecutionRecord("exec-cache-methods", {
      execution,
      planJson: '{"skillId":"test"}',
      status: "skill_running",
      currentStepId: "step-1",
      lastToolName: "read",
      toolCallCount: 5,
      retryCount: 1,
      progressMessage: "test:running",
      lastErrorCode: null,
      startedAt: "2026-04-24T00:00:00.000Z",
      completedAt: null,
      lastDecisionJson: null,
      occurredAt: "2026-04-24T00:00:01.000Z",
    });

    assert.equal(record.executionId, "exec-cache-methods");
    assert.equal(record.taskId, "task-cache-methods");
    assert.equal(record.status, "skill_running");
    assert.equal(record.toolCallCount, 5);
    assert.equal(record.retryCount, 1);
    assert.equal(record.lastToolName, "read");
    assert.ok(record.startedAt);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("upsertAgentExecutionRecord merges tool call counts when existing record found [skill-execution-cache-methods]", () => {
  const { workspace, db, store, service } = createService(async () => ({ success: true }));
  try {
    const execution = store.dispatch.getExecution("exec-cache-methods")!;

    service.upsertAgentExecutionRecord("exec-cache-methods", {
      execution,
      planJson: '{"skillId":"test"}',
      status: "skill_running",
      currentStepId: "step-1",
      lastToolName: "read",
      toolCallCount: 3,
      retryCount: 0,
      progressMessage: "test:started",
      lastErrorCode: null,
      startedAt: "2026-04-24T00:00:00.000Z",
      completedAt: null,
      lastDecisionJson: null,
      occurredAt: "2026-04-24T00:00:01.000Z",
    });

    const updatedRecord = service.upsertAgentExecutionRecord("exec-cache-methods", {
      execution,
      planJson: '{"skillId":"test"}',
      status: "skill_running",
      currentStepId: "step-2",
      lastToolName: "bash",
      toolCallCount: 7,
      retryCount: 2,
      progressMessage: "test:retrying",
      lastErrorCode: "tool.timeout",
      startedAt: "2026-04-24T00:00:00.000Z",
      completedAt: null,
      lastDecisionJson: null,
      occurredAt: "2026-04-24T00:00:02.000Z",
    });

    assert.equal(updatedRecord.toolCallCount, 7);
    assert.equal(updatedRecord.retryCount, 2);
    assert.equal(updatedRecord.lastToolName, "bash");
    assert.equal(updatedRecord.currentStepId, "step-2");
    assert.equal(updatedRecord.progressMessage, "test:retrying");
    assert.equal(updatedRecord.lastErrorCode, "tool.timeout");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("buildCachedStepResult calculates retryCount from attempts [skill-execution-cache-methods]", () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const result = service.buildCachedStepResult({
      step: {
        stepId: "s1",
        requestedToolName: "read",
        resolvedToolName: "read",
        description: undefined,
        onFailure: "fail",
        maxAttempts: 3,
        input: undefined,
        modelOverrideApplied: false,
      },
      status: "succeeded",
      attempts: 2,
      maxAttempts: 3,
      result: { success: true, status: "succeeded", summary: "ok", retryable: false, durationMs: 10 },
    });

    assert.equal(result.stepId, "s1");
    assert.equal(result.attempts, 2);
    assert.equal(result.retryCount, 1);
    assert.equal(result.status, "succeeded");
    assert.equal(result.durationMs, 10);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("buildCachedStepResult marks continuedAfterFailure for partial_success status [skill-execution-cache-methods]", () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const result = service.buildCachedStepResult({
      step: {
        stepId: "s1",
        requestedToolName: "read",
        resolvedToolName: "read",
        description: undefined,
        onFailure: "continue",
        maxAttempts: 3,
        input: undefined,
        modelOverrideApplied: false,
      },
      status: "partial_success",
      attempts: 1,
      maxAttempts: 3,
      result: { success: false, status: "failed", summary: "error", errorCode: "tool.timeout", retryable: false, durationMs: 0 },
    });

    assert.equal(result.status, "partial_success");
    assert.equal(result.continuedAfterFailure, true);
    assert.equal(result.errorCode, "tool.timeout");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("buildStepOutput embeds skill metadata in dataJson [skill-execution-cache-methods]", () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const skill: SkillDefinition = {
      skillId: "step-output-metadata",
      version: "2.0.0",
      description: "Test step output",
      requiredTools: ["read"],
      cacheable: true,
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const stepOutput = service.buildStepOutput(
      "task-cache-methods",
      skill,
      {
        stepId: "s1",
        requestedToolName: "read",
        resolvedToolName: "read",
        status: "succeeded",
        attempts: 1,
        maxAttempts: 1,
        retryCount: 0,
        continuedAfterFailure: false,
        errorCode: null,
        summary: "read completed",
        output: "file contents",
        data: { byteCount: 100 },
        onFailure: "fail",
        durationMs: 15,
      },
      {
        eligible: true,
        enabled: true,
        status: "miss",
        key: "miss-key",
        workingDirectory: null,
        gitHead: null,
        sourceHash: null,
        storedAt: null,
        expiresAt: null,
        reason: null,
      },
    );

    const data = JSON.parse(stepOutput.dataJson) as Record<string, unknown>;
    assert.equal(data.skillId, "step-output-metadata");
    assert.equal(data.skillVersion, "2.0.0");
    assert.equal(data.requestedToolName, "read");
    assert.equal(data.toolName, "read");
    assert.equal(data.attempts, 1);
    assert.equal(data.output, "file contents");
    assert.equal(stepOutput.summary, "read completed");
    assert.equal(stepOutput.durationMs, 15);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("finalizeResourceLimitFailure records failure and updates execution record [skill-execution-cache-methods]", async () => {
  const { workspace, db, store, service } = createService(async () => ({ success: true }));
  try {
    const execution = store.dispatch.getExecution("exec-cache-methods")!;
    const skill: SkillDefinition = {
      skillId: "resource-limit-test",
      version: "1.0.0",
      description: "Test resource limit",
      requiredTools: ["read"],
      cacheable: true,
      cacheTtlSeconds: 3600,
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const steps: SkillStepExecutionResult[] = [];
    const cacheLookup = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "abc",
      parameters: {},
    });

    const finding: ExecutionResourceCeilingFinding = {
      executionId: "exec-cache-methods",
      taskId: "task-cache-methods",
      agentId: execution.agentId,
      status: "skill_running",
      runtimeInstanceId: null,
      currentStepId: "s1",
      observedAt: "2026-04-24T00:00:01.000Z",
      dimension: "tool_calls",
      reasonCode: "agent.resource_limit.tool_calls_exceeded",
      actual: 5,
      limit: 5,
      unit: "count",
      message: "Tool call limit exceeded",
    };

    const result = service.finalizeResourceLimitFailure({
      execution,
      skill,
      cacheMetadata: cacheLookup.metadata,
      planJson: '{"skillId":"resource-limit-test"}',
      steps,
      step: {
        stepId: "s1",
        requestedToolName: "read",
        resolvedToolName: "read",
        description: undefined,
        onFailure: "fail",
        maxAttempts: 1,
        input: undefined,
        modelOverrideApplied: false,
      },
      totalToolCalls: 5,
      totalRetries: 0,
      startedAt: "2026-04-24T00:00:00.000Z",
      occurredAt: "2026-04-24T00:00:01.000Z",
      finding,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.skillId, "resource-limit-test");
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0]!.status, "failed");
    assert.equal(result.steps[0]!.errorCode, "agent.resource_limit.tool_calls_exceeded");

    const snapshot = store.loadTaskSnapshot("task-cache-methods");
    assert.ok(snapshot.events.some((e) => e.eventType === "skill:execution_completed"));
    assert.ok(snapshot.events.some((e) => e.eventType === "skill:step_failed"));
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("storeCacheEntry respects cacheMaxEntries when evicting oldest entry [skill-execution-cache-methods]", async () => {
  const { workspace, db, service } = createService(async () => ({ success: true }));
  try {
    const skill: SkillDefinition = {
      skillId: "eviction-test",
      version: "1.0.0",
      description: "Test eviction",
      requiredTools: ["read"],
      cacheable: true,
      cacheTtlSeconds: 3600,
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const steps = [
      service.buildCachedStepResult({
        step: {
          stepId: "s1",
          requestedToolName: "read",
          resolvedToolName: "read",
          description: undefined,
          onFailure: "fail",
          maxAttempts: 1,
          input: undefined,
          modelOverrideApplied: false,
        },
        status: "succeeded",
        attempts: 1,
        maxAttempts: 1,
        result: { success: true, status: "succeeded", summary: "ok", retryable: false, durationMs: 5 },
      }),
    ];

    for (let i = 0; i < 3; i++) {
      const lookup = await service.resolveCacheLookup(skill, {
        enabled: true,
        sourceHash: `hash${i}`,
        parameters: { path: `${i}.txt` },
      });
      service.storeCacheEntry(skill, lookup.metadata, steps, 0);
    }

    assert.ok(service.cache.size <= 3);

  } finally {
    db.close();
    cleanupPath(workspace);
  }
});