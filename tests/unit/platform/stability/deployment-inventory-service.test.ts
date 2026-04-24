import assert from "node:assert/strict";
import test from "node:test";

import {
  DeploymentInventoryService,
  DeploymentInventoryRecord,
} from "../../../../src/platform/stability/deployment-inventory-service.js";

test("DeploymentInventoryService lists all default deployments", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  assert.ok(Array.isArray(deployments));
  assert.ok(deployments.length > 0);
});

test("DeploymentInventoryService returns immutable deployment records", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  // Records should be frozen
  assert.ok(Object.isFrozen(deployments));
});

test("DeploymentInventoryService buildSummary returns correct total", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();
  const summary = service.buildSummary();

  assert.equal(summary.total, deployments.length);
});

test("DeploymentInventoryService buildSummary counts readiness statuses", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  assert.ok(typeof summary.ready === "number");
  assert.ok(typeof summary.conditional === "number");
  assert.ok(typeof summary.blocked === "number");
  assert.ok(typeof summary.contractOnly === "number");
});

test("DeploymentInventoryService buildSummary total equals ready plus conditional plus blocked", () => {
  const service = new DeploymentInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.ready + summary.conditional + summary.blocked, summary.total);
});

test("DeploymentInventoryService each deployment has required fields", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  for (const deployment of deployments) {
    assert.ok(typeof deployment.deploymentId === "string");
    assert.ok(["dev", "test", "staging", "pre-prod", "prod"].includes(deployment.environment));
    assert.ok(["direct", "shadow", "canary", "tenant_gray"].includes(deployment.rolloutStrategy));
    assert.ok(["ready", "conditional", "blocked"].includes(deployment.readinessStatus));
    assert.equal(typeof deployment.requiresLiveInfra, "boolean");
    assert.ok(["contract_only", "live_required"].includes(deployment.s4Mode));
    assert.ok(Array.isArray(deployment.requiredDrills));
  }
});

test("DeploymentInventoryService deployments have valid environments", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const environments = deployments.map((d) => d.environment);
  assert.ok(environments.includes("dev"));
  assert.ok(environments.includes("staging"));
  assert.ok(environments.includes("pre-prod"));
  assert.ok(environments.includes("prod"));
});

test("DeploymentInventoryService deployments have valid rollout strategies", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const strategies = deployments.map((d) => d.rolloutStrategy);
  assert.ok(strategies.includes("direct"));
  assert.ok(strategies.includes("shadow"));
  assert.ok(strategies.includes("canary"));
  assert.ok(strategies.includes("tenant_gray"));
});

test("DeploymentInventoryService deployments have requiredDrills array", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  for (const deployment of deployments) {
    assert.ok(Array.isArray(deployment.requiredDrills));
    assert.ok(deployment.requiredDrills.length > 0);
  }
});

test("DeploymentInventoryService dev deployment uses direct rollout", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const dev = deployments.find((d) => d.environment === "dev");
  assert.ok(dev);
  assert.equal(dev.rolloutStrategy, "direct");
});

test("DeploymentInventoryService prod deployment uses tenant_gray rollout", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const prod = deployments.find((d) => d.environment === "prod");
  assert.ok(prod);
  assert.equal(prod.rolloutStrategy, "tenant_gray");
});

test("DeploymentInventoryService staging deployment uses shadow rollout", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const staging = deployments.find((d) => d.environment === "staging");
  assert.ok(staging);
  assert.equal(staging.rolloutStrategy, "shadow");
});

test("DeploymentInventoryService pre-prod deployment uses canary rollout", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const preprod = deployments.find((d) => d.environment === "pre-prod");
  assert.ok(preprod);
  assert.equal(preprod.rolloutStrategy, "canary");
});

test("DeploymentInventoryService dev deployment does not require live infra", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const dev = deployments.find((d) => d.environment === "dev");
  assert.ok(dev);
  assert.equal(dev.requiresLiveInfra, false);
});

test("DeploymentInventoryService dev deployment uses contract_only s4Mode", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const dev = deployments.find((d) => d.environment === "dev");
  assert.ok(dev);
  assert.equal(dev.s4Mode, "contract_only");
});

test("DeploymentInventoryService buildSummary contractOnly count matches", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();
  const summary = service.buildSummary();

  const contractOnlyCount = deployments.filter((d) => d.s4Mode === "contract_only").length;
  assert.equal(summary.contractOnly, contractOnlyCount);
});

test("DeploymentInventoryService buildSummary ready count matches", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();
  const summary = service.buildSummary();

  const readyCount = deployments.filter((d) => d.readinessStatus === "ready").length;
  assert.equal(summary.ready, readyCount);
});

test("DeploymentInventoryService buildSummary conditional count matches", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();
  const summary = service.buildSummary();

  const conditionalCount = deployments.filter((d) => d.readinessStatus === "conditional").length;
  assert.equal(summary.conditional, conditionalCount);
});

test("DeploymentInventoryService buildSummary blocked count matches", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();
  const summary = service.buildSummary();

  const blockedCount = deployments.filter((d) => d.readinessStatus === "blocked").length;
  assert.equal(summary.blocked, blockedCount);
});

test("DeploymentInventoryService deployments have unique IDs", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const ids = deployments.map((d) => d.deploymentId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
});

test("DeploymentInventoryRecord type is correctly structured", () => {
  const service = new DeploymentInventoryService();
  const deployments = service.listDeployments();

  const record: DeploymentInventoryRecord | undefined = deployments.at(0);
  assert.ok(record);
  assert.equal(typeof record.deploymentId, "string");
  assert.equal(typeof record.environment, "string");
  assert.equal(typeof record.rolloutStrategy, "string");
  assert.equal(typeof record.readinessStatus, "string");
  assert.equal(typeof record.requiresLiveInfra, "boolean");
  assert.equal(typeof record.s4Mode, "string");
  assert.ok(Array.isArray(record.requiredDrills));
});
