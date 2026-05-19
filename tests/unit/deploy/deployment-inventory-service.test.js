/**
 * Deployment Inventory Service Tests
 *
 * Tests for the deployment inventory service that tracks deployments
 * across environments and provides summary statistics.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DeploymentInventoryService } from "../../../src/platform/stability/deployment-inventory-service.js";
test("DeploymentInventoryService.listDeployments returns all default deployments", () => {
    const service = new DeploymentInventoryService();
    const deployments = service.listDeployments();
    assert.equal(deployments.length, 4, "Should have 4 default deployments");
    const envs = deployments.map((d) => d.environment);
    assert.ok(envs.includes("dev"), "Should include dev");
    assert.ok(envs.includes("staging"), "Should include staging");
    assert.ok(envs.includes("pre-prod"), "Should include pre-prod");
    assert.ok(envs.includes("prod"), "Should include prod");
});
test("DeploymentInventoryService.listDeployments returns immutable copy", () => {
    const service = new DeploymentInventoryService();
    const deployments1 = service.listDeployments();
    const deployments2 = service.listDeployments();
    assert.notEqual(deployments1, deployments2, "Each call should return a new array");
    assert.deepEqual(deployments1, deployments2, "Array contents should be equal");
});
test("DeploymentInventoryService.buildSummary counts deployments correctly", () => {
    const service = new DeploymentInventoryService();
    const summary = service.buildSummary();
    assert.equal(summary.total, 4, "Total should be 4");
    assert.equal(summary.ready, 2, "Should have 2 ready deployments (dev, staging)");
    assert.equal(summary.conditional, 2, "Should have 2 conditional deployments (pre-prod, prod)");
    assert.equal(summary.blocked, 0, "Should have 0 blocked");
});
test("DeploymentInventoryService.buildSummary counts contractOnly deployments", () => {
    const service = new DeploymentInventoryService();
    const summary = service.buildSummary();
    assert.equal(summary.contractOnly, 4, "All deployments should be contract_only mode");
});
test("DeploymentInventoryService deployment records have correct requiredDrills", () => {
    const service = new DeploymentInventoryService();
    const deployments = service.listDeployments();
    const devDeploy = deployments.find((d) => d.environment === "dev");
    assert.ok(devDeploy, "Should find dev deployment");
    assert.deepEqual(devDeploy.requiredDrills, ["backup_restore"], "Dev should require backup_restore drill");
    const prodDeploy = deployments.find((d) => d.environment === "prod");
    assert.ok(prodDeploy, "Should find prod deployment");
    assert.deepEqual(prodDeploy.requiredDrills, ["backup_restore", "regional_failover", "worker_reassignment"], "Prod should require all 3 drills");
});
test("DeploymentInventoryService deployment rollout strategies", () => {
    const service = new DeploymentInventoryService();
    const deployments = service.listDeployments();
    const strategies = new Map(deployments.map((d) => [d.environment, d.rolloutStrategy]));
    assert.equal(strategies.get("dev"), "direct", "Dev should use direct rollout");
    assert.equal(strategies.get("staging"), "shadow", "Staging should use shadow rollout");
    assert.equal(strategies.get("pre-prod"), "canary", "Pre-prod should use canary rollout");
    assert.equal(strategies.get("prod"), "tenant_gray", "Prod should use tenant_gray rollout");
});
test("DeploymentInventoryService readiness statuses", () => {
    const service = new DeploymentInventoryService();
    const deployments = service.listDeployments();
    const statuses = new Map(deployments.map((d) => [d.environment, d.readinessStatus]));
    assert.equal(statuses.get("dev"), "ready", "Dev should be ready");
    assert.equal(statuses.get("staging"), "ready", "Staging should be ready");
    assert.equal(statuses.get("pre-prod"), "conditional", "Pre-prod should be conditional");
    assert.equal(statuses.get("prod"), "conditional", "Prod should be conditional");
});
test("DeploymentInventoryService s4Mode consistency", () => {
    const service = new DeploymentInventoryService();
    const deployments = service.listDeployments();
    for (const deploy of deployments) {
        assert.equal(deploy.s4Mode, "contract_only", `All deployments should be contract_only, got ${deploy.s4Mode}`);
        assert.equal(deploy.requiresLiveInfra, false, "All deployments should not require live infra");
    }
});
test("DeploymentInventoryService deploymentIds are unique", () => {
    const service = new DeploymentInventoryService();
    const deployments = service.listDeployments();
    const ids = deployments.map((d) => d.deploymentId);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "All deploymentIds should be unique");
});
test("DeploymentInventoryService buildSummary recalculates on each call", () => {
    const service = new DeploymentInventoryService();
    const summary1 = service.buildSummary();
    const summary2 = service.buildSummary();
    assert.deepEqual(summary1, summary2, "Summaries should be equal");
    assert.notEqual(summary1, summary2, "But each call should return a new object");
});
//# sourceMappingURL=deployment-inventory-service.test.js.map