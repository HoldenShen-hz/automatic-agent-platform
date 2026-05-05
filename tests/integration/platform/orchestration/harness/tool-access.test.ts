/**
 * Integration Test: Tool Access
 *
 * Tests tool access patterns within the harness workflow using SQLite integration context,
 * verifying authorization boundaries, blocked tool handling, and access control.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { ToolbeltAssembler } from "../../../../../src/platform/orchestration/harness/toolbelt-assembler.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

test("ToolAccess integration: full access granted when all tools allowed", () => {
  const ctx = createIntegrationContext("aa-toolaccess-full-");
  try {
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_001",
        parentId: null,
        rootId: "task_toolaccess_001",
        divisionId: "general_ops",
        tenantId: null,
        title: "Full access test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
      allowedTools: ["bash", "read", "write", "edit", "grep", "sed"],
      requestedTools: ["bash", "read", "write", "edit", "grep", "sed"],
      requiredEvidence: ["execution_log"],
    });

    assert.equal(toolbelt.grantedTools.length, 6);
    assert.equal(toolbelt.blockedTools.length, 0);

    // Verify task state after toolbelt assembly
    const task = ctx.store.getTask("task_toolaccess_001");
    assert.ok(task);
    assert.equal(task?.status, "in_progress");
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: restricted access blocks dangerous tools", () => {
  const ctx = createIntegrationContext("aa-toolaccess-restricted-");
  try {
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_002",
        parentId: null,
        rootId: "task_toolaccess_002",
        divisionId: "general_ops",
        tenantId: null,
        title: "Restricted access test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
      allowedTools: ["read", "grep"],
      requestedTools: ["bash", "write", "rm", "exec", "read", "grep"],
      requiredEvidence: [],
    });

    assert.deepEqual(toolbelt.grantedTools, ["read", "grep"]);
    assert.deepEqual(toolbelt.blockedTools, ["bash", "write", "rm", "exec"]);
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: no tools requested returns empty grant", () => {
  const ctx = createIntegrationContext("aa-toolaccess-empty-");
  try {
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_003",
        parentId: null,
        rootId: "task_toolaccess_003",
        divisionId: "general_ops",
        tenantId: null,
        title: "Empty request test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
      allowedTools: ["bash", "read"],
      requestedTools: [],
      requiredEvidence: [],
    });

    assert.deepEqual(toolbelt.grantedTools, []);
    assert.deepEqual(toolbelt.blockedTools, []);
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: toolbelt persists in completed harness run", () => {
  const ctx = createIntegrationContext("aa-toolaccess-persist-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: ["bash", "read"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: ["execution_log"], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_004",
        parentId: null,
        rootId: "task_toolaccess_004",
        divisionId: "general_ops",
        tenantId: null,
        title: "Toolbelt persist test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const run = service.runLoop({
      taskId: "task_toolaccess_004",
      domainId: "coding",
      constraintPack,
      plannerOutput: { planId: "plan_001", summary: "Persist test" },
      generatorOutput: { stepOutputs: [], toolCalls: [] },
      evaluatorOutput: { score: 0.9, verdict: "accept" },
      evaluatorScore: 0.9,
      requestedTools: ["bash", "read"],
      producedEvidenceRefs: ["execution_log"],
    });

    assert.ok(run.toolbelt);
    assert.equal(run.status, "completed");
    assert.ok(run.completedAt);
    assert.ok(run.decision);

    // Verify the toolbelt is properly attached to the run
    const persistedRun = service.persistRun(run);
    assert.ok(persistedRun);
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: blocked tools prevent invariant violations", () => {
  const ctx = createIntegrationContext("aa-toolaccess-blocked-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: ["read"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_005",
        parentId: null,
        rootId: "task_toolaccess_005",
        divisionId: "general_ops",
        tenantId: null,
        title: "Blocked tools test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    assert.throws(
      () =>
        service.runLoop({
          taskId: "task_toolaccess_005",
          domainId: "coding",
          constraintPack,
          plannerOutput: { planId: "plan_002", summary: "Blocked tools test" },
          generatorOutput: { stepOutputs: [], toolCalls: [] },
          evaluatorOutput: { score: 0.9, verdict: "accept" },
          evaluatorScore: 0.9,
          requestedTools: ["bash", "write", "exec"],
        }),
      /harness\.invariant\.blocked_tool_requested/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: multiple toolbelt assemblies maintain isolation", () => {
  const ctx = createIntegrationContext("aa-toolaccess-isolation-");
  try {
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_006",
        parentId: null,
        rootId: "task_toolaccess_006",
        divisionId: "general_ops",
        tenantId: null,
        title: "Isolation test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const assembler = new ToolbeltAssembler();

    const toolbelt1 = assembler.assemble({
      allowedTools: ["bash", "read"],
      requestedTools: ["bash"],
      requiredEvidence: ["evidence_a"],
    });

    const toolbelt2 = assembler.assemble({
      allowedTools: ["read", "write", "edit"],
      requestedTools: ["read", "write"],
      requiredEvidence: ["evidence_b", "evidence_c"],
    });

    const toolbelt3 = assembler.assemble({
      allowedTools: ["exec"],
      requestedTools: ["exec", "bash"],
      requiredEvidence: [],
    });

    // Verify isolation between assemblies
    assert.deepEqual(toolbelt1.grantedTools, ["bash"]);
    assert.deepEqual(toolbelt1.blockedTools, []);
    assert.deepEqual(toolbelt1.requiredEvidence, ["evidence_a"]);

    assert.deepEqual(toolbelt2.grantedTools, ["read", "write"]);
    assert.deepEqual(toolbelt2.blockedTools, []);
    assert.deepEqual(toolbelt2.requiredEvidence, ["evidence_b", "evidence_c"]);

    assert.deepEqual(toolbelt3.grantedTools, ["exec"]);
    assert.deepEqual(toolbelt3.blockedTools, ["bash"]);
    assert.deepEqual(toolbelt3.requiredEvidence, []);

    // Verify each toolbelt is independent
    (toolbelt1.grantedTools as string[]).push("injected");
    assert.equal(toolbelt2.grantedTools.length, 2);
    assert.equal(toolbelt3.grantedTools.length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: case-sensitive tool matching", () => {
  const ctx = createIntegrationContext("aa-toolaccess-case-");
  try {
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_007",
        parentId: null,
        rootId: "task_toolaccess_007",
        divisionId: "general_ops",
        tenantId: null,
        title: "Case sensitive test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
      allowedTools: ["Bash", "Read", "bash", "read"],
      requestedTools: ["bash", "Bash", "read"],
      requiredEvidence: [],
    });

    // Exact match required - case sensitive
    assert.deepEqual(toolbelt.grantedTools, ["bash", "Bash", "read"]);
    assert.deepEqual(toolbelt.blockedTools, []);
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: toolbelt used in HITL workflow", () => {
  const ctx = createIntegrationContext("aa-toolaccess-hitl-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      tool_policy: { allowedTools: ["bash", "read", "write"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: ["execution_log"], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_008",
        parentId: null,
        rootId: "task_toolaccess_008",
        divisionId: "general_ops",
        tenantId: null,
        title: "HITL tool access test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    // Create run that escalates to human
    const run = service.runLoop({
      taskId: "task_toolaccess_008",
      domainId: "coding",
      constraintPack,
      plannerOutput: { planId: "plan_003", summary: "HITL test" },
      generatorOutput: { stepOutputs: [], toolCalls: [] },
      evaluatorOutput: { score: 0.6, verdict: "review" },
      evaluatorScore: 0.6,
      requestedTools: ["bash", "read"],
      requiresHuman: true,
    });

    // Toolbelt should still be assembled even when escalating
    assert.ok(run.toolbelt);
    assert.deepEqual(run.toolbelt.grantedTools, ["bash", "read"]);
    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "hitl");
    assert.ok(run.hitlRequest);

    // Resolve HITL and verify toolbelt persists
    const resolvedRun = service.resolveHitlReview(run, "approved", "human_operator_001");
    assert.ok(resolvedRun.toolbelt);
    assert.equal(resolvedRun.status, "running");
  } finally {
    ctx.cleanup();
  }
});

test("ToolAccess integration: toolbelt with seed context", () => {
  const ctx = createIntegrationContext("aa-toolaccess-seed-");
  try {
    const assembler = new ToolbeltAssembler();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolaccess_seed_001",
        parentId: null,
        rootId: "task_toolaccess_seed_001",
        divisionId: "general_ops",
        tenantId: null,
        title: "Tool access seed test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    const task = ctx.store.getTask("task_toolaccess_seed_001");
    assert.ok(task);

    const toolbelt = assembler.assemble({
      allowedTools: ["bash", "read", "write", "edit", "grep"],
      requestedTools: ["bash", "read"],
      requiredEvidence: ["execution_log", "audit_trail"],
    });

    assert.deepEqual(toolbelt.grantedTools, ["bash", "read"]);
    assert.deepEqual(toolbelt.blockedTools, []);
    assert.deepEqual(toolbelt.allowedTools, ["bash", "read", "write", "edit", "grep"]);
    assert.deepEqual(toolbelt.requiredEvidence, ["execution_log", "audit_trail"]);
  } finally {
    ctx.cleanup();
  }
});
