/**
 * Issue 1946: RBAC Capability Enforcement Tests
 *
 * Tests that verify roleGrantsCapabilities and inferCapabilitiesForAction are
 * properly integrated and can be used for authorization checks.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as iam from "../../../../../src/platform/five-plane-control-plane/iam/index.js";
import type {
  PlatformPrincipalType,
  PlatformRole,
  PlatformCapability,
  AuthorizationAction,
  AuthorizationContext,
} from "../../../../../src/platform/five-plane-control-plane/iam/index.js";

test("Issue 1946: iam.index exports RBAC capability enforcement functions", () => {
  // Verify the functions are exported via the barrel
  assert.ok(typeof iam.evaluateAuthorizationContext === "function", "evaluateAuthorizationContext should be exported");
  assert.ok(typeof iam.inferCapabilitiesForAction === "function", "inferCapabilitiesForAction should be exported");
  assert.ok(typeof iam.roleGrantsCapabilities === "function", "roleGrantsCapabilities should be exported");
  assert.ok(typeof iam.capabilitiesForRole === "function", "capabilitiesForRole should be exported");
  assert.ok(typeof iam.resolvePrincipalAccessProfile === "function", "resolvePrincipalAccessProfile should be exported");
});

test("Issue 1946: iam.index exports RBAC types", () => {
  const principalType: PlatformPrincipalType = "service";
  const role: PlatformRole = "service_operator";
  const capability: PlatformCapability = "execution:dispatch";
  const action: AuthorizationAction = "dispatch_execution";
  const context: AuthorizationContext = { environment: "workspace" };

  assert.equal(principalType, "service");
  assert.equal(role, "service_operator");
  assert.equal(capability, "execution:dispatch");
  assert.equal(action, "dispatch_execution");
  assert.deepEqual(context, { environment: "workspace" });
});

test("Issue 1946: roleGrantsCapabilities verifies dispatch_execution requires execution:dispatch", () => {
  // service_operator has execution:dispatch capability
  const serviceOpCanDispatch = iam.roleGrantsCapabilities(
    ["service_operator"],
    ["execution:dispatch"],
  );
  assert.equal(serviceOpCanDispatch, true, "service_operator should be able to dispatch");

  // worker_runtime does NOT have execution:dispatch capability
  const workerCannotDispatch = iam.roleGrantsCapabilities(
    ["worker_runtime"],
    ["execution:dispatch"],
  );
  assert.equal(workerCannotDispatch, false, "worker_runtime should NOT be able to dispatch");

  // agent_runtime does NOT have execution:dispatch capability
  const agentCannotDispatch = iam.roleGrantsCapabilities(
    ["agent_runtime"],
    ["execution:dispatch"],
  );
  assert.equal(agentCannotDispatch, false, "agent_runtime should NOT be able to dispatch");
});

test("Issue 1946: inferCapabilitiesForAction maps dispatch_execution to execution:dispatch", () => {
  const caps = iam.inferCapabilitiesForAction("dispatch_execution");
  assert.deepEqual(caps, ["execution:dispatch"], "dispatch_execution should require execution:dispatch capability");
});

test("Issue 1946: inferCapabilitiesForAction maps set_isolation_level to execution:dispatch", () => {
  const caps = iam.inferCapabilitiesForAction("set_isolation_level");
  assert.deepEqual(caps, ["execution:dispatch"], "set_isolation_level should require execution:dispatch capability");
});

test("Issue 1946: evaluateAuthorizationContext denies dispatch_execution without execution:dispatch capability", () => {
  // worker_runtime attempting to dispatch - should be denied
  const workerResult = iam.evaluateAuthorizationContext({
    principalType: "worker",
    roles: ["worker_runtime"],
    action: "dispatch_execution",
  });

  assert.equal(workerResult.allowed, false, "worker_runtime should be denied for dispatch_execution");
  assert.equal(workerResult.reasonCode, "policy.capability_not_granted");
});

test("Issue 1946: evaluateAuthorizationContext allows dispatch_execution with proper capability", () => {
  // service_operator attempting to dispatch - should be allowed
  const serviceOpResult = iam.evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "dispatch_execution",
  });

  assert.equal(serviceOpResult.allowed, true, "service_operator should be allowed for dispatch_execution");
});

test("Issue 1946: capabilitiesForRole handles inheritance for human_operator", () => {
  const caps = iam.capabilitiesForRole("human_operator");
  // human_operator inherits from viewer (which has no capabilities)
  // Plus its own: model:invoke, tool:invoke, fs:write, exec:command, network:access
  assert.ok(caps.includes("model:invoke"));
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("network:access"));
});

test("Issue 1946: capabilitiesForRole handles inheritance for approver", () => {
  const caps = iam.capabilitiesForRole("approver");
  // approver inherits from viewer + its own model:invoke, tool:invoke, network:access
  assert.ok(caps.includes("model:invoke"));
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("network:access"));
});

test("Issue 1946: resolvePrincipalAccessProfile resolves capabilities from roles", () => {
  const profile = iam.resolvePrincipalAccessProfile({
    principalType: "service",
    roles: ["service_operator"],
  });

  // service_operator should have execution:dispatch from its role
  assert.ok(profile.capabilities.includes("execution:dispatch"));
});

test("Issue 1946: listPlatformRoles returns all defined roles", () => {
  const roles = iam.listPlatformRoles();
  assert.ok(roles.includes("viewer"));
  assert.ok(roles.includes("human_operator"));
  assert.ok(roles.includes("approver"));
  assert.ok(roles.includes("platform_admin"));
  assert.ok(roles.includes("agent_runtime"));
  assert.ok(roles.includes("service_operator"));
  assert.ok(roles.includes("worker_runtime"));
  assert.ok(roles.includes("plugin_runtime"));
  assert.ok(roles.includes("system_runtime"));
});

test("Issue 1946: defaultRolesForPrincipalType returns correct defaults", () => {
  assert.deepEqual(iam.defaultRolesForPrincipalType("user"), ["viewer"]);
  assert.deepEqual(iam.defaultRolesForPrincipalType("agent"), ["agent_runtime"]);
  assert.deepEqual(iam.defaultRolesForPrincipalType("system"), ["system_runtime"]);
  assert.deepEqual(iam.defaultRolesForPrincipalType("service"), ["service_operator"]);
  assert.deepEqual(iam.defaultRolesForPrincipalType("worker"), ["worker_runtime"]);
  assert.deepEqual(iam.defaultRolesForPrincipalType("plugin"), ["plugin_runtime"]);
});

test("Issue 1946: inferCapabilitiesForAction maps all actions to capabilities", () => {
  assert.deepEqual(iam.inferCapabilitiesForAction("invoke_model"), ["model:invoke"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("invoke_tool"), ["tool:invoke"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("write_file"), ["fs:write"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("exec_command"), ["exec:command"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("network_access"), ["network:access"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("install_extension"), ["extension:install"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("org_change"), ["org:change"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("dispatch_execution"), ["execution:dispatch"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("set_isolation_level"), ["execution:dispatch"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("promote_improvement"), ["improvement:promote"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("advance_rollout"), ["rollout:advance"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("modify_knowledge_trust"), ["knowledge:trust:modify"]);
  assert.deepEqual(iam.inferCapabilitiesForAction("promote_memory_layer"), ["memory:promote"]);
});

test("Issue 1946: roleGrantsCapabilities with multiple roles", () => {
  // viewer + worker_runtime combined should grant tool:invoke, fs:write, exec:command
  const result = iam.roleGrantsCapabilities(
    ["viewer", "worker_runtime"],
    ["tool:invoke", "fs:write", "exec:command"],
  );
  assert.equal(result, true, "Combined viewer and worker_runtime should grant the capabilities");
});

test("Issue 1946: roleGrantsCapabilities returns false when missing any capability", () => {
  // viewer alone cannot grant exec:command
  const result = iam.roleGrantsCapabilities(["viewer"], ["exec:command"]);
  assert.equal(result, false, "viewer should not grant exec:command");
});

test("Issue 1946: roleGrantsCapabilities returns true for empty required capabilities", () => {
  const result = iam.roleGrantsCapabilities(["viewer"], []);
  assert.equal(result, true, "Empty required capabilities should return true");
});
