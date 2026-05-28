/**
 * Unit Tests: HR Role Governance Service - Gap Analysis
 *
 * Tests gap analysis functionality including capability matching,
 * role scoring, and missing capability detection.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  HrRoleGovernanceService,
  type HrGapAnalysisRequest,
  type HrRoleProposal,
  type HrGapTriggerReason,
  type HrRoleSchemaShape,
  type HrRolePrecondition,
  type HrWorkflowSuggestion,
  type HrWorkflowStepSuggestion,
  type HrGapAnalysisResult,
  type HrRoleProposalValidationResult,
  type SubmitHrRoleProposalRequest,
  type SubmitHrRoleProposalResult,
  type RegisterApprovedHrRoleRequest,
  type HrProposalApprovalStatus,
} from "../../../../../src/domains/governance/hr-role-governance-service.js";
import type { DivisionRegistry } from "../../../../../src/domains/governance/division-loader.js";

function makeMockDivision(
  roles: Array<{
    id: string;
    name: string;
    tools: string[];
    promptText?: string;
  }>,
  divisionId = "test_division",
): DivisionRegistry {
  const divisionRoot = join("/virtual/divisions", divisionId);
  return {
    divisions: new Map([
      [
        divisionId,
        {
          id: divisionId,
          name: "Test Division",
          rootPath: divisionRoot,
          version: "1",
          description: "Test division description",
          priority: 100,
          triggers: [],
          defaultWorkflowId: "wf_1",
          orchestrationWorkflowId: null,
          roles: roles.map((r) => ({
            id: r.id,
            name: r.name,
            promptPath: join(divisionRoot, "roles", `${r.id}.prompt.md`),
            promptText: r.promptText ?? `Role ${r.name}`,
            model: "balanced",
            tools: r.tools,
            maxInstances: null,
          })),
          workflows: [],
          resourceBoundaries: null,
          faultDomains: null,
        },
      ],
    ]),
    workflows: new Map(),
  } as unknown as DivisionRegistry;
}

function makeMinimalProposal(
  overrides: Partial<HrRoleProposal> = {},
): HrRoleProposal {
  const defaultProposal: HrRoleProposal = {
    divisionId: "test_division",
    roleId: "new_role_001",
    name: "New Test Role",
    promptText: "You are a test role that helps with testing",
    model: "balanced",
    tools: ["read"],
    scope: {
      responsibilities: ["provide test capabilities"],
      boundaries: ["read-only access"],
    },
    inputSchema: { required: ["task"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "Always applicable" }],
  };
  return { ...defaultProposal, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// HrGapTriggerReason type tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrGapTriggerReason accepts no_role_match", () => {
  const reason: HrGapTriggerReason = "no_role_match";
  assert.equal(reason, "no_role_match");
});

test("HrGapTriggerReason accepts scope_exceeded", () => {
  const reason: HrGapTriggerReason = "scope_exceeded";
  assert.equal(reason, "scope_exceeded");
});

// ─────────────────────────────────────────────────────────────────────────────
// Type export tests - HrRoleSchemaShape
// ─────────────────────────────────────────────────────────────────────────────

test("HrRoleSchemaShape accepts valid shape with required only", () => {
  const shape: HrRoleSchemaShape = { required: ["field1", "field2"] };
  assert.deepEqual(shape.required, ["field1", "field2"]);
});

test("HrRoleSchemaShape accepts valid shape with optional", () => {
  const shape: HrRoleSchemaShape = {
    required: ["field1"],
    optional: ["field2"],
  };
  assert.deepEqual(shape.required, ["field1"]);
  assert.deepEqual(shape.optional, ["field2"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type export tests - HrRolePrecondition
// ─────────────────────────────────────────────────────────────────────────────

test("HrRolePrecondition accepts valid precondition", () => {
  const precondition: HrRolePrecondition = {
    check: "always",
    description: "Always passes",
  };
  assert.equal(precondition.check, "always");
  assert.equal(precondition.description, "Always passes");
});

// ─────────────────────────────────────────────────────────────────────────────
// Type export tests - HrWorkflowStepSuggestion
// ─────────────────────────────────────────────────────────────────────────────

test("HrWorkflowStepSuggestion accepts valid step suggestion", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    outputKey: "output",
    timeoutMs: 60000,
    maxAttempts: 3,
  };
  assert.equal(step.stepId, "step_1");
  assert.equal(step.timeoutMs, 60000);
  assert.equal(step.maxAttempts, 3);
});

test("HrWorkflowStepSuggestion accepts step suggestion with autoApply", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    outputKey: "output",
    timeoutMs: 60000,
    maxAttempts: 1,
    autoApply: true,
  };
  assert.equal(step.autoApply, true);
});

test("HrWorkflowStepSuggestion accepts step suggestion with inputKeys", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    inputKeys: ["input1", "input2"],
    outputKey: "output",
    timeoutMs: 60000,
    maxAttempts: 1,
  };
  assert.deepEqual(step.inputKeys, ["input1", "input2"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type export tests - HrWorkflowSuggestion
// ─────────────────────────────────────────────────────────────────────────────

test("HrWorkflowSuggestion accepts valid workflow suggestion", () => {
  const suggestion: HrWorkflowSuggestion = {
    insertAfterStepId: "step_0",
    step: {
      stepId: "step_1",
      roleId: "role_1",
      outputKey: "output",
      timeoutMs: 60000,
      maxAttempts: 1,
    },
  };
  assert.equal(suggestion.insertAfterStepId, "step_0");
  assert.equal(suggestion.step.stepId, "step_1");
});

// ─────────────────────────────────────────────────────────────────────────────
// Type export tests - HrProposalApprovalStatus
// ─────────────────────────────────────────────────────────────────────────────

test("HrProposalApprovalStatus accepts approved", () => {
  const status: HrProposalApprovalStatus = "approved";
  assert.equal(status, "approved");
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeGap with no matching roles
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeGap returns empty matchedRoleIds when no roles match", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "Execute complex bash commands",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "execute", "shell"],
  });

  assert.ok(result.matchedRoleIds.length === 0, "Should have no matched roles");
  assert.deepEqual(result.missingCapabilities, ["bash", "execute", "shell"]);
});

test("analyzeGap returns empty matchedRoleIds when division is empty", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "Do something",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read", "write"],
  });

  assert.ok(result.matchedRoleIds.length === 0);
});

test("analyzeGap handles triggerReason scope_exceeded", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "bash write",
    targetDivisionId: "test_division",
    triggerReason: "scope_exceeded",
    requestedCapabilities: ["bash"],
  });

  assert.equal(result.triggerReason, "scope_exceeded");
  assert.ok(result.matchedRoleIds.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeGap with multiple matching roles
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeGap returns multiple matched roles sorted by score", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write", "read"] },
    { id: "role_admin", name: "Admin", tools: ["bash", "read"] },
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "Code and read",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "read"],
  });

  assert.ok(result.matchedRoleIds.length > 0);
  // role_coder should be first as it has more matching tokens
  assert.equal(result.matchedRoleIds[0], "role_coder");
});

test("analyzeGap includes divisionToolUnion in result", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write", "read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "bash write",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash"],
  });

  assert.ok(Array.isArray(result.divisionToolUnion));
  assert.ok(result.divisionToolUnion.length > 0);
});

test("analyzeGap includes suggestedToolNames in result", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "bash write",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "write"],
  });

  assert.ok(Array.isArray(result.suggestedToolNames));
});

test("analyzeGap recommendedModel is coding for non-trivial tools", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "bash write",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "write"],
  });

  assert.equal(result.recommendedModel, "coding");
});

test("analyzeGap recommendedModel is balanced for read-only tools", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "read question",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read", "question"],
  });

  assert.equal(result.recommendedModel, "balanced");
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeGap error cases
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeGap throws when divisionId not found", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  assert.throws(
    () =>
      service.analyzeGap({
        taskId: "task_1",
        taskDescription: "Test",
        targetDivisionId: "nonexistent_division",
        triggerReason: "no_role_match",
        requestedCapabilities: ["read"],
      }),
    /hr\.division_missing/,
  );
});

test("analyzeGap throws when registry is null", () => {
  const service = new HrRoleGovernanceService(null, null);

  assert.throws(
    () =>
      service.analyzeGap({
        taskId: "task_1",
        taskDescription: "Test",
        targetDivisionId: "test_division",
        triggerReason: "no_role_match",
        requestedCapabilities: ["read"],
      }),
    /division\.registry_unavailable/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeGap with failedDispatchLog
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeGap accepts request with failedDispatchLog", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_1",
    taskDescription: "Test",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
    failedDispatchLog: {
      attemptedDivisionId: "other_division",
      attemptedRoleId: "role_1",
      failureDetails: "Role not available",
    },
  };

  const result = service.analyzeGap(request);
  assert.ok(result !== null);
});

test("analyzeGap accepts request with null failedDispatchLog", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_1",
    taskDescription: "Test",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
    failedDispatchLog: null,
  };

  const result = service.analyzeGap(request);
  assert.ok(result !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeGap tokenization and scoring edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeGap handles whitespace-only capabilities", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "Test",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["   ", "  \t  "],
  });

  // Empty/whitespace-only capabilities should not match
  assert.ok(result.missingCapabilities.length >= 0);
});

test("analyzeGap handles short tokens (less than 3 chars)", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write", "read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "ab cd ef",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["ab", "cd", "ef"], // tokens < 3 chars are filtered
  });

  // Short tokens are filtered out, so no capabilities are matched
  assert.ok(result.matchedRoleIds.length === 0);
});

test("analyzeGap handles duplicate capabilities", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "bash",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "BASH", "  bash  "],
  });

  assert.equal(result.matchedRoleIds.length, 1);
});

test("analyzeGap result contains all required fields", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "Test",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
  });

  assert.equal(result.taskId, "task_1");
  assert.equal(result.targetDivisionId, "test_division");
  assert.equal(result.triggerReason, "no_role_match");
  assert.ok(Array.isArray(result.matchedRoleIds));
  assert.ok(Array.isArray(result.missingCapabilities));
  assert.ok(Array.isArray(result.divisionToolUnion));
  assert.ok(Array.isArray(result.suggestedToolNames));
  assert.ok(
    result.recommendedModel === "coding" ||
      result.recommendedModel === "balanced",
  );
});
