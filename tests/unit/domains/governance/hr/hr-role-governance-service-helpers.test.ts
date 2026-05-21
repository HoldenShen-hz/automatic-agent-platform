/**
 * Unit Tests: HR Role Governance Service - Helper Functions
 *
 * Tests internal helper functions used for validation,
 * text normalization, capability scoring, and boundary checking.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HrRoleGovernanceService,
  type HrRoleProposal,
  type HrRoleSchemaShape,
  type HrRolePrecondition,
  type HrWorkflowSuggestion,
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
// validateSchemaShape via validateProposal
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal validates schema shape with duplicate optional field", () => {
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
    inputSchema: { required: ["field1"], optional: ["field1"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("duplicate_field")));
});

test("validateProposal validates schema shape with empty required", () => {
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
    inputSchema: { required: [] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("required_missing")));
});

test("validateProposal validates output schema shape with duplicate optional field", () => {
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
    outputSchema: { required: ["output1"], optional: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("duplicate_field")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Command restriction detection via hasCommandRestriction
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal passes with bash restrict boundary", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "bash_role",
    name: "Bash Role",
    promptText: "Executes bash commands with restrictions",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run bash commands"], boundaries: ["bash restrict 5 minutes"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal passes with bash limit boundary", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "bash_role",
    name: "Bash Role",
    promptText: "Executes bash commands with limits",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run bash commands"], boundaries: ["bash limit 1 hour"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal passes with shell only boundary", () => {
  const registry = makeMockDivision([
    { id: "role_shell", name: "Shell Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "shell_role",
    name: "Shell Role",
    promptText: "Shell access",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run shell commands"], boundaries: ["shell only read operations"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal passes with Chinese restriction characters", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "bash_role",
    name: "Bash Role",
    promptText: "Restricted bash",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run bash commands"], boundaries: ["bash 禁止危险命令"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal passes with Chinese limit characters", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "bash_role",
    name: "Bash Role",
    promptText: "Limited bash",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run bash commands"], boundaries: ["bash 限制执行时间"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal passes with Chinese only characters", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "bash_role",
    name: "Bash Role",
    promptText: "Bash only",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run bash commands"], boundaries: ["bash 仅限于查询操作"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal passes with terminal limit boundary", () => {
  const registry = makeMockDivision([
    { id: "role_terminal", name: "Terminal Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "terminal_role",
    name: "Terminal Role",
    promptText: "Terminal access",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run terminal commands"], boundaries: ["terminal limit 10 minutes"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal fails with bash but no restriction", () => {
  const registry = makeMockDivision([
    { id: "role_bash", name: "Bash Role", tools: ["bash"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "bash_role",
    name: "Bash Role",
    promptText: "Unrestricted bash",
    model: "balanced",
    tools: ["bash"],
    scope: { responsibilities: ["run bash commands"], boundaries: ["bash allowed without limit"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("command_boundary_missing")));
});

test("validateProposal fails with command_exec but no restriction", () => {
  const registry = makeMockDivision([
    { id: "role_exec", name: "Exec Role", tools: ["command_exec"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "exec_role",
    name: "Exec Role",
    promptText: "Command exec",
    model: "balanced",
    tools: ["command_exec"],
    scope: { responsibilities: ["execute commands"], boundaries: ["command exec allowed"] },
    inputSchema: { required: ["command"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("command_boundary_missing")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Forbidden tool detection
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal detects spawn_agent forbidden tool", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read", "spawn_agent"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("tool_forbidden")));
});

test("validateProposal detects send_message forbidden tool", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read", "send_message"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("tool_forbidden")));
});

test("validateProposal detects both forbidden tools", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["spawn_agent", "send_message"],
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("tool_forbidden")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Read-only role detection
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal warns for read-only role with read only", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_read_role",
    name: "New Reader",
    promptText: "Read-only role",
    model: "balanced",
    tools: ["read"],
    scope: { responsibilities: ["read data"], boundaries: ["read-only access"] },
    inputSchema: { required: ["path"] },
    outputSchema: { required: ["data"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes("read_only_role")));
});

test("validateProposal warns for read-only role with read and question", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read", "question"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_qa_role",
    name: "New QA Reader",
    promptText: "Read and question role",
    model: "balanced",
    tools: ["read", "question"],
    scope: { responsibilities: ["read and query"], boundaries: ["read-only access"] },
    inputSchema: { required: ["path"] },
    outputSchema: { required: ["data"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes("read_only_role")));
});

test("validateProposal does not warn for role with write tool", () => {
  const registry = makeMockDivision([
    { id: "role_writer", name: "Writer", tools: ["read", "write"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_writer_role",
    name: "New Writer",
    promptText: "Write role",
    model: "balanced",
    tools: ["read", "write"],
    scope: { responsibilities: ["write data"], boundaries: ["read-write access"] },
    inputSchema: { required: ["path", "data"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
  assert.ok(!result.warnings.some((w) => w.includes("read_only_role")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool union validation
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal allows tools within division tool union", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
    { id: "role_writer", name: "Writer", tools: ["write"] },
  ]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "New Role",
    promptText: "New role using existing tools",
    model: "balanced",
    tools: ["read", "write"],
    scope: { responsibilities: ["read and write"], boundaries: ["read-write access"] },
    inputSchema: { required: ["path"] },
    outputSchema: { required: ["result"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal returns normalizedTools in result", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read", "write"],
    scope: { responsibilities: ["test"], boundaries: ["read-write"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.ok(Array.isArray(result.normalizedTools));
  assert.deepEqual(result.normalizedTools, ["read", "write"]);
});

test("validateProposal returns declaredDivisionToolUnion in result", () => {
  const registry = makeMockDivision([
    { id: "role_reader", name: "Reader", tools: ["read"] },
  ]);
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

  assert.ok(Array.isArray(result.declaredDivisionToolUnion));
});

// ─────────────────────────────────────────────────────────────────────────────
// Precondition validation
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal detects empty precondition check", () => {
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
    preconditions: [{ check: "  ", description: "Valid description" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("precondition_invalid")));
});

test("validateProposal detects empty precondition description", () => {
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
    preconditions: [{ check: "valid_check", description: "  " }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("precondition_invalid")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Max instances validation
// ─────────────────────────────────────────────────────────────────────────────

test("validateProposal detects non-integer maxInstances", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    maxInstances: 1.5,
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("max_instances_invalid")));
});

test("validateProposal detects negative maxInstances", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    maxInstances: -5,
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("max_instances_invalid")));
});

test("validateProposal accepts null maxInstances", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    maxInstances: null,
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});

test("validateProposal accepts positive integer maxInstances", () => {
  const registry = makeMockDivision([]);
  const service = new HrRoleGovernanceService(registry, null);

  const result = service.validateProposal({
    divisionId: "test_division",
    roleId: "new_role",
    name: "Test Role",
    promptText: "Test prompt",
    model: "balanced",
    tools: ["read"],
    maxInstances: 10,
    scope: { responsibilities: ["test"], boundaries: ["read-only"] },
    inputSchema: { required: ["input1"] },
    outputSchema: { required: ["output1"] },
    preconditions: [{ check: "always", description: "test" }],
  });

  assert.equal(result.valid, true);
});