/**
 * Unit tests for Tenant Lifecycle Service
 * in src/scale-ecosystem/multi-region/tenant-lifecycle-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  TenantLifecycleService,
  getTenantLifecycleService,
  resetTenantLifecycleService,
  type TenantLifecycleStage,
  type TenantLifecycleConfig,
} from "../../../../src/scale-ecosystem/multi-region/tenant-lifecycle-service.js";

function createLifecycleConfig(tenantId: string): TenantLifecycleConfig {
  return {
    tenantId,
    targetRegionId: "us-east-1",
    homeRegionId: "us-east-1",
    dataResidencyRequirements: ["US"],
    allowCrossBorder: false,
    autoSuspendOnPolicyViolation: true,
    autoSuspendThresholdDays: 30,
  };
}

test("TenantLifecycleService registers tenant in provisioning stage [tenant-lifecycle-service]", () => {
  resetTenantLifecycleService();
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");

  const state = service.registerTenant(config);

  assert.equal(state.tenantId, "tenant-1");
  assert.equal(state.currentStage, "provisioning");
  assert.ok(state.stageEnteredAt);
});

test("TenantLifecycleService transitions from provisioning to active [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);

  const result = service.activate("tenant-1", "admin", "Ready to activate");

  assert.equal(result.allowed, true);
  assert.equal(result.from, "provisioning");
  assert.equal(result.to, "active");
});

test("TenantLifecycleService rejects invalid transitions [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);

  // Cannot go directly from provisioning to suspended
  const result = service.suspend("tenant-1", "admin", "violation");

  assert.equal(result.allowed, false);
});

test("TenantLifecycleService suspends and reactivates tenant [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);
  service.activate("tenant-1", "admin", "activating");

  const suspendResult = service.suspend("tenant-1", "admin", "policy violation");
  assert.equal(suspendResult.allowed, true);
  assert.equal(suspendResult.to, "suspended");

  const reactivateResult = service.activate("tenant-1", "admin", "reactivation");
  assert.equal(reactivateResult.allowed, true);
  assert.equal(reactivateResult.to, "active");
});

test("TenantLifecycleService handles migration workflow [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);
  service.activate("tenant-1", "admin", "ready");

  const startResult = service.startMigration("tenant-1", "admin", "eu-west-1");
  assert.equal(startResult.allowed, true);
  assert.equal(startResult.to, "migrating");

  const completeResult = service.completeMigration("tenant-1", "admin", "eu-west-1");
  assert.equal(completeResult.allowed, true);
  assert.equal(completeResult.to, "active");
});

test("TenantLifecycleService deprovisions and terminates tenant [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);
  service.activate("tenant-1", "admin", "active");

  const deprovResult = service.startDeprovisioning("tenant-1", "admin", "customer requested");
  assert.equal(deprovResult.allowed, true);
  assert.equal(deprovResult.to, "deprovisioning");

  const termResult = service.terminate("tenant-1", "admin");
  assert.equal(termResult.allowed, true);
  assert.equal(termResult.to, "terminated");
});

test("TenantLifecycleService rejects transitions from terminated state [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);
  service.activate("tenant-1", "admin", "active");
  service.startDeprovisioning("tenant-1", "admin", "cleanup");
  service.terminate("tenant-1", "admin");

  const result = service.activate("tenant-1", "admin", "attempt");
  assert.equal(result.allowed, false);
});

test("TenantLifecycleService isInStage returns correct state [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);

  assert.equal(service.isInStage("tenant-1", "provisioning"), true);
  assert.equal(service.isInStage("tenant-1", "active"), false);

  service.activate("tenant-1", "admin", "activate");

  assert.equal(service.isInStage("tenant-1", "provisioning"), false);
  assert.equal(service.isInStage("tenant-1", "active"), true);
});

test("TenantLifecycleService isActive, isSuspended, isTerminated helpers [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);

  assert.equal(service.isActive("tenant-1"), false);
  assert.equal(service.isSuspended("tenant-1"), false);
  assert.equal(service.isTerminated("tenant-1"), false);

  service.activate("tenant-1", "admin", "active");
  assert.equal(service.isActive("tenant-1"), true);

  service.suspend("tenant-1", "admin", "violation");
  assert.equal(service.isSuspended("tenant-1"), true);

  service.startDeprovisioning("tenant-1", "admin", "cleanup");
  service.terminate("tenant-1", "admin");
  assert.equal(service.isTerminated("tenant-1"), true);
});

test("TenantLifecycleService records event history [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);
  service.activate("tenant-1", "admin", "first activation");
  service.suspend("tenant-1", "admin", "policy violation");

  const history = service.getHistory("tenant-1");

  assert.ok(history.length >= 3);
  assert.equal(history[0]?.stage, "provisioning");
  assert.equal(history[1]?.stage, "active");
  assert.equal(history[2]?.stage, "suspended");
});

test("TenantLifecycleService getConfig returns tenant config [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);

  const retrievedConfig = service.getConfig("tenant-1");
  assert.ok(retrievedConfig);
  assert.equal(retrievedConfig?.tenantId, "tenant-1");
  assert.equal(retrievedConfig?.homeRegionId, "us-east-1");
});

test("TenantLifecycleService returns null for unknown tenant [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();

  assert.equal(service.getState("unknown"), null);
  assert.equal(service.getConfig("unknown"), null);
});

test("TenantLifecycleService getState returns current state [tenant-lifecycle-service]", () => {
  const service = new TenantLifecycleService();
  const config = createLifecycleConfig("tenant-1");
  service.registerTenant(config);

  const state = service.getState("tenant-1");
  assert.ok(state);
  assert.equal(state?.currentStage, "provisioning");

  service.activate("tenant-1", "admin", "activating");
  const updatedState = service.getState("tenant-1");
  assert.equal(updatedState?.currentStage, "active");
  assert.equal(updatedState?.previousStage, "provisioning");
});

test("TenantLifecycleService singleton getTenantLifecycleService [tenant-lifecycle-service]", () => {
  resetTenantLifecycleService();
  const service1 = getTenantLifecycleService();
  const service2 = getTenantLifecycleService();

  assert.ok(service1 === service2);

  resetTenantLifecycleService();
});