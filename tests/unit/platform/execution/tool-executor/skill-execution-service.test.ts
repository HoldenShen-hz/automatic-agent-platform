import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { ExecutionResourceCeilingGuard } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import {
  SkillExecutionService,
  type SkillDefinition,
  type SkillExecutionServiceOptions,
  type SkillToolCallRequest,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-execution-service.js";
import type { ToolExecutionMetadata } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createService(
  runner: (request: SkillToolCallRequest) =>
    | {
    success: boolean;
    summary?: string;
    output?: string;
    errorCode?: string | null;
    retryable?: boolean;
    durationMs?: number;
    }
    | Promise<{
      success: boolean;
      summary?: string;
      output?: string;
      errorCode?: string | null;
      retryable?: boolean;
      durationMs?: number;
    }>,
  options: SkillExecutionServiceOptions = {},
): {
  workspace: string;
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  inspect: InspectService;
  service: SkillExecutionService;
} {
  const workspace = createTempWorkspace("aa-skill-exec-unit-");
  const db = new SqliteDatabase(join(workspace, "skill-execution.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  seedTaskAndExecution(db, store, {
    taskId: "task-skill",
    executionId: "exec-skill",
    traceId: "trace-skill",
  });

  return {
    workspace,
    db,
    store,
    inspect: new InspectService(store),
    service: new SkillExecutionService(db, store, runner, options),
  };
}

test("skill execution service records retries, step outputs, and completion evidence", async () => {
  const attempts = new Map<string, number>();
  const skill: SkillDefinition = {
    skillId: "add_unit_test",
    version: "1.0.0",
    description: "Add and run a unit test.",
    requiredTools: ["read", "bash"],
    steps: [
      {
        stepId: "read_source",
        toolName: "read",
      },
      {
        stepId: "run_tests",
        toolName: "bash",
        onFailure: "retry",
        maxAttempts: 2,
      },
    ],
  };

  const { workspace, db, inspect, service, store } = createService((request) => {
    const key = `${request.stepId}:${request.attempt}`;
    attempts.set(key, 1);
    if (request.stepId === "run_tests" && request.attempt === 1) {
      return {
        success: false,
        summary: "Tests failed on first attempt.",
        output: "1 failing test",
        errorCode: "bash.test_failed",
        retryable: true,
        durationMs: 10,
      };
    }
    return {
      success: true,
      summary: `${request.stepId} ok`,
      output: "ok",
      durationMs: 5,
    };
  });

  try {
    const result = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["read", "bash"],
    });
    const taskInspect = inspect.getTaskInspectView("task-skill");
    const executionInspect = inspect.getExecutionInspectView("exec-skill");
    const snapshot = store.loadTaskSnapshot("task-skill");

    assert.equal(result.status, "succeeded");
    assert.equal(result.retryCount, 1);
    assert.equal(result.cache.status, "ineligible");
    assert.deepEqual(
      result.steps.map((step) => [step.stepId, step.status, step.retryCount]),
      [
        ["read_source", "succeeded", 0],
        ["run_tests", "succeeded", 1],
      ],
    );
    assert.equal(taskInspect.agentExecutions.length, 1);
    assert.equal(taskInspect.agentExecutions[0]?.status, "skill_succeeded");
    assert.equal(taskInspect.agentExecutions[0]?.toolCallCount, 3);
    assert.equal(taskInspect.agentExecutions[0]?.retryCount, 1);
    assert.equal(executionInspect.agentExecution?.lastToolName, "bash");
    assert.equal(taskInspect.stepOutputs.length, 2);
    assert.equal(taskInspect.stepOutputs[1]?.summary, "run_tests ok");
    assert.ok(snapshot.events.some((event) => event.eventType === "skill:retry_scheduled"));
    assert.ok(snapshot.events.some((event) => event.eventType === "skill:step_failed"));
    assert.ok(snapshot.events.some((event) => event.eventType === "skill:execution_completed"));
    assert.equal(attempts.has("run_tests:1"), true);
    assert.equal(attempts.has("run_tests:2"), true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service applies tool metadata timeout defaults and retries timed out steps", async () => {
  const observedTimeouts: number[] = [];
  const metadata: ToolExecutionMetadata = {
    toolName: "slow_read",
    readOnly: true,
    idempotent: true,
    sideEffectScope: "none",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "none",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 20,
    maxOutputBytes: 20_000,
    retryableErrorCodes: ["tool.timeout"],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
  };
  const skill: SkillDefinition = {
    skillId: "slow_read_retry",
    version: "1.0.0",
    description: "Retry a timed out read step.",
    requiredTools: ["slow_read"],
    steps: [
      {
        stepId: "read_source",
        toolName: "slow_read",
        onFailure: "retry",
        maxAttempts: 2,
      },
    ],
  };

  const { workspace, db, inspect, service, store } = createService(
    async (request) => {
      observedTimeouts.push(request.timeoutMs);
      if (request.attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, request.timeoutMs + 25));
        return {
          success: true,
          summary: "late success should be ignored",
          output: "late",
        };
      }
      return {
        success: true,
        summary: "read ok",
        output: "ok",
        durationMs: 3,
      };
    },
    {
      toolMetadataResolver: (toolName) => toolName === "slow_read" ? metadata : null,
    },
  );

  try {
    const result = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["slow_read"],
    });
    const snapshot = store.loadTaskSnapshot("task-skill");
    const executionInspect = inspect.getExecutionInspectView("exec-skill");

    assert.equal(result.status, "succeeded");
    assert.equal(result.retryCount, 1);
    assert.deepEqual(observedTimeouts, [20, 20]);
    assert.equal(result.steps[0]?.retryCount, 1);
    assert.equal(executionInspect.agentExecution?.retryCount, 1);
    assert.ok(snapshot.events.some((event) => event.eventType === "skill:retry_scheduled"));
    assert.ok(snapshot.events.some((event) => event.eventType === "skill:step_failed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service fail-closes retry decisions to metadata allowlisted errors", async () => {
  const metadata: ToolExecutionMetadata = {
    toolName: "guarded_write",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "local_file",
    recoveryStrategy: "manual_resume_required",
    requiresConfirmation: false,
    riskLevel: "high",
    needsFileLock: "write",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "structured_json",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 100,
    maxOutputBytes: 20_000,
    retryableErrorCodes: ["tool.timeout"],
    approvalMode: "policy_driven",
    supportsCancellation: false,
    cleanupGuarantee: "required",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
  };
  const skill: SkillDefinition = {
    skillId: "guarded_write",
    version: "1.0.0",
    description: "Do not retry non-allowlisted write failures.",
    requiredTools: ["guarded_write"],
    steps: [
      {
        stepId: "apply_write",
        toolName: "guarded_write",
        onFailure: "retry",
        maxAttempts: 3,
      },
    ],
  };

  let attemptCount = 0;
  const { workspace, db, service, store } = createService(
    () => {
      attemptCount += 1;
      return {
        success: false,
        summary: "write failed",
        errorCode: "tool.execution_failed",
        retryable: true,
      };
    },
    {
      toolMetadataResolver: (toolName) => toolName === "guarded_write" ? metadata : null,
    },
  );

  try {
    const result = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["guarded_write"],
    });
    const snapshot = store.loadTaskSnapshot("task-skill");

    assert.equal(result.status, "failed");
    assert.equal(result.retryCount, 0);
    assert.equal(result.steps[0]?.attempts, 1);
    assert.equal(attemptCount, 1);
    assert.equal(snapshot.events.some((event) => event.eventType === "skill:retry_scheduled"), false);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service records terminal failure as failed output", async () => {
  const skill: SkillDefinition = {
    skillId: "deploy_check",
    version: "1.0.0",
    description: "Run deployment verification.",
    requiredTools: ["bash"],
    steps: [
      {
        stepId: "run_build",
        toolName: "bash",
      },
    ],
  };

  const { workspace, db, inspect, service } = createService(() => ({
    success: false,
    summary: "Build failed.",
    output: "compile error",
    errorCode: "bash.build_failed",
    retryable: false,
    durationMs: 12,
  }));

  try {
    const result = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["bash"],
    });
    const executionInspect = inspect.getExecutionInspectView("exec-skill");

    assert.equal(result.status, "failed");
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0]?.status, "failed");
    assert.equal(result.cache.status, "ineligible");
    assert.equal(executionInspect.agentExecution?.status, "skill_failed");
    assert.equal(executionInspect.agentExecution?.lastErrorCode, "bash.build_failed");
    assert.equal(executionInspect.stepOutputs.length, 1);
    assert.equal(executionInspect.stepOutputs[0]?.status, "failed");
    assert.ok(executionInspect.recentEvents.some((event) => event.eventType === "skill:step_failed"));
    assert.ok(executionInspect.recentEvents.some((event) => event.eventType === "skill:execution_completed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service resolves model-aware tool overrides before invoking the runner", async () => {
  const requestedToolNames: string[] = [];
  const skill: SkillDefinition = {
    skillId: "model_aware_edit",
    version: "1.0.0",
    description: "Use a lighter edit tool for fast models.",
    requiredTools: ["edit_batch", "edit_replace"],
    steps: [
      {
        stepId: "apply_edit",
        toolName: "edit_batch",
        modelOverrides: [
          {
            tiers: ["fast"],
            toolName: "edit_replace",
          },
        ],
      },
    ],
  };

  const { workspace, db, inspect, service } = createService((request) => {
    requestedToolNames.push(request.toolName);
    return {
      success: true,
      summary: `${request.toolName} ok`,
      output: request.toolName,
      durationMs: 4,
    };
  });

  try {
    const result = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["edit_batch", "edit_replace"],
      modelProfileName: "fast",
    });
    const executionInspect = inspect.getExecutionInspectView("exec-skill");

    assert.equal(result.status, "succeeded");
    assert.deepEqual(requestedToolNames, ["edit_replace"]);
    assert.equal(result.steps[0]?.toolName, "edit_replace");
    assert.equal(executionInspect.agentExecution?.lastToolName, "edit_replace");
    assert.match(executionInspect.agentExecution?.planJson ?? "", /"modelProfileName":"fast"/);
    assert.match(executionInspect.stepOutputs[0]?.dataJson ?? "", /"requestedToolName":"edit_batch"/);
    assert.match(executionInspect.stepOutputs[0]?.dataJson ?? "", /"toolName":"edit_replace"/);
    assert.match(executionInspect.stepOutputs[0]?.validationJson ?? "", /"requestedToolName":"edit_batch"/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service rejects model overrides that point at undeclared tools", async () => {
  const skill: SkillDefinition = {
    skillId: "invalid_model_override",
    version: "1.0.0",
    description: "Broken override declaration.",
    requiredTools: ["edit_batch"],
    steps: [
      {
        stepId: "apply_edit",
        toolName: "edit_batch",
        modelOverrides: [
          {
            tiers: ["fast"],
            toolName: "edit_replace",
          },
        ],
      },
    ],
  };

  const { workspace, db, service } = createService(() => ({
    success: true,
    summary: "should not run",
  }));

  try {
    await assert.rejects(
      () =>
        service.execute({
          executionId: "exec-skill",
          skill,
          allowedTools: ["edit_batch"],
          modelProfileName: "fast",
        }),
      /skill\.definition_override_tool_not_declared:apply_edit:edit_replace/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service falls back to execution allowed tools when no explicit runtime tool set is provided", async () => {
  const skill: SkillDefinition = {
    skillId: "deploy_check",
    version: "1.0.0",
    description: "Run deployment verification.",
    requiredTools: ["bash"],
    steps: [
      {
        stepId: "run_build",
        toolName: "bash",
      },
    ],
  };

  const { workspace, db, service, store } = createService(() => ({
    success: true,
    summary: "should not run",
  }));

  db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(JSON.stringify(["read"]), "exec-skill");

  try {
    await assert.rejects(
      () =>
        service.execute({
          executionId: "exec-skill",
          skill,
        }),
      /skill\.tool_not_allowed:bash/,
    );
    assert.equal(store.getAgentExecutionRecord("exec-skill"), null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service rejects override-resolved tools that exceed the execution permission set", async () => {
  const skill: SkillDefinition = {
    skillId: "model_aware_edit_denied",
    version: "1.0.0",
    description: "Attempt to switch tools under a restricted execution.",
    requiredTools: ["edit_batch", "edit_replace"],
    steps: [
      {
        stepId: "apply_edit",
        toolName: "edit_batch",
        modelOverrides: [
          {
            tiers: ["fast"],
            toolName: "edit_replace",
          },
        ],
      },
    ],
  };

  const { workspace, db, service, store } = createService(() => ({
    success: true,
    summary: "should not run",
  }));

  db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(JSON.stringify(["edit_batch"]), "exec-skill");

  try {
    await assert.rejects(
      () =>
        service.execute({
          executionId: "exec-skill",
          skill,
          modelProfileName: "fast",
        }),
      /skill\.tool_not_allowed:edit_replace/,
    );
    assert.equal(store.getAgentExecutionRecord("exec-skill"), null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service fail-closes when execution allowed tools contain malformed entries", async () => {
  const skill: SkillDefinition = {
    skillId: "invalid_allowed_tools",
    version: "1.0.0",
    description: "Reject malformed execution allowlists.",
    requiredTools: ["read"],
    steps: [
      {
        stepId: "read_source",
        toolName: "read",
      },
    ],
  };

  const { workspace, db, service, store } = createService(() => ({
    success: true,
    summary: "should not run",
  }));

  db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["read", 1]),
    "exec-skill",
  );

  try {
    await assert.rejects(
      () =>
        service.execute({
          executionId: "exec-skill",
          skill,
        }),
      /skill\.execution_allowed_tools_invalid:exec-skill/,
    );
    assert.equal(store.getAgentExecutionRecord("exec-skill"), null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service reuses a cached result only when git/source fingerprints still match", async () => {
  let toolCallCount = 0;
  const skill: SkillDefinition = {
    skillId: "code_review",
    version: "1.0.0",
    description: "Review code without side effects.",
    requiredTools: ["read"],
    cacheable: true,
    cacheTtlSeconds: 3600,
    steps: [
      {
        stepId: "review_files",
        toolName: "read",
      },
    ],
  };

  const { workspace, db, store, inspect, service } = createService(
    () => {
      toolCallCount += 1;
      return {
        success: true,
        summary: "review ok",
        output: "cached-review",
        durationMs: 3,
      };
    },
    {
      gitHeadResolver: () => "git-head-a",
    },
  );

  seedTaskAndExecution(db, store, {
    taskId: "task-skill-cache-hit",
    executionId: "exec-skill-cache-hit",
    traceId: "trace-skill-cache-hit",
  });

  try {
    const first = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["read"],
      cache: {
        parameters: { files: ["src/app.ts"] },
        workingDirectory: workspace,
        sourceHash: "source-a",
      },
    });
    const second = await service.execute({
      executionId: "exec-skill-cache-hit",
      skill,
      allowedTools: ["read"],
      cache: {
        parameters: { files: ["src/app.ts"] },
        workingDirectory: workspace,
        sourceHash: "source-a",
      },
    });
    const executionInspect = inspect.getExecutionInspectView("exec-skill-cache-hit");
    const secondSnapshot = store.loadTaskSnapshot("task-skill-cache-hit");

    assert.equal(first.cache.status, "stored");
    assert.equal(second.cache.status, "hit");
    assert.equal(toolCallCount, 1);
    assert.equal(executionInspect.agentExecution?.status, "skill_cache_hit");
    assert.equal(executionInspect.agentExecution?.toolCallCount, 0);
    assert.ok(secondSnapshot.events.some((event) => event.eventType === "skill:cache_hit"));
    assert.equal(executionInspect.stepOutputs.length, 1);
    assert.match(executionInspect.stepOutputs[0]?.validationJson ?? "", /"cacheHit":true/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service bypasses a stale cache when source fingerprint changes or caching is disabled", async () => {
  let toolCallCount = 0;
  const skill: SkillDefinition = {
    skillId: "code_review",
    version: "1.0.0",
    description: "Review code without side effects.",
    requiredTools: ["read"],
    cacheable: true,
    cacheTtlSeconds: 3600,
    steps: [
      {
        stepId: "review_files",
        toolName: "read",
      },
    ],
  };

  const { workspace, db, store, service } = createService(
    () => {
      toolCallCount += 1;
      return {
        success: true,
        summary: "review ok",
        output: `review-${toolCallCount}`,
        durationMs: 3,
      };
    },
    {
      gitHeadResolver: () => "git-head-a",
    },
  );

  seedTaskAndExecution(db, store, {
    taskId: "task-skill-cache-miss",
    executionId: "exec-skill-cache-miss",
    traceId: "trace-skill-cache-miss",
  });
  seedTaskAndExecution(db, store, {
    taskId: "task-skill-cache-disabled",
    executionId: "exec-skill-cache-disabled",
    traceId: "trace-skill-cache-disabled",
  });

  try {
    const first = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["read"],
      cache: {
        parameters: { files: ["src/app.ts"] },
        workingDirectory: workspace,
        sourceHash: "source-a",
      },
    });
    const second = await service.execute({
      executionId: "exec-skill-cache-miss",
      skill,
      allowedTools: ["read"],
      cache: {
        parameters: { files: ["src/app.ts"] },
        workingDirectory: workspace,
        sourceHash: "source-b",
      },
    });
    const third = await service.execute({
      executionId: "exec-skill-cache-disabled",
      skill,
      allowedTools: ["read"],
      cache: {
        enabled: false,
        parameters: { files: ["src/app.ts"] },
        workingDirectory: workspace,
        sourceHash: "source-a",
      },
    });

    assert.equal(first.cache.status, "stored");
    assert.equal(second.cache.status, "stored");
    assert.equal(third.cache.status, "disabled");
    assert.equal(toolCallCount, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("skill execution service fail-closes when the execution exceeds the tool call ceiling", async () => {
  let toolCallCount = 0;
  const skill: SkillDefinition = {
    skillId: "resource_limited_review",
    version: "1.0.0",
    description: "Run two read steps under a tight tool-call ceiling.",
    requiredTools: ["read"],
    steps: [
      {
        stepId: "review_first",
        toolName: "read",
      },
      {
        stepId: "review_second",
        toolName: "read",
      },
    ],
  };

  const { workspace, db, inspect, service } = createService(
    () => {
      toolCallCount += 1;
      return {
        success: true,
        summary: "review ok",
        output: `review-${toolCallCount}`,
        durationMs: 3,
      };
    },
    {
      resourceCeilingGuard: new ExecutionResourceCeilingGuard({
        maxToolCalls: 1,
        maxMemoryMb: null,
        maxElapsedMs: null,
      }),
    },
  );

  try {
    const result = await service.execute({
      executionId: "exec-skill",
      skill,
      allowedTools: ["read"],
    });
    const executionInspect = inspect.getExecutionInspectView("exec-skill");

    assert.equal(result.status, "failed");
    assert.equal(toolCallCount, 1);
    assert.equal(result.steps.length, 2);
    assert.equal(result.steps[1]?.stepId, "review_second");
    assert.equal(result.steps[1]?.status, "failed");
    assert.equal(executionInspect.agentExecution?.status, "skill_failed");
    assert.equal(executionInspect.agentExecution?.toolCallCount, 1);
    assert.equal(
      executionInspect.agentExecution?.lastErrorCode,
      "agent.resource_limit.tool_calls_exceeded",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
