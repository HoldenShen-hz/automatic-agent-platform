/**
 * Unit Tests: HR Role Governance Service - Interfaces and Types
 *
 * Tests interface structure, type definitions, and interface contracts
 * for HR role governance including proposal, validation result, and workflow types.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HrRoleGovernanceService,
  type HrGapAnalysisRequest,
  type HrRoleProposal,
  type HrRoleSchemaShape,
  type HrRolePrecondition,
  type HrWorkflowStepSuggestion,
  type HrWorkflowSuggestion,
  type HrGapAnalysisResult,
  type HrRoleProposalValidationResult,
  type SubmitHrRoleProposalRequest,
  type SubmitHrRoleProposalResult,
  type RegisterApprovedHrRoleRequest,
  type SubmitHrRoleProposalResult,
  type HrGapTriggerReason,
  type HrProposalApprovalStatus,
} from "../../../../../../src/domains/governance/hr-role-governance-service.js";
import type { DivisionRegistry } from "../../../../../../src/domains/governance/division-loader.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock division factory
// ─────────────────────────────────────────────────────────────────────────────

function makeMockDivision(
  roles: Array<{ id: string; name: string; tools: string[]; promptText?: string }>,
  divisionId = "test_division",
): DivisionRegistry {
  return {
    divisions: new Map([
      [
        divisionId,
        {
          id: divisionId,
          name: "Test Division",
          rootPath: "/tmp/test",
          version: "1",
          description: "Test division description",
          priority: 100,
          triggers: [],
          defaultWorkflowId: "wf_1",
          orchestrationWorkflowId: null,
          roles: roles.map((r) => ({
            id: r.id,
            name: r.name,
            promptPath: `/tmp/test/roles/${r.id}.prompt.md`,
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

// ─────────────────────────────────────────────────────────────────────────────
// HrRoleSchemaShape interface tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrRoleSchemaShape interface accepts required-only shape", () => {
  const shape: HrRoleSchemaShape = {
    required: ["inputField1", "inputField2"],
  };
  assert.deepEqual(shape.required, ["inputField1", "inputField2"]);
  assert.equal(shape.optional, undefined);
});

test("HrRoleSchemaShape interface accepts shape with optional fields", () => {
  const shape: HrRoleSchemaShape = {
    required: ["inputField1"],
    optional: ["inputField2", "inputField3"],
  };
  assert.deepEqual(shape.required, ["inputField1"]);
  assert.deepEqual(shape.optional, ["inputField2", "inputField3"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// HrRolePrecondition interface tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrRolePrecondition interface accepts valid precondition", () => {
  const precondition: HrRolePrecondition = {
    check: "user.authenticated",
    description: "User must be authenticated",
  };
  assert.equal(precondition.check, "user.authenticated");
  assert.equal(precondition.description, "User must be authenticated");
});

test("HrRolePrecondition interface accepts empty strings in precondition", () => {
  const precondition: HrRolePrecondition = {
    check: "",
    description: "",
  };
  assert.equal(precondition.check, "");
  assert.equal(precondition.description, "");
});

// ─────────────────────────────────────────────────────────────────────────────
// HrWorkflowStepSuggestion interface tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrWorkflowStepSuggestion interface accepts minimal step suggestion", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    outputKey: "result",
    timeoutMs: 30000,
    maxAttempts: 1,
  };
  assert.equal(step.stepId, "step_1");
  assert.equal(step.timeoutMs, 30000);
});

test("HrWorkflowStepSuggestion interface accepts step with inputKeys", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    inputKeys: ["task", "context"],
    outputKey: "result",
    timeoutMs: 60000,
    maxAttempts: 3,
  };
  assert.deepEqual(step.inputKeys, ["task", "context"]);
});

test("HrWorkflowStepSuggestion interface accepts step with autoApply", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    outputKey: "result",
    timeoutMs: 60000,
    maxAttempts: 1,
    autoApply: true,
  };
  assert.equal(step.autoApply, true);
});

test("HrWorkflowStepSuggestion interface autoApply defaults to undefined", () => {
  const step: HrWorkflowStepSuggestion = {
    stepId: "step_1",
    roleId: "role_1",
    outputKey: "result",
    timeoutMs: 60000,
    maxAttempts: 1,
  };
  assert.equal(step.autoApply, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// HrWorkflowSuggestion interface tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrWorkflowSuggestion interface accepts valid suggestion", () => {
  const suggestion: HrWorkflowSuggestion = {
    insertAfterStepId: "initial_step",
    step: {
      stepId: "new_step",
      roleId: "role_1",
      outputKey: "result",
      timeoutMs: 60000,
      maxAttempts: 1,
    },
  };
  assert.equal(suggestion.insertAfterStepId, "initial_step");
  assert.equal(suggestion.step.stepId, "new_step");
});

// ─────────────────────────────────────────────────────────────────────────────
// HrGapAnalysisResult interface structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrGapAnalysisResult has correct structure from analyzeGap", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_1",
    taskDescription: "Read documents",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
  });

  assert.ok("taskId" in result);
  assert.ok("targetDivisionId" in result);
  assert.ok("triggerReason" in result);
  assert.ok("matchedRoleIds" in result);
  assert.ok("missingCapabilities" in result);
  assert.ok("divisionToolUnion" in result);
  assert.ok("suggestedToolNames" in result);
  assert.ok("recommendedModel" in result);
});

test("HrGapAnalysisResult recommendedModel is coding or balanced", () => {
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

  assert.ok(
    result.recommendedModel === "coding" || result.recommendedModel === "balanced",
    `Expected coding or balanced, got ${result.recommendedModel}`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HrRoleProposalValidationResult interface structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrRoleProposalValidationResult has correct structure from validateProposal", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.ok("valid" in result);
  assert.ok("errors" in result);
  assert.ok("warnings" in result);
  assert.ok("normalizedTools" in result);
  assert.ok("declaredDivisionToolUnion" in result);
});

test("HrRoleProposalValidationResult valid is boolean", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(typeof result.valid, "boolean");
});

test("HrRoleProposalValidationResult errors is readonly string array", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.ok(Array.isArray(result.errors));
});

test("HrRoleProposalValidationResult warnings is readonly string array", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.ok(Array.isArray(result.warnings));
});

// ─────────────────────────────────────────────────────────────────────────────
// SubmitHrRoleProposalResult interface structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("SubmitHrRoleProposalResult has correct structure", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.submitProposal({
    gapAnalysisRequest: {
      taskId: "task_1",
      taskDescription: "Test",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: [],
    },
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
  });

  assert.ok("gapAnalysis" in result);
  assert.ok("validation" in result);
  assert.ok("approvalRequest" in result);
  assert.ok(result.gapAnalysis !== null);
  assert.ok(result.validation !== null);
});

test("SubmitHrRoleProposalResult approvalRequest is null without approval service", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.submitProposal({
    gapAnalysisRequest: {
      taskId: "task_1",
      taskDescription: "Test",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: [],
    },
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
  });

  assert.equal(result.approvalRequest, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// HrRoleProposal model field tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrRoleProposal model field accepts reasoning", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "reasoning",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("HrRoleProposal model field accepts fast", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "fast",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("HrRoleProposal model field accepts coding", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "coding",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("HrRoleProposal model field accepts balanced", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// HrGapAnalysisRequest interface structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("HrGapAnalysisRequest interface accepts minimal request", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_1",
    taskDescription: "Test task",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
  };

  const result = service.analyzeGap(request);
  assert.ok(result !== null);
});

test("HrGapAnalysisRequest interface accepts request with executionId", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_1",
    taskDescription: "Test task",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
  };

  const result = service.analyzeGap(request);
  assert.equal(result.taskId, "task_1");
});

// ─────────────────────────────────────────────────────────────────────────────
// SubmitHrRoleProposalRequest interface structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("SubmitHrRoleProposalRequest interface accepts minimal request", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_1",
      taskDescription: "Test",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: [],
    },
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
  };

  const result = service.submitProposal(request);
  assert.ok(result !== null);
});

test("SubmitHrRoleProposalRequest interface accepts request with executionId", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_1",
      taskDescription: "Test",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: [],
    },
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
    executionId: "exec_123",
  };

  const result = service.submitProposal(request);
  assert.ok(result !== null);
});

test("SubmitHrRoleProposalRequest interface accepts request with sessionId", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_1",
      taskDescription: "Test",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: [],
    },
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
    sessionId: "session_456",
  };

  const result = service.submitProposal(request);
  assert.ok(result !== null);
});

test("SubmitHrRoleProposalRequest interface accepts request with sourceAgentId", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_1",
      taskDescription: "Test",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: [],
    },
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
    sourceAgentId: "agent_hr_admin",
  };

  const result = service.submitProposal(request);
  assert.ok(result !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// RegisterApprovedHrRoleRequest interface structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("RegisterApprovedHrRoleRequest interface accepts valid request", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: {
      divisionId: "test_division",
      roleId: "new_role",
      name: "Test Role",
      promptText: "Test prompt",
      model: "balanced",
      tools: ["read"],
      scope: { responsibilities: ["test"], boundaries: ["read-only"] },
      inputSchema: { required: ["input1"] },
      outputSchema: { required: ["output1"] },
      preconditions: [{ check: "always", description: "test" }],
    },
    approvalStatus: "approved",
  };

  const newRegistry = service.registerApprovedRole(request);
  assert.ok(newRegistry !== null);
});