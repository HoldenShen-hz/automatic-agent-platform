/**
 * Unit tests for Deployment Inventory Service Module.
 *
 * Tests the deployment inventory functionality:
 * - List deployments
 * - Build summary statistics
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DeploymentInventoryService } from "../../../../../src/platform/shared/stability/deployment-inventory-service.js";

test("DeploymentInventoryService lists all deployments", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  assert.ok(deployments.length > 0);
  assert.ok(deployments.every((d) => d.deploymentId.length > 0));
});

test("DeploymentInventoryService deployments have valid environments", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const validEnvironments = ["dev", "test", "staging", "pre-prod", "prod"];
  assert.ok(deployments.every((d) => validEnvironments.includes(d.environment)));
});

test("DeploymentInventoryService deployments have valid rollout strategies", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const validStrategies = ["direct", "shadow", "canary", "tenant_gray"];
  assert.ok(deployments.every((d) => validStrategies.includes(d.rolloutStrategy)));
});

test("DeploymentInventoryService deployments have valid readiness statuses", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const validStatuses = ["ready", "conditional", "blocked"];
  assert.ok(deployments.every((d) => validStatuses.includes(d.readinessStatus)));
});

test("DeploymentInventoryService deployments have required drills", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  assert.ok(deployments.every((d) => d.requiredDrills.length > 0));
});

test("DeploymentInventoryService buildSummary computes correct totals", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.total, service.listDeployments().length);
  assert.ok(summary.ready >= 0);
  assert.ok(summary.conditional >= 0);
  assert.ok(summary.blocked >= 0);
});

test("DeploymentInventoryService buildSummary sums to total", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  assert.equal(
    summary.ready + summary.conditional + summary.blocked,
    summary.total,
  );
});

test("DeploymentInventoryService buildSummary counts contract_only deployments", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  const deployments = service.listDeployments();
  const contractOnlyCount = deployments.filter((d) => d.s4Mode === "contract_only").length;

  assert.equal(summary.contractOnly, contractOnlyCount);
});

test("DeploymentInventoryService dev deployment requires no live infra", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const devDeployments = deployments.filter((d) => d.environment === "dev");
  assert.ok(devDeployments.every((d) => d.requiresLiveInfra === false));
});

test("DeploymentInventoryService prod deployment does not require live infra for contract", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const prodDeployments = deployments.filter((d) => d.environment === "prod");
  // In contract_only mode, no live infra is needed
  assert.ok(prodDeployments.every((d) => d.s4Mode === "contract_only"));
});

test("DeploymentInventoryService returns defensive copy of deployments", () => {
  const service = new DeploymentInventoryService();
  const deployments1 = service.listDeployments();
  const deployments2 = service.listDeployments();

  // Should be equal but not the same reference
  assert.deepEqual(deployments1, deployments2);
  deployments1.push({ deploymentId: "test" } as never);
  assert.notEqual(service.listDeployments().length, deployments1.length);
});
