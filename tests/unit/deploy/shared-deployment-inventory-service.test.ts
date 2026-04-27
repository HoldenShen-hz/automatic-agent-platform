/**
 * Deployment Inventory Service from shared/stability Tests
 *
 * Tests for the deployment inventory service that tracks deployments
 * across environments.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DeploymentInventoryService } from "../../../src/platform/shared/stability/deployment-inventory-service.js";

test("DeploymentInventoryService exports deployment inventory record type", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  assert.ok(deployments.length > 0, "Should have at least one deployment");

  for (const deploy of deployments) {
    assert.ok(typeof deploy.deploymentId === "string", "deploymentId should be string");
    assert.ok(["dev", "test", "staging", "pre-prod", "prod"].includes(deploy.environment), "Invalid environment");
    assert.ok(["direct", "shadow", "canary", "tenant_gray"].includes(deploy.rolloutStrategy), "Invalid rollout strategy");
    assert.ok(["ready", "conditional", "blocked"].includes(deploy.readinessStatus), "Invalid readiness status");
    assert.ok(typeof deploy.requiresLiveInfra === "boolean", "requiresLiveInfra should be boolean");
    assert.ok(["contract_only", "live_required"].includes(deploy.s4Mode), "Invalid s4Mode");
    assert.ok(Array.isArray(deploy.requiredDrills), "requiredDrills should be array");
  }
});

test("DeploymentInventoryService buildSummary calculates summary correctly", () => {
  const service = new DeploymentInventoryService();
  const allDeployments = service.listDeployments();
  const summary = service.buildSummary();

  assert.equal(summary.total, allDeployments.length, "Total should match deployments count");

  const readyCount = allDeployments.filter((d) => d.readinessStatus === "ready").length;
  const conditionalCount = allDeployments.filter((d) => d.readinessStatus === "conditional").length;
  const blockedCount = allDeployments.filter((d) => d.readinessStatus === "blocked").length;

  assert.equal(summary.ready, readyCount);
  assert.equal(summary.conditional, conditionalCount);
  assert.equal(summary.blocked, blockedCount);

  const contractOnlyCount = allDeployments.filter((d) => d.s4Mode === "contract_only").length;
  assert.equal(summary.contractOnly, contractOnlyCount);
});

test("DeploymentInventoryService deployments have correct requiredDrills by environment", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const devDeploy = deployments.find((d) => d.environment === "dev");
  assert.ok(devDeploy, "Should have dev deployment");
  assert.ok(devDeploy.requiredDrills.includes("backup_restore"), "Dev should require backup_restore");

  const prodDeploy = deployments.find((d) => d.environment === "prod");
  assert.ok(prodDeploy, "Should have prod deployment");
  assert.ok(prodDeploy.requiredDrills.includes("regional_failover"), "Prod should require regional_failover");
  assert.ok(prodDeploy.requiredDrills.includes("worker_reassignment"), "Prod should require worker_reassignment");
});

test("DeploymentInventoryService listDeployments returns copy not original", () => {
  const service = new DeploymentInventoryService();
  const deployments1 = service.listDeployments();
  const deployments2 = service.listDeployments();

  assert.notEqual(deployments1, deployments2, "Should return different array instances");
});

test("DeploymentInventoryService buildSummary returns new object each call", () => {
  const service = new DeploymentInventoryService();
  const summary1 = service.buildSummary();
  const summary2 = service.buildSummary();

  assert.notEqual(summary1, summary2, "Should return different object instances");
  assert.deepEqual(summary1, summary2, "Values should be equal");
});