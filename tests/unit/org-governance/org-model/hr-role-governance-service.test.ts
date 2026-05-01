import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRequest, ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { PolicyDeniedError, StorageError, ValidationError } from "../../../../src/platform/contracts/errors.js";
import type {
  DivisionRegistry,
  DivisionRoleDefinition,
  LoadedDivisionDefinition,
} from "../../../../src/domains/governance/division-loader.js";
import {
  HrRoleGovernanceService,
  type HrGapAnalysisRequest,
  type HrGapAnalysisResult,
  type HrRoleProposal,
  type HrRoleProposalValidationResult,
  type SubmitHrRoleProposalRequest,
  type SubmitHrRoleProposalResult,
  type RegisterApprovedHrRoleRequest,
} from "../../../../src/org-governance/org-model/hr-role-governance-service.js";

function makeMockRole(overrides: Partial<DivisionRoleDefinition> = {}): DivisionRoleDefinition {
  return {
    id: "test_role",
    name: "Test Role",
    promptPath: "/divisions/test/roles/test.prompt.md",
    promptText: "You are a test agent that handles deployments and kubernetes tasks",
    model: "balanced",
    tools: ["read", "question", "bash"],
    maxInstances: null,
    ...overrides,
  };
}

function makeMockDivision(overrides: Partial<LoadedDivisionDefinition> = {}): LoadedDivisionDefinition {
  return {
    id: "test_division",
    version: "1",
    name: "Test Division",
    description: "A test division",
    priority: 100,
    triggers: ["test"],
    defaultWorkflowId: "test_workflow",
    orchestrationWorkflowId: null,
    roles: [makeMockRole()],
    workflows: [],
    rootPath: "/divisions/test",
    ...overrides,
  };
}

function makeMockRegistry(divisions: Map<string, LoadedDivisionDefinition> = new Map([["test_division", makeMockDivision()]])): DivisionRegistry {
  return {
    divisions,
    workflows: new Map(),
  };
}

function makeValidProposal(overrides: Partial<HrRoleProposal> = {}): HrRoleProposal {
  return {
    divisionId: "test_division",
    roleId: "new_role",
    name: "New Role",
    promptText: "You are a new agent",
    model: "coding",
    tools: ["read", "bash"],
    scope: {
      responsibilities: ["deploy applications", "manage infrastructure"],
      boundaries: ["no production access", "restricted bash commands"],
    },
    inputSchema: { required: ["taskId"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "is_authenticated", description: "User must be authenticated" }],
    ...overrides,
  };
}

function makeMockApprovalService(): ApprovalService {
  return {
    createRequest: (input: Omit<ApprovalRequest, "approvalId" | "createdAt">): ApprovalRequest => {
      return {
        approvalId: "approval_123",
        status: "pending",
        createdAt: "2026-05-02T00:00:00.000Z",
        ...input,
        harnessRunId: null,
        nodeRunId: null,
        executionId: input.executionId ?? null,
      };
    },
  } as unknown as ApprovalService;
}

// ---------------------------------------------------------------------------
// HrRoleGovernanceService.analyzeGap
// ---------------------------------------------------------------------------

test("analyzeGap matches roles based on capability tokens", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_001",
    taskDescription: "Deploy a kubernetes service",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["kubernetes", "deployment"],
  };

  const result = service.analyzeGap(request);

  assert.equal(result.taskId, "task_001");
  assert.equal(result.targetDivisionId, "test_division");
  assert.equal(result.triggerReason, "no_role_match");
  assert.ok(Array.isArray(result.matchedRoleIds));
  assert.ok(Array.isArray(result.missingCapabilities));
  assert.ok(Array.isArray(result.divisionToolUnion));
  assert.ok(Array.isArray(result.suggestedToolNames));
  assert.ok(result.recommendedModel === "coding" || result.recommendedModel === "balanced");
});

test("analyzeGap returns missing capabilities when no role matches", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_002",
    taskDescription: "Do something unrelated",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["completely_unknown_capability_xyz"],
  };

  const result = service.analyzeGap(request);

  assert.ok(result.missingCapabilities.length > 0, "expected missing capabilities for unknown capability");
  assert.deepEqual(result.matchedRoleIds, []);
});

test("analyzeGap sorts matched roles by score descending", () => {
  const highScoreRole = makeMockRole({ id: "role_kubernetes", name: "Kubernetes Admin", promptText: "kubernetes docker container deployment", tools: ["bash", "read"] });
  const lowScoreRole = makeMockRole({ id: "role_coding", name: "Coding Agent", promptText: "write code edit files", tools: ["read", "edit"] });
  const division = makeMockDivision({ id: "scored_division", roles: [lowScoreRole, highScoreRole] });
  const registry = makeMockRegistry(new Map([["scored_division", division]]));
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_003",
    taskDescription: "Manage containers",
    targetDivisionId: "scored_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["kubernetes", "container"],
  };

  const result = service.analyzeGap(request);

  assert.ok(result.matchedRoleIds.length > 0);
  assert.equal(result.matchedRoleIds[0], "role_kubernetes");
});

test("analyzeGap throws StorageError when registry is unavailable", () => {
  const service = new HrRoleGovernanceService(null, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_004",
    taskDescription: "Deploy",
    targetDivisionId: "missing_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["deploy"],
  };

  assert.throws(
    () => service.analyzeGap(request),
    (err: unknown) => err instanceof StorageError && err.code === "division.registry_unavailable",
  );
});

test("analyzeGap throws StorageError when division not found", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const request: HrGapAnalysisRequest = {
    taskId: "task_005",
    taskDescription: "Deploy",
    targetDivisionId: "nonexistent_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["deploy"],
  };

  assert.throws(
    () => service.analyzeGap(request),
    (err: unknown) => err instanceof StorageError && err.code.startsWith("hr.division_missing"),
  );
});

// ---------------------------------------------------------------------------
// HrRoleGovernanceService.validateProposal
// ---------------------------------------------------------------------------

test("validateProposal passes for valid proposal", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal();

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, true, `expected valid result, got errors: ${result.errors.join(", ")}`);
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.normalizedTools));
  assert.ok(Array.isArray(result.declaredDivisionToolUnion));
});

test("validateProposal detects duplicate role ID", () => {
  const existingRole = makeMockRole({ id: "duplicate_role" });
  const division = makeMockDivision({ roles: [existingRole] });
  const registry = makeMockRegistry(new Map([["test_division", division]]));
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({ roleId: "duplicate_role" });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.role_duplicate")), `expected duplicate error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects missing required fields", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({ name: "   ", promptText: "" });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("hr.role_name_missing"), `expected name error, got: ${result.errors.join(", ")}`);
  assert.ok(result.errors.includes("hr.prompt_missing"), `expected prompt error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects missing scope responsibilities and boundaries", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    scope: { responsibilities: [], boundaries: [] },
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("hr.scope_responsibilities_missing"), `expected responsibilities error, got: ${result.errors.join(", ")}`);
  assert.ok(result.errors.includes("hr.scope_boundaries_missing"), `expected boundaries error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects missing preconditions", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({ preconditions: [] });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("hr.preconditions_missing"), `expected preconditions error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects invalid preconditions with empty check/description", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    preconditions: [{ check: "   ", description: "some description" }],
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("hr.precondition_invalid"), `expected precondition error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects invalid schema shape with empty required fields", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    inputSchema: { required: [] },
    outputSchema: { required: [] },
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.input_schema.required_missing")), `expected input_schema error, got: ${result.errors.join(", ")}`);
  assert.ok(result.errors.some((e) => e.includes("hr.output_schema.required_missing")), `expected output_schema error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects duplicate fields in schema optional vs required", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    inputSchema: { required: ["taskId"], optional: ["taskId"] },
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.input_schema.duplicate_field")), `expected duplicate field error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects forbidden tools", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({ tools: ["spawn_agent", "read"] });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.tool_forbidden")), `expected forbidden tool error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects command tools without command boundary restriction", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    tools: ["bash"],
    scope: {
      responsibilities: ["run commands"],
      boundaries: ["can access dev environment"],
    },
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.command_boundary_missing")), `expected command boundary error, got: ${result.errors.join(", ")}`);
});

test("validateProposal accepts command tools with proper boundary restriction", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    tools: ["bash"],
    scope: {
      responsibilities: ["run commands"],
      boundaries: ["bash restricted to dev only"],
    },
  });

  const result = service.validateProposal(proposal);

  // Command boundary check should not trigger error when boundaries contain restrictive language
  const commandBoundaryError = result.errors.filter((e) => e.includes("command_boundary_missing"));
  assert.deepEqual(commandBoundaryError, [], `unexpected command boundary errors: ${result.errors.join(", ")}`);
});

test("validateProposal detects workflow autoApply denial", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    workflowSuggestion: {
      insertAfterStepId: "step_0",
      step: {
        stepId: "step_1",
        roleId: "new_role",
        outputKey: "output",
        timeoutMs: 30000,
        maxAttempts: 1,
        autoApply: true,
      },
    },
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.workflow_auto_apply_denied")), `expected auto_apply error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects workflow role mismatch", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({
    workflowSuggestion: {
      insertAfterStepId: "step_0",
      step: {
        stepId: "step_1",
        roleId: "different_role",
        outputKey: "output",
        timeoutMs: 30000,
        maxAttempts: 1,
      },
    },
  });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("hr.workflow_role_mismatch")), `expected role mismatch error, got: ${result.errors.join(", ")}`);
});

test("validateProposal detects invalid maxInstances", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({ maxInstances: 0 });

  const result = service.validateProposal(proposal);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("hr.max_instances_invalid"), `expected max_instances error, got: ${result.errors.join(", ")}`);
});

test("validateProposal adds read-only warning when only read/question tools", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const proposal = makeValidProposal({ tools: ["read", "question"] });

  const result = service.validateProposal(proposal);

  assert.ok(result.warnings.includes("hr.read_only_role"), `expected read_only warning, got: ${result.warnings.join(", ")}`);
});

test("validateProposal throws StorageError when registry unavailable", () => {
  const service = new HrRoleGovernanceService(null, null);

  assert.throws(
    () => service.validateProposal(makeValidProposal()),
    (err: unknown) => err instanceof StorageError && err.code === "division.registry_unavailable",
  );
});

// ---------------------------------------------------------------------------
// HrRoleGovernanceService.submitProposal
// ---------------------------------------------------------------------------

test("submitProposal returns gap analysis and validation without approval when no approval service", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_010",
      taskDescription: "Deploy service",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: ["deploy"],
    },
    proposal: makeValidProposal(),
  };

  const result = service.submitProposal(request);

  assert.ok(result.gapAnalysis);
  assert.ok(result.validation);
  assert.equal(result.approvalRequest, null);
});

test("submitProposal returns approval request when approval service is configured", () => {
  const registry = makeMockRegistry();
  const approvalService = makeMockApprovalService();
  const service = new HrRoleGovernanceService(registry, approvalService);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_011",
      taskDescription: "Deploy service",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: ["deploy"],
    },
    proposal: makeValidProposal(),
    sessionId: "session_123",
    sourceAgentId: "agent_test",
  };

  const result = service.submitProposal(request);

  assert.ok(result.gapAnalysis);
  assert.ok(result.validation);
  assert.ok(result.approvalRequest !== null);
  assert.equal(result.approvalRequest?.sourceAgentId, "agent_test");
  assert.equal(result.approvalRequest?.taskId, "task_011");
  assert.ok(result.approvalRequest?.reason.includes("hr.role_creation"));
});

test("submitProposal returns null approval request when validation fails", () => {
  const registry = makeMockRegistry();
  const approvalService = makeMockApprovalService();
  const service = new HrRoleGovernanceService(registry, approvalService);

  const request: SubmitHrRoleProposalRequest = {
    gapAnalysisRequest: {
      taskId: "task_012",
      taskDescription: "Deploy",
      targetDivisionId: "test_division",
      triggerReason: "no_role_match",
      requestedCapabilities: ["deploy"],
    },
    proposal: makeValidProposal({ name: "   " }),
  };

  const result = service.submitProposal(request);

  assert.ok(result.gapAnalysis);
  assert.equal(result.validation.valid, false);
  assert.equal(result.approvalRequest, null);
});

// ---------------------------------------------------------------------------
// HrRoleGovernanceService.registerApprovedRole
// ---------------------------------------------------------------------------

test("registerApprovedRole adds role to division registry", () => {
  const originalDivision = makeMockDivision();
  const registry = makeMockRegistry(new Map([["test_division", originalDivision]]));
  const service = new HrRoleGovernanceService(registry, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: makeValidProposal(),
    approvalStatus: "approved",
  };

  const result = service.registerApprovedRole(request);

  const updatedDivision = result.divisions.get("test_division");
  assert.ok(updatedDivision, "division should exist after registration");
  assert.equal(updatedDivision!.roles.length, 2, "should have original role plus new role");
  const newRole = updatedDivision!.roles.find((r) => r.id === "new_role");
  assert.ok(newRole, "new role should be registered");
  assert.equal(newRole!.name, "New Role");
  assert.equal(newRole!.model, "coding");
});

test("registerApprovedRole rejects non-approved status", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: makeValidProposal(),
    approvalStatus: "rejected" as "approved",
  };

  assert.throws(
    () => service.registerApprovedRole(request),
    (err: unknown) => err instanceof PolicyDeniedError && err.code === "hr.role_registration_requires_approval",
  );
});

test("registerApprovedRole throws ValidationError for invalid proposal", () => {
  const registry = makeMockRegistry();
  const service = new HrRoleGovernanceService(registry, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: makeValidProposal({ name: "" }),
    approvalStatus: "approved",
  };

  assert.throws(
    () => service.registerApprovedRole(request),
    (err: unknown) => err instanceof ValidationError && err.code.includes("hr.role_proposal_invalid"),
  );
});

test("registerApprovedRole throws StorageError when registry unavailable", () => {
  const service = new HrRoleGovernanceService(null, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: makeValidProposal(),
    approvalStatus: "approved",
  };

  assert.throws(
    () => service.registerApprovedRole(request),
    (err: unknown) => err instanceof StorageError && err.code === "division.registry_unavailable",
  );
});

test("registerApprovedRole sets correct role properties including maxInstances default", () => {
  const originalDivision = makeMockDivision();
  const registry = makeMockRegistry(new Map([["test_division", originalDivision]]));
  const service = new HrRoleGovernanceService(registry, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: makeValidProposal({ maxInstances: null }),
    approvalStatus: "approved",
  };

  const result = service.registerApprovedRole(request);
  const updatedDivision = result.divisions.get("test_division");
  const newRole = updatedDivision!.roles.find((r) => r.id === "new_role");
  assert.equal(newRole!.maxInstances, 1, "null maxInstances should default to 1");
});

test("registerApprovedRole uses explicit maxInstances when provided", () => {
  const originalDivision = makeMockDivision();
  const registry = makeMockRegistry(new Map([["test_division", originalDivision]]));
  const service = new HrRoleGovernanceService(registry, null);

  const request: RegisterApprovedHrRoleRequest = {
    proposal: makeValidProposal({ maxInstances: 5 }),
    approvalStatus: "approved",
  };

  const result = service.registerApprovedRole(request);
  const updatedDivision = result.divisions.get("test_division");
  const newRole = updatedDivision!.roles.find((r) => r.id === "new_role");
  assert.equal(newRole!.maxInstances, 5);
});

// ---------------------------------------------------------------------------
// Constructor and edge cases
// ---------------------------------------------------------------------------

test("HrRoleGovernanceService accepts null division registry and null approval service", () => {
  const service = new HrRoleGovernanceService(null, null);
  assert.ok(service instanceof HrRoleGovernanceService);
});

test("HrRoleGovernanceService accepts custom division registry and approval service", () => {
  const registry = makeMockRegistry();
  const approvalService = makeMockApprovalService();
  const service = new HrRoleGovernanceService(registry, approvalService);
  assert.ok(service instanceof HrRoleGovernanceService);
});