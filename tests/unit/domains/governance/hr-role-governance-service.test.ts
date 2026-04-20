/**
 * Unit Tests: HR Role Governance Service
 *
 * Tests gap analysis, role proposal validation, and registration
 * for HR role governance in divisions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HrRoleGovernanceService,
  type HrGapAnalysisRequest,
  type HrRoleProposal,
} from "../../../../src/domains/governance/hr-role-governance-service.js";
import type { DivisionRegistry } from "../../../../src/domains/governance/division-loader.js";

/** Minimal DivisionRegistry for testing */
function makeMockDivision(
  roles: Array<{ id: string; name: string; tools: string[]; promptText?: string }>,
): DivisionRegistry {
  return {
    divisions: new Map([
      [
        "test_division",
        {
          id: "test_division",
          name: "Test Division",
          rootPath: "/tmp/test",
          roles: roles.map((r) => ({
            id: r.id,
            name: r.name,
            promptText: r.promptText ?? `Role ${r.name}`,
            tools: r.tools,
            preconditions: [],
            inputSchema: { required: [] },
            outputSchema: { required: [] },
          })),
          boundaries: [],
        },
      ],
    ]),
    workflows: new Map(),
  } as unknown as DivisionRegistry;
}

function makeMinimalProposal(overrides: Partial<HrRoleProposal> = {}): HrRoleProposal {
  const defaultProposal: HrRoleProposal = {
    divisionId: "test_division",
    roleId: "new_role_001",
    name: "New Test Role",
    promptText: "You are a test role that helps with testing",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["provide test capabilities"], boundaries: ["read-only access"] },
    inputSchema: { required: ["task"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "Always applicable" }],
  };
  return { ...defaultProposal, ...overrides };
}

test("HrRoleGovernanceService analyzeGap returns matched roles and missing capabilities", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write", "read"] },
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_001",
    taskDescription: "Write and execute a bash script",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "write"],
  });

  assert.ok(result.matchedRoleIds.length > 0, "Should find at least one matched role");
  assert.ok(
    result.matchedRoleIds.includes("role_coder"),
    "role_coder should match bash+write capabilities",
  );
  assert.ok(result.missingCapabilities.length === 0, "Should have no missing capabilities when roles match");
});

test("HrRoleGovernanceService analyzeGap identifies missing capabilities", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_002",
    taskDescription: "Execute a bash command",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash"],
  });

  assert.ok(result.missingCapabilities.includes("bash"), "Should report bash as missing capability");
  assert.ok(!result.matchedRoleIds.includes("role_reader"), "Reader role should not match bash");
});

test("HrRoleGovernanceService analyzeGap throws when division not found", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  assert.throws(
    () =>
      service.analyzeGap({
        taskId: "task_003",
        taskDescription: "Test",
        targetDivisionId: "nonexistent_division",
        triggerReason: "no_role_match",
        requestedCapabilities: [],
      }),
    /hr\.division_missing/,
  );
});

test("HrRoleGovernanceService analyzeGap throws when registry unavailable", () => {
  const service = new HrRoleGovernanceService(null, null);

  assert.throws(
    () =>
      service.analyzeGap({
        taskId: "task_004",
        taskDescription: "Test",
        targetDivisionId: "test_division",
        triggerReason: "no_role_match",
        requestedCapabilities: [],
      }),
    /division\.registry_unavailable/,
  );
});

test("HrRoleGovernanceService validateProposal passes valid proposal", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["read"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal(makeMinimalProposal());

  assert.equal(result.valid, true, "Valid proposal should pass validation");
  assert.equal(result.errors.length, 0, `Should have no errors, got: ${result.errors.join(", ")}`);
});

test("HrRoleGovernanceService validateProposal detects duplicate role ID", () => {
  const registry = makeMockDivision([
    { id: "existing_role", name: "Existing Role", tools: ["read"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal(
    makeMinimalProposal({ roleId: "existing_role" }),
  );

  assert.equal(result.valid, false, "Duplicate role ID should fail validation");
  assert.ok(result.errors.some((e) => e.includes("duplicate")), "Should report duplicate error");
});

test("HrRoleGovernanceService validateProposal detects empty name", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal(makeMinimalProposal({ name: "   " }));

  assert.equal(result.valid, false, "Empty name should fail validation");
  assert.ok(result.errors.some((e) => e.includes("name_missing")), "Should report name_missing error");
});

test("HrRoleGovernanceService validateProposal detects forbidden tools", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal(
    makeMinimalProposal({ tools: ["read", "spawn_agent", "send_message"] }),
  );

  assert.equal(result.valid, false, "Forbidden tools should fail validation");
  assert.ok(
    result.errors.some((e) => e.includes("hr.tool_forbidden")),
    `Should report hr.tool_forbidden error, got: ${result.errors.join(", ")}`,
  );
});

test("HrRoleGovernanceService validateProposal detects command restriction without boundary", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  // bash needs proper command restriction - boundaries without restriction language fails
  // "bash commands allowed" has "bash" but lacks restriction keywords (limit/restrict/only/禁止/限制/仅)
  const result = service.validateProposal(
    makeMinimalProposal({
      roleId: "proposed_bash_role",
      tools: ["bash"],
      scope: { responsibilities: ["run bash commands"], boundaries: ["bash commands allowed"] },
    }),
  );

  assert.equal(result.valid, false, "Bash without command restriction should fail validation");
  assert.ok(
    result.errors.some((e) => e.includes("command_boundary_missing")),
    `Should report command_boundary_missing, got: ${result.errors.join(", ")}`,
  );
});

test("HrRoleGovernanceService validateProposal passes with command boundaries", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  // bash with proper boundaries that include restriction language
  const result = service.validateProposal(
    makeMinimalProposal({
      roleId: "proposed_bash_role", // different from existing role_bash
      tools: ["bash"],
      scope: { responsibilities: ["run bash commands"], boundaries: ["bash limit 5 minutes"] },
    }),
  );

  assert.equal(result.valid, true, "Bash with command restriction should pass validation");
});

test("HrRoleGovernanceService analyzeGap recommendedModel is coding when tools include non-trivial ones", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash", "write"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_005",
    taskDescription: "Write code and execute it",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "write"],
  });

  assert.equal(result.recommendedModel, "coding", "Should recommend coding model for bash+write");
});

test("HrRoleGovernanceService analyzeGap recommendedModel is balanced for read-only tasks", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read", "question"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_006",
    taskDescription: "Read and summarize a document",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["read"],
  });

  assert.equal(result.recommendedModel, "balanced", "Should recommend balanced model for read-only");
});

test("HrRoleGovernanceService analyzeGap deduplicates requested capabilities", () => {
  const registry = makeMockDivision([
    { id: "role_coder", name: "Coder", tools: ["bash"] },
  ]);

  const service = new HrRoleGovernanceService(registry, null);

  const result = service.analyzeGap({
    taskId: "task_007",
    taskDescription: "Test",
    targetDivisionId: "test_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["bash", "  BASH  ", "bash"],
  });

  assert.equal(
    result.matchedRoleIds.length,
    1,
    "Should handle duplicate and whitespace-varied capabilities",
  );
});
