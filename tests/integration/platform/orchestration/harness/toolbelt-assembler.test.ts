/**
 * Integration Test: Toolbelt Assembler
 *
 * Tests ToolbeltAssembler within the harness workflow using SQLite integration context,
 * verifying tool granting, blocking, and evidence requirements.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { ToolbeltAssembler, type ToolbeltAssemblyRequest } from "../../../../../src/platform/five-plane-orchestration/harness/toolbelt-assembler.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

test("ToolbeltAssembler integration: grants allowed tools with SQLite context", () => {
  const ctx = createIntegrationContext("aa-toolbelt-grant-");
  try {
    const assembler = new ToolbeltAssembler();

    // Insert a task to satisfy DB constraints
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_001",
        parentId: null,
        rootId: "task_toolbelt_001",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt grant test",
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

    const request: ToolbeltAssemblyRequest = {
      allowedTools: ["bash", "read", "write", "edit"],
      requestedTools: ["bash", "read"],
      requiredEvidence: ["execution_log"],
    };

    const toolbelt = assembler.assemble(request);

    assert.deepEqual(toolbelt.grantedTools, ["bash", "read"]);
    assert.deepEqual(toolbelt.blockedTools, []);
    assert.deepEqual(toolbelt.allowedTools, ["bash", "read", "write", "edit"]);
    assert.deepEqual(toolbelt.requiredEvidence, ["execution_log"]);

    // Verify DB still accessible after assembly
    const task = ctx.store.getTask("task_toolbelt_001");
    assert.ok(task);
    assert.equal(task?.title, "Toolbelt grant test");
  } finally {
    ctx.cleanup();
  }
});

test("ToolbeltAssembler integration: blocks unauthorized tools with SQLite context", () => {
  const ctx = createIntegrationContext("aa-toolbelt-block-");
  try {
    const assembler = new ToolbeltAssembler();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_002",
        parentId: null,
        rootId: "task_toolbelt_002",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt block test",
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

    const request: ToolbeltAssemblyRequest = {
      allowedTools: ["read"],
      requestedTools: ["bash", "write", "read"],
      requiredEvidence: [],
    };

    const toolbelt = assembler.assemble(request);

    assert.deepEqual(toolbelt.grantedTools, ["read"]);
    assert.deepEqual(toolbelt.blockedTools, ["bash", "write"]);

    const task = ctx.store.getTask("task_toolbelt_002");
    assert.ok(task);
  } finally {
    ctx.cleanup();
  }
});

test("ToolbeltAssembler integration: empty allowed tools blocks all", () => {
  const ctx = createIntegrationContext("aa-toolbelt-empty-");
  try {
    const assembler = new ToolbeltAssembler();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_003",
        parentId: null,
        rootId: "task_toolbelt_003",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt empty allowed test",
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

    const request: ToolbeltAssemblyRequest = {
      allowedTools: [],
      requestedTools: ["bash", "read"],
      requiredEvidence: [],
    };

    const toolbelt = assembler.assemble(request);

    assert.deepEqual(toolbelt.grantedTools, []);
    assert.deepEqual(toolbelt.blockedTools, ["bash", "read"]);
  } finally {
    ctx.cleanup();
  }
});

test("ToolbeltAssembler integration: preserves required evidence", () => {
  const ctx = createIntegrationContext("aa-toolbelt-evidence-");
  try {
    const assembler = new ToolbeltAssembler();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_004",
        parentId: null,
        rootId: "task_toolbelt_004",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt evidence test",
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

    const request: ToolbeltAssemblyRequest = {
      allowedTools: ["bash"],
      requestedTools: ["bash"],
      requiredEvidence: ["execution_log", "audit_trail", "cost_report"],
    };

    const toolbelt = assembler.assemble(request);

    assert.deepEqual(toolbelt.requiredEvidence, ["execution_log", "audit_trail", "cost_report"]);
    assert.deepEqual(toolbelt.grantedTools, ["bash"]);
  } finally {
    ctx.cleanup();
  }
});

test("ToolbeltAssembler integration: runs within harness workflow", () => {
  const ctx = createIntegrationContext("aa-toolbelt-workflow-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash", "read", "write"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: ["execution_log"], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_005",
        parentId: null,
        rootId: "task_toolbelt_005",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt workflow test",
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
      taskId: "task_toolbelt_005",
      domainId: "coding",
      constraintPack,
      plannerOutput: { planId: "plan_001", summary: "Test plan" },
      generatorOutput: { stepOutputs: [], toolCalls: [] },
      evaluatorOutput: { score: 0.9, verdict: "accept" },
      evaluatorScore: 0.9,
      requestedTools: ["bash", "read", "write"],
      producedEvidenceRefs: ["execution_log"],
    });

    assert.ok(run.toolbelt);
    assert.deepEqual(run.toolbelt.grantedTools, ["bash", "read", "write"]);
    assert.deepEqual(run.toolbelt.blockedTools, []);
    assert.deepEqual(run.toolbelt.requiredEvidence, ["execution_log"]);
    assert.equal(run.status, "completed");

    // Verify task persisted correctly
    const task = ctx.store.getTask("task_toolbelt_005");
    assert.ok(task);
    assert.equal(task?.title, "Toolbelt workflow test");
  } finally {
    ctx.cleanup();
  }
});

test("ToolbeltAssembler integration: partial tool access in harness", () => {
  const ctx = createIntegrationContext("aa-toolbelt-partial-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["read"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_006",
        parentId: null,
        rootId: "task_toolbelt_006",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt partial test",
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
          taskId: "task_toolbelt_006",
          domainId: "coding",
          constraintPack,
          plannerOutput: { planId: "plan_002", summary: "Partial tool test" },
          generatorOutput: { stepOutputs: [], toolCalls: [] },
          evaluatorOutput: { score: 0.9, verdict: "accept" },
          evaluatorScore: 0.9,
          requestedTools: ["bash", "read", "write"],
        });

    assert.equal(run.status, "aborted");
    assert.equal(run.decision?.action, "abort");
    assert.ok(service.assertInvariants(run).violations.some((violation) => violation.includes("blocked_tool_requested")));
  } finally {
    ctx.cleanup();
  }
});

test("ToolbeltAssembler integration: defensive copies prevent mutation", () => {
  const ctx = createIntegrationContext("aa-toolbelt-defensive-");
  try {
    const assembler = new ToolbeltAssembler();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_toolbelt_007",
        parentId: null,
        rootId: "task_toolbelt_007",
        divisionId: "general-ops",
        tenantId: null,
        title: "Toolbelt defensive test",
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

    const request: ToolbeltAssemblyRequest = {
      allowedTools: ["bash"],
      requestedTools: ["bash"],
      requiredEvidence: ["evidence_1"],
    };

    const toolbelt = assembler.assemble(request);

    // Verify result arrays are independent copies
    (toolbelt.grantedTools as string[]).push("mutated");
    (toolbelt.allowedTools as string[]).push("mutated_allowed");
    (toolbelt.requiredEvidence as string[]).push("mutated_evidence");

    const toolbelt2 = assembler.assemble(request);

    assert.deepEqual(toolbelt2.grantedTools, ["bash"]);
    assert.deepEqual(toolbelt2.allowedTools, ["bash"]);
    assert.deepEqual(toolbelt2.requiredEvidence, ["evidence_1"]);
  } finally {
    ctx.cleanup();
  }
});
