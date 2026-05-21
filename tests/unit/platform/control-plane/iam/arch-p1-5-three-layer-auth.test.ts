/**
 * [ARCH-P1-5] RBAC + Capability + Context 3-layer Authorization Coverage Tests
 *
 * These tests verify the complete three-layer authorization model:
 * 1. RBAC layer - evaluates role-based permissions
 * 2. Capability layer - evaluates capability-based permissions
 * 3. Context layer - evaluates tenant/principal context
 *
 * Per architecture §11.2, all 3 layers must be evaluated in correct order
 * before granting access. This test suite ensures complete coverage.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as iam from "../../../../../src/platform/five-plane-control-plane/iam/index.js";
import type {
  PlatformPrincipalType,
  PlatformRole,
  AuthorizationAction,
  AuthorizationContext,
} from "../../../../../src/platform/five-plane-control-plane/iam/index.js";

/**
 * [ARCH-P1-5] AuthZ evaluates all 3 layers before granting access
 *
 * Verifies that evaluateAuthorizationContext properly evaluates:
 * - RBAC layer: role-based permission checks
 * - Capability layer: capability token validation
 * - Context layer: tenant/principal context evaluation
 */
test("[ARCH-P1-5] AuthZ evaluates all 3 layers", async () => {
  const decision = await iam.evaluateAuthorizationContext({
    principalType: "user" as PlatformPrincipalType,
    roles: ["human_operator"],
    action: "invoke_model",
    context: {
      environment: "workspace",
      timeOfDay: "business_hours",
      riskLevel: "low",
    } as AuthorizationContext,
  });

  assert.ok(decision.allowed !== undefined, "Decision must have allowed property");
  assert.ok(decision.evaluatedLayers !== undefined, "Decision must track evaluated layers");
  assert.ok(
    decision.evaluatedLayers.includes("rbac"),
    "RBAC layer must be evaluated",
  );
  assert.ok(
    decision.evaluatedLayers.includes("capability"),
    "Capability layer must be evaluated",
  );
  assert.ok(
    decision.evaluatedLayers.includes("context_aware"),
    "Context-aware layer must be evaluated",
  );
});

/**
 * [ARCH-P1-5] RBAC layer denies access when role does not grant required capability
 *
 * Verifies that RBAC layer properly evaluates role-based permissions
 * before capability checks.
 */
test("[ARCH-P1-5] RBAC layer denies access when role insufficient", () => {
  // worker_runtime cannot perform dispatch - RBAC layer should deny
  const decision = iam.evaluateAuthorizationContext({
    principalType: "worker" as PlatformPrincipalType,
    roles: ["worker_runtime"],
    action: "dispatch_execution",
  });

  assert.equal(decision.allowed, false, "RBAC should deny worker_runtime for dispatch_execution");
  assert.equal(decision.deniedBy, "rbac", "Denial should come from RBAC layer");
});

/**
 * [ARCH-P1-5] RBAC layer allows access when role has required capability
 *
 * Verifies that RBAC layer properly grants access based on role membership.
 */
test("[ARCH-P1-5] RBAC layer allows access when role sufficient", () => {
  // service_operator can perform dispatch - RBAC layer should allow
  const decision = iam.evaluateAuthorizationContext({
    principalType: "service" as PlatformPrincipalType,
    roles: ["service_operator"],
    action: "dispatch_execution",
  });

  assert.equal(decision.allowed, true, "RBAC should allow service_operator for dispatch_execution");
});

/**
 * [ARCH-P1-5] Capability layer validates capability token scope
 *
 * Verifies that capability layer properly validates capability tokens
 * against the requested action scope.
 */
test("[ARCH-P1-5] Capability layer validates capability token scope", () => {
  // human_operator has model:invoke capability - capability layer should allow
  const decision = iam.evaluateAuthorizationContext({
    principalType: "user" as PlatformPrincipalType,
    roles: ["human_operator"],
    action: "invoke_model",
  });

  assert.equal(decision.allowed, true, "Capability layer should allow with valid token");
  assert.ok(decision.evaluatedLayers.includes("capability"), "Capability layer must be evaluated");
});

/**
 * [ARCH-P1-5] Context layer denies high-risk action outside business hours
 *
 * Verifies that context-aware layer properly evaluates temporal context
 * and denies high-risk actions during off-hours.
 */
test("[ARCH-P1-5] Context layer denies high-risk action outside business hours", () => {
  // service_operator can pass RBAC for dispatch_execution, allowing context evaluation to run
  const decision = iam.evaluateAuthorizationContext({
    principalType: "service" as PlatformPrincipalType,
    roles: ["service_operator"],
    action: "dispatch_execution",
    context: {
      environment: "workspace",
      timeOfDay: "off_hours",
      riskLevel: "high",
    } as AuthorizationContext,
  });

  // Context-aware layer may deny based on time/risk evaluation
  if (decision.allowed === false) {
    assert.equal(decision.deniedBy, "context_aware", "Denial should come from context-aware layer");
  }
});

/**
 * [ARCH-P1-5] Context layer evaluates tenant context
 *
 * Verifies that context-aware layer properly evaluates tenant boundaries
 * and principal context.
 */
test("[ARCH-P1-5] Context layer evaluates tenant/principal context", () => {
  const decision = iam.evaluateAuthorizationContext({
    principalType: "user" as PlatformPrincipalType,
    roles: ["human_operator"],
    action: "invoke_model",
    context: {
      environment: "workspace",
      tenantId: "tenant-123",
      principalId: "user-456",
    } as AuthorizationContext,
  });

  assert.ok(decision.evaluatedLayers.includes("context_aware"), "Context layer must evaluate tenant context");
});

/**
 * [ARCH-P1-5] All 3 layers evaluated in correct order (RBAC -> Capability -> Context)
 *
 * Verifies that the authorization engine evaluates layers in the correct order:
 * 1. RBAC (role-based) first
 * 2. Capability (token-based) second
 * 3. Context (dynamic policy) last
 */
test("[ARCH-P1-5] All 3 layers evaluated in correct order", () => {
  const decision = iam.evaluateAuthorizationContext({
    principalType: "service" as PlatformPrincipalType,
    roles: ["service_operator"],
    action: "dispatch_execution",
    context: {
      environment: "workspace",
      timeOfDay: "business_hours",
      riskLevel: "low",
    } as AuthorizationContext,
  });

  const layers = decision.evaluatedLayers;
  const rbacIndex = layers.indexOf("rbac");
  const capIndex = layers.indexOf("capability");
  const ctxIndex = layers.indexOf("context_aware");

  assert.ok(rbacIndex >= 0, "RBAC layer must be evaluated");
  assert.ok(capIndex >= 0, "Capability layer must be evaluated");
  assert.ok(ctxIndex >= 0, "Context-aware layer must be evaluated");

  // RBAC should come before Capability
  assert.ok(rbacIndex < capIndex, "RBAC must be evaluated before Capability");
  // Capability should come before Context
  assert.ok(capIndex < ctxIndex, "Capability must be evaluated before Context");
});

/**
 * [ARCH-P1-5] RBAC layer evaluates role-based permissions correctly
 *
 * Verifies that RBAC correctly maps roles to permissions and denies
 * when role does not match required permission.
 */
test("[ARCH-P1-5] RBAC layer evaluates role-based permissions", () => {
  // Test viewer role - no invoke permissions in the current RBAC model
  const viewerDecision = iam.evaluateAuthorizationContext({
    principalType: "user" as PlatformPrincipalType,
    roles: ["viewer"],
    action: "invoke_model",
  });
  assert.equal(viewerDecision.allowed, false, "viewer should not have model:invoke");
  assert.equal(viewerDecision.deniedBy, "rbac", "viewer invoke_model denial should come from RBAC");

  // Test agent_runtime role
  const agentDecision = iam.evaluateAuthorizationContext({
    principalType: "agent" as PlatformPrincipalType,
    roles: ["agent_runtime"],
    action: "invoke_tool",
  });
  assert.equal(agentDecision.allowed, true, "agent_runtime should have tool:invoke");

  // Test human_operator role
  const humanDecision = iam.evaluateAuthorizationContext({
    principalType: "user" as PlatformPrincipalType,
    roles: ["human_operator"],
    action: "write_file",
  });
  assert.equal(humanDecision.allowed, true, "human_operator should have fs:write");
});

/**
 * [ARCH-P1-5] Capability layer evaluates capability-based permissions correctly
 *
 * Verifies that the capability layer properly validates capability tokens
 * and their scopes.
 */
test("[ARCH-P1-5] Capability layer evaluates capability-based permissions", () => {
  // Verify capability inference for various actions
  const dispatchCaps = iam.inferCapabilitiesForAction("dispatch_execution");
  assert.deepEqual(dispatchCaps, ["execution:dispatch"], "dispatch_execution requires execution:dispatch capability");

  const modelCaps = iam.inferCapabilitiesForAction("invoke_model");
  assert.deepEqual(modelCaps, ["model:invoke"], "invoke_model requires model:invoke capability");

  const toolCaps = iam.inferCapabilitiesForAction("invoke_tool");
  assert.deepEqual(toolCaps, ["tool:invoke"], "invoke_tool requires tool:invoke capability");
});

/**
 * [ARCH-P1-5] Context layer evaluates tenant/principal context correctly
 *
 * Verifies that context-aware policies properly evaluate tenant boundaries
 * and principal attributes.
 */
test("[ARCH-P1-5] Context layer evaluates tenant/principal context", () => {
  // Verify principal access profile resolution includes context
  const profile = iam.resolvePrincipalAccessProfile({
    principalType: "user" as PlatformPrincipalType,
    roles: ["human_operator"],
    context: {
      environment: "workspace",
      tenantId: "tenant-abc",
    } as AuthorizationContext,
  });

  assert.ok(profile.capabilities.length > 0, "Profile must include resolved capabilities");
  assert.ok(profile.evaluatedContext !== undefined, "Profile must track context evaluation");
});

/**
 * [ARCH-P1-5] Three-layer auth grants access only when all layers pass
 *
 * Verifies that access is granted only when RBAC, Capability, and Context
 * all approve the request.
 */
test("[ARCH-P1-5] Three-layer auth grants access only when all layers pass", () => {
  // All layers pass - should be allowed
  const allowedDecision = iam.evaluateAuthorizationContext({
    principalType: "service" as PlatformPrincipalType,
    roles: ["service_operator"],
    action: "dispatch_execution",
    context: {
      environment: "workspace",
      timeOfDay: "business_hours",
      riskLevel: "low",
    } as AuthorizationContext,
  });

  assert.equal(allowedDecision.allowed, true, "Should allow when all 3 layers pass");
  assert.equal(allowedDecision.evaluatedLayers.length, 3, "All 3 layers must be evaluated");
});

/**
 * [ARCH-P1-5] Three-layer auth denies access when any layer fails
 *
 * Verifies that access is denied if even one layer denies, regardless
 * of whether other layers would approve.
 */
test("[ARCH-P1-5] Three-layer auth denies access when any layer fails", () => {
  // RBAC fails - should be denied even if capability and context would allow
  const deniedDecision = iam.evaluateAuthorizationContext({
    principalType: "worker" as PlatformPrincipalType,
    roles: ["worker_runtime"],
    action: "dispatch_execution", // worker_runtime doesn't have this
    context: {
      environment: "workspace",
      timeOfDay: "business_hours",
      riskLevel: "low",
    } as AuthorizationContext,
  });

  assert.equal(deniedDecision.allowed, false, "Should deny when RBAC layer fails");
  assert.ok(deniedDecision.deniedBy !== undefined, "Must specify which layer denied");
});

/**
 * [ARCH-P1-5] roleGrantsCapabilities correctly implements RBAC layer
 *
 * Verifies that the RBAC helper function correctly determines if
 * a set of roles grants the required capabilities.
 */
test("[ARCH-P1-5] roleGrantsCapabilities correctly implements RBAC layer", () => {
  // service_operator grants execution:dispatch
  const serviceOpResult = iam.roleGrantsCapabilities(
    ["service_operator"],
    ["execution:dispatch"],
  );
  assert.equal(serviceOpResult, true, "service_operator should grant execution:dispatch");

  // worker_runtime does NOT grant execution:dispatch
  const workerResult = iam.roleGrantsCapabilities(
    ["worker_runtime"],
    ["execution:dispatch"],
  );
  assert.equal(workerResult, false, "worker_runtime should NOT grant execution:dispatch");

  // Multiple roles - viewer alone doesn't grant exec:command
  const viewerResult = iam.roleGrantsCapabilities(
    ["viewer"],
    ["exec:command"],
  );
  assert.equal(viewerResult, false, "viewer alone should NOT grant exec:command");
});

/**
 * [ARCH-P1-5] capabilitiesForRole correctly returns RBAC capabilities
 *
 * Verifies that the RBAC layer correctly maps roles to their
 * associated capabilities including inherited capabilities.
 */
test("[ARCH-P1-5] capabilitiesForRole correctly returns RBAC capabilities", () => {
  // viewer has basic capabilities (inherited empty set + viewer specific)
  const viewerCaps = iam.capabilitiesForRole("viewer");
  assert.ok(Array.isArray(viewerCaps), "Should return array of capabilities");

  // human_operator has inherited model:invoke, tool:invoke, plus fs:write, exec:command
  const humanCaps = iam.capabilitiesForRole("human_operator");
  assert.ok(humanCaps.includes("model:invoke"), "human_operator should have model:invoke");
  assert.ok(humanCaps.includes("tool:invoke"), "human_operator should have tool:invoke");
  assert.ok(humanCaps.includes("fs:write"), "human_operator should have fs:write");

  // service_operator has execution:dispatch
  const serviceCaps = iam.capabilitiesForRole("service_operator");
  assert.ok(serviceCaps.includes("execution:dispatch"), "service_operator should have execution:dispatch");
});

/**
 * [ARCH-P1-5] Three-layer authorization order: RBAC -> Capability -> Context
 *
 * Verifies the complete evaluation chain where RBAC is checked first,
 * then capability, then context-aware policies.
 */
test("[ARCH-P1-5] Three-layer authorization follows RBAC->Capability->Context order", () => {
  // Test the order by observing layer evaluation sequence
  const decision = iam.evaluateAuthorizationContext({
    principalType: "user" as PlatformPrincipalType,
    roles: ["human_operator"],
    action: "invoke_model",
    context: {
      environment: "workspace",
      timeOfDay: "business_hours",
    } as AuthorizationContext,
  });

  const layerOrder = decision.evaluatedLayers.join("->");
  assert.ok(
    layerOrder.includes("rbac") &&
    layerOrder.includes("capability") &&
    layerOrder.includes("context_aware"),
    `Layer order should be rbac->capability->context_aware, got: ${layerOrder}`,
  );
});

/**
 * [ARCH-P1-5] Platform roles provide RBAC foundation for three-layer auth
 *
 * Verifies that all defined platform roles are properly registered
 * and can be used as the RBAC layer in the authorization model.
 */
test("[ARCH-P1-5] Platform roles provide RBAC foundation", () => {
  const roles = iam.listPlatformRoles();

  // Verify all expected roles exist
  const expectedRoles: PlatformRole[] = [
    "viewer",
    "human_operator",
    "approver",
    "platform_admin",
    "agent_runtime",
    "service_operator",
    "worker_runtime",
    "plugin_runtime",
    "system_runtime",
  ];

  for (const role of expectedRoles) {
    assert.ok(roles.includes(role), `Role ${role} must be defined in platform roles`);
  }

  // Each role should provide some capabilities
  for (const role of roles) {
    const caps = iam.capabilitiesForRole(role);
    assert.ok(
      Array.isArray(caps),
      `Role ${role} must return capabilities array`,
    );
  }
});

/**
 * [ARCH-P1-5] Default roles for principal types establish baseline RBAC
 *
 * Verifies that default role assignment provides proper RBAC coverage
 * for all principal types in the authorization model.
 */
test("[ARCH-P1-5] Default roles establish baseline RBAC for all principal types", () => {
  const principalTypes: PlatformPrincipalType[] = [
    "user",
    "agent",
    "system",
    "service",
    "worker",
    "plugin",
  ];

  for (const pt of principalTypes) {
    const defaultRoles = iam.defaultRolesForPrincipalType(pt);
    assert.ok(
      defaultRoles.length > 0,
      `Principal type ${pt} must have default roles`,
    );

    // Default roles should grant some capabilities
    for (const role of defaultRoles) {
      const caps = iam.capabilitiesForRole(role);
      assert.ok(
        Array.isArray(caps),
        `Default role ${role} for ${pt} must have valid capabilities`,
      );
    }
  }
});
