import assert from "node:assert/strict";
import test from "node:test";

import { DeploymentInventoryService } from "../../../../../src/platform/shared/stability/deployment-inventory-service.js";

test("DeploymentInventoryService lists all deployments", () => {
  const service = new DeploymentInventoryService();
  const records = service.listDeployments();

  assert.equal(records.length, 4);
  assert.ok(records.some((r) => r.deploymentId === "deploy.dev.direct"));
  assert.ok(records.some((r) => r.deploymentId === "deploy.staging.shadow"));
  assert.ok(records.some((r) => r.deploymentId === "deploy.preprod.canary"));
  assert.ok(records.some((r) => r.deploymentId === "deploy.prod.tenant-gray"));
});

test("DeploymentInventoryService listDeployments returns a copy", () => {
  const service = new DeploymentInventoryService();
  const first = service.listDeployments();
  const second = service.listDeployments();

  assert.notEqual(first, second);
  assert.throws(() => {
    first.push({ deploymentId: "injected" } as never);
  }, /not extensible/);
  assert.equal(second.length, 4);
});

test("DeploymentInventoryService buildSummary counts all readiness statuses", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.total, 4);
  assert.equal(summary.ready, 2);
  assert.equal(summary.conditional, 2);
  assert.equal(summary.blocked, 0);
});

test("DeploymentInventoryService buildSummary counts contract_only deployments", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.contractOnly, 4);
});

test("DeploymentInventoryService buildSummary is idempotent", () => {
  const service = new DeploymentInventoryService();
  const first = service.buildSummary();
  const second = service.buildSummary();

  assert.deepEqual(first, second);
});

test("DeploymentInventoryService deploy records have correct environment values", () => {
  const service = new DeploymentInventoryService();
  const records = service.listDeployments();

  const environments = records.map((r) => r.environment);
  assert.ok(environments.includes("dev"));
  assert.ok(environments.includes("staging"));
  assert.ok(environments.includes("pre-prod"));
  assert.ok(environments.includes("prod"));
});

test("DeploymentInventoryService deploy records have correct rollout strategies", () => {
  const service = new DeploymentInventoryService();
  const records = service.listDeployments();

  const strategies = records.map((r) => r.rolloutStrategy);
  assert.ok(strategies.includes("direct"));
  assert.ok(strategies.includes("shadow"));
  assert.ok(strategies.includes("canary"));
  assert.ok(strategies.includes("tenant_gray"));
});

test("DeploymentInventoryService all deployments require drills", () => {
  const service = new DeploymentInventoryService();
  const records = service.listDeployments();

  assert.ok(records.every((r) => r.requiredDrills.length > 0));
});

test("DeploymentInventoryService all deployments are contract_only s4Mode", () => {
  const service = new DeploymentInventoryService();
  const records = service.listDeployments();

  assert.ok(records.every((r) => r.s4Mode === "contract_only"));
});
