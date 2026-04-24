import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import {
  SkillExecutionService,
  type SkillDefinition,
  type SkillToolCallRequest,
  type SkillToolCallResult,
} from "../../../../../src/platform/execution/tool-executor/skill-execution-service.js";
import { skillExecutionCoreMethods } from "../../../../../src/platform/execution/tool-executor/skill-execution-core-methods.js";
import type { ToolExecutionMetadata } from "../../../../../src/platform/execution/tool-executor/tool-metadata.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createService(
  runner: (request: SkillToolCallRequest) => Promise<SkillToolCallResult>,
  toolMetadataResolver?: (toolName: string) => ToolExecutionMetadata | null,
) {
  const workspace = createTempWorkspace("aa-skill-core-methods-");
  const db = new SqliteDatabase(join(workspace, "skill-core-methods.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  seedTaskAndExecution(db, store, {
    taskId: "task-core-methods",
    executionId: "exec-core-methods",
    traceId: "trace-core-methods",
  });
  const service = new SkillExecutionService(db, store, runner, {
    toolMetadataResolver: toolMetadataResolver ?? (() => null),
  });
  return { workspace, db, store, service };
}

test("normalizeToolCallResult derives errorCode from status when not provided", () => {
  const { workspace, db, service } = createService(async () => ({
    success: false,
    summary: "failed",
    errorSource: "tool",
  }));

  try {
    const result = service.normalizeToolCallResult(
      {
        success: false,
        status: "failed",
        summary: "failed",
        errorSource: "tool",
      },
      null,
      Date.now() - 100,
    );

    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, "tool.execution_failed");
    assert.equal(result.errorSource, "tool");
    assert.equal(result.retryable, false);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("normalizeToolCallResult sets timeout errorCode when status is timed_out", () => {
  const { workspace, db, service } = createService(async () => ({
    success: false,
    status: "timed_out",
    summary: "timeout",
    errorSource: "tool",
  }));

  try {
    const result = service.normalizeToolCallResult(
      {
        success: false,
        status: "timed_out",
        summary: "timeout",
        errorSource: "tool",
      },
      null,
      Date.now() - 5000,
    );

    assert.equal(result.status, "timed_out");
    assert.equal(result.errorCode, "tool.timeout");
    assert.equal(result.retryable, false);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("normalizeToolCallResult preserves provided errorCode and errorSource", () => {
  const { workspace, db, service } = createService(async () => ({
    success: false,
    summary: "custom error",
    errorCode: "custom.code",
    errorSource: "network",
  }));

  try {
    const result = service.normalizeToolCallResult(
      {
        success: false,
        summary: "custom error",
        errorCode: "custom.code",
        errorSource: "network",
      },
      null,
      Date.now() - 50,
    );

    assert.equal(result.errorCode, "custom.code");
    assert.equal(result.errorSource, "network");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("normalizeToolCallResult marks retryable based on metadata when failure occurs", () => {
  const metadata: ToolExecutionMetadata = {
    toolName: "retryable_tool",
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
    defaultTimeoutMs: 1000,
    maxOutputBytes: 20_000,
    retryableErrorCodes: ["tool.timeout", "network.reset"],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
  };

  const { workspace, db, service } = createService(
    async () => ({ success: false, summary: "retryable failure", errorCode: "tool.timeout" }),
    (name) => (name === "retryable_tool" ? metadata : null),
  );

  try {
    const result = service.normalizeToolCallResult(
      {
        success: false,
        summary: "retryable failure",
        errorCode: "tool.timeout",
        errorSource: "tool",
        retryable: true,
      },
      metadata,
      Date.now() - 100,
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "tool.timeout");
    assert.equal(result.retryable, true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("normalizeToolCallResult calculates durationMs from startedAtMs to now", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const startedAtMs = Date.now() - 250;
    const result = service.normalizeToolCallResult(
      {
        success: true,
        summary: "ok",
      },
      null,
      startedAtMs,
    );

    const durationMs = result.durationMs;
    assert.notEqual(durationMs, undefined);
    assert.ok((durationMs ?? 0) >= 250);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateSkillDefinition accepts valid skill definition", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "valid-skill",
      version: "1.0.0",
      description: "A valid skill",
      requiredTools: ["read"],
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    service.validateSkillDefinition(skill);
    assert.ok(true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateSkillDefinition rejects skill with step using undeclared tool", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "invalid-skill",
      version: "1.0.0",
      description: "Invalid skill",
      requiredTools: ["read"],
      steps: [{ stepId: "s1", toolName: "bash" }],
    };

    assert.throws(
      () => service.validateSkillDefinition(skill),
      /skill\.definition_tool_not_declared:s1:bash/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateSkillDefinition rejects skill with model override using undeclared tool", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "override-invalid",
      version: "1.0.0",
      description: "Invalid override",
      requiredTools: ["read"],
      steps: [
        {
          stepId: "s1",
          toolName: "read",
          modelOverrides: [{ toolName: "edit" }],
        },
      ],
    };

    assert.throws(
      () => service.validateSkillDefinition(skill),
      /skill\.definition_override_tool_not_declared:s1:edit/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateResolvedSteps accepts resolved steps with all tools declared", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "resolved-ok",
      version: "1.0.0",
      description: "Valid resolved steps",
      requiredTools: ["read", "edit"],
      steps: [
        { stepId: "s1", toolName: "read" },
        { stepId: "s2", toolName: "edit" },
      ],
    };

    const resolvedSteps = service.resolveSkillSteps(skill, null);
    service.validateResolvedSteps(skill, resolvedSteps);
    assert.ok(true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateResolvedSteps rejects resolved step with tool not in requiredTools", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "resolved-invalid",
      version: "1.0.0",
      description: "Invalid resolved steps",
      requiredTools: ["read"],
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const resolvedSteps = service.resolveSkillSteps(skill, null);
    resolvedSteps[0] = { ...resolvedSteps[0]!, resolvedToolName: "edit" };

    assert.throws(
      () => service.validateResolvedSteps(skill, resolvedSteps),
      /skill\.resolved_tool_not_declared:s1:edit/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateAllowedTools accepts when allowedTools contains all required tools", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "allowed-tools-ok",
      version: "1.0.0",
      description: "Valid allowed tools",
      requiredTools: ["read", "edit"],
      steps: [
        { stepId: "s1", toolName: "read" },
        { stepId: "s2", toolName: "edit" },
      ],
    };

    const resolvedSteps = service.resolveSkillSteps(skill, null);
    service.validateAllowedTools(skill, resolvedSteps, ["read", "edit", "bash"]);
    assert.ok(true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateAllowedTools rejects when allowedTools is missing a required tool", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "allowed-tools-invalid",
      version: "1.0.0",
      description: "Invalid allowed tools",
      requiredTools: ["read", "edit"],
      steps: [
        { stepId: "s1", toolName: "read" },
        { stepId: "s2", toolName: "edit" },
      ],
    };

    const resolvedSteps = service.resolveSkillSteps(skill, null);
    assert.throws(
      () => service.validateAllowedTools(skill, resolvedSteps, ["read"]),
      /skill\.tool_not_allowed:edit/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("validateAllowedTools allows null/undefined allowedTools (no restriction)", () => {
  const { workspace, db, service } = createService(async () => ({
    success: true,
    summary: "ok",
  }));

  try {
    const skill: SkillDefinition = {
      skillId: "no-restriction",
      version: "1.0.0",
      description: "No restriction",
      requiredTools: ["read"],
      steps: [{ stepId: "s1", toolName: "read" }],
    };

    const resolvedSteps = service.resolveSkillSteps(skill, null);
    service.validateAllowedTools(skill, resolvedSteps, undefined);
    assert.ok(true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("executeToolCallWithPolicy resolves timeout from metadata", async () => {
  const observedTimeouts: number[] = [];
  const metadata: ToolExecutionMetadata = {
    toolName: "timed_tool",
    readOnly: true,
    idempotent: true,
    sideEffectScope: "none",
    recoveryStrategy: "manual_resume_required",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "none",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 500,
    maxOutputBytes: 20_000,
    retryableErrorCodes: [],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
  };

  const { workspace, db, service } = createService(
    async (request) => {
      observedTimeouts.push(request.timeoutMs);
      return { success: true, summary: "ok", durationMs: 10 };
    },
    (name) => (name === "timed_tool" ? metadata : null),
  );

  try {
    const result = await service.executeToolCallWithPolicy(
      {
        skillId: "timeout-test",
        skillVersion: "1.0.0",
        executionId: "exec-core-methods",
        taskId: "task-core-methods",
        traceId: "trace-core-methods",
        stepId: "s1",
        toolName: "timed_tool",
        attempt: 1,
        maxAttempts: 1,
        input: {},
      },
      metadata,
    );

    assert.equal(result.success, true);
    assert.deepEqual(observedTimeouts, [500]);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("executeToolCallWithPolicy handles timeout correctly", async () => {
  const metadata: ToolExecutionMetadata = {
    toolName: "slow_tool",
    readOnly: true,
    idempotent: true,
    sideEffectScope: "none",
    recoveryStrategy: "manual_resume_required",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "none",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 50,
    maxOutputBytes: 20_000,
    retryableErrorCodes: ["tool.timeout"],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
  };

  const { workspace, db, service } = createService(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { success: true, summary: "should not get here" };
    },
    (name) => (name === "slow_tool" ? metadata : null),
  );

  try {
    const result = await service.executeToolCallWithPolicy(
      {
        skillId: "timeout-test",
        skillVersion: "1.0.0",
        executionId: "exec-core-methods",
        taskId: "task-core-methods",
        traceId: "trace-core-methods",
        stepId: "s1",
        toolName: "slow_tool",
        attempt: 1,
        maxAttempts: 1,
        input: {},
      },
      metadata,
    );

    assert.equal(result.success, false);
    assert.equal(result.status, "timed_out");
    assert.equal(result.errorCode, "tool.timeout");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("executeToolCallWithPolicy handles runner rejection gracefully", async () => {
  const { workspace, db, service } = createService(async () => {
    throw new Error("Runner failed");
  });

  try {
    const result = await service.executeToolCallWithPolicy(
      {
        skillId: "reject-test",
        skillVersion: "1.0.0",
        executionId: "exec-core-methods",
        taskId: "task-core-methods",
        traceId: "trace-core-methods",
        stepId: "s1",
        toolName: "any_tool",
        attempt: 1,
        maxAttempts: 1,
        input: {},
      },
      null,
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "tool.execution_failed");
    assert.equal(result.errorSource, "system");
    assert.ok(result.summary?.includes("Runner failed"));
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
