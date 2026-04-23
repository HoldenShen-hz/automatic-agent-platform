import assert from "node:assert/strict";
import test from "node:test";
import { CrossRegionDeploymentService, CROSS_REGION_DDL, } from "../../../src/platform/execution/ha/cross-region-deployment-service.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { join } from "node:path";
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "cross-region.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(CROSS_REGION_DDL);
    return { workspace, db };
}
test("registerRegion creates a new region", () => {
    const h = createHarness("aa-reg-region-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const region = service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        assert.equal(region.regionId, "us-east-1");
        assert.equal(region.status, "active");
        assert.equal(region.healthScore, 100);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("getRegion retrieves registered region", () => {
    const h = createHarness("aa-get-region-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        const retrieved = service.getRegion("us-east-1");
        assert.ok(retrieved);
        assert.equal(retrieved.name, "US East");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("listRegions returns all registered regions", () => {
    const h = createHarness("aa-list-regions-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 100,
            healthScore: 95,
            maxConcurrency: 500,
            currentLoad: 20,
            metadata: null,
        });
        const regions = service.listRegions();
        assert.equal(regions.length, 2);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("listRegions filters by status", () => {
    const h = createHarness("aa-filter-regions-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "draining",
            priority: 2,
            weight: 100,
            latencyMs: 100,
            healthScore: 90,
            maxConcurrency: 500,
            currentLoad: 5,
            metadata: null,
        });
        const activeRegions = service.listRegions("active");
        assert.equal(activeRegions.length, 1);
        assert.equal(activeRegions[0].regionId, "us-east-1");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("updateRegionStatus changes region status", () => {
    const h = createHarness("aa-status-region-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        const updated = service.updateRegionStatus("us-east-1", "draining");
        assert.equal(updated.status, "draining");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("selectRegion returns best region", () => {
    const h = createHarness("aa-select-region-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 150,
            healthScore: 95,
            maxConcurrency: 500,
            currentLoad: 20,
            metadata: null,
        });
        const decision = service.selectRegion({});
        assert.ok(decision.selectedRegionId);
        assert.equal(decision.fallbackUsed, false);
        assert.ok(decision.allRegionEvaluations.length >= 2);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("selectRegion prefers preferred region", () => {
    const h = createHarness("aa-pref-region-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 500,
            currentLoad: 5,
            metadata: null,
        });
        const decision = service.selectRegion({ preferredRegionId: "eu-west-1" });
        assert.equal(decision.selectedRegionId, "eu-west-1");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("selectRegion excludes unhealthy regions", () => {
    const h = createHarness("aa-unhealthy-region-");
    try {
        const service = new CrossRegionDeploymentService(h.db, { minHealthScoreForTraffic: 80 });
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 30, // Very unhealthy
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 100,
            healthScore: 95,
            maxConcurrency: 500,
            currentLoad: 20,
            metadata: null,
        });
        const decision = service.selectRegion({});
        assert.equal(decision.selectedRegionId, "eu-west-1");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("createTopology creates region topology", () => {
    const h = createHarness("aa-create-topo-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const topology = service.createTopology({
            topologyId: "global-main",
            name: "Global Main",
            description: "Main global topology",
            regions: [
                { regionId: "us-east-1", name: "US East", endpoint: "https://us-east-1.example.com", status: "active", priority: 1, weight: 100, latencyMs: 50, healthScore: 100, maxConcurrency: 1000, currentLoad: 10, metadata: null, lastHealthCheckAt: "", createdAt: "", updatedAt: "" },
            ],
            defaultRoutingStrategy: "latency_based",
            failoverRegionId: null,
            activeRegionId: "us-east-1",
        });
        assert.equal(topology.topologyId, "global-main");
        assert.equal(topology.name, "Global Main");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("setRegionWeight updates traffic weight", () => {
    const h = createHarness("aa-set-weight-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.setRegionWeight("us-east-1", 50);
        const weights = service.getEffectiveWeights();
        assert.ok(weights.some((w) => w.regionId === "us-east-1" && w.weight === 50));
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("initiateFailover creates failover plan", () => {
    const h = createHarness("aa-init-failover-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 100,
            healthScore: 95,
            maxConcurrency: 500,
            currentLoad: 20,
            metadata: null,
        });
        const plan = service.initiateFailover("us-east-1", "health_check_failed");
        assert.ok(plan);
        assert.equal(plan.sourceRegionId, "us-east-1");
        assert.equal(plan.targetRegionId, "eu-west-1");
        assert.equal(plan.status, "pending");
        assert.ok(plan.steps.length > 0);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("completeFailoverStep advances failover plan", () => {
    const h = createHarness("aa-complete-step-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 100,
            healthScore: 95,
            maxConcurrency: 500,
            currentLoad: 20,
            metadata: null,
        });
        const plan = service.initiateFailover("us-east-1", "manual");
        const step = plan.steps.find((s) => s.stepType === "drain_traffic");
        const success = service.completeFailoverStep(plan.planId, "drain_traffic", true);
        assert.equal(success, true);
        const updatedPlan = service.getFailoverPlan(plan.planId);
        assert.equal(updatedPlan.status, "in_progress");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("getActiveFailoverPlans returns pending plans", () => {
    const h = createHarness("aa-active-failover-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.registerRegion({
            regionId: "eu-west-1",
            name: "EU West",
            endpoint: "https://eu-west-1.example.com",
            status: "active",
            priority: 2,
            weight: 100,
            latencyMs: 100,
            healthScore: 95,
            maxConcurrency: 500,
            currentLoad: 20,
            metadata: null,
        });
        service.initiateFailover("us-east-1", "manual");
        const activePlans = service.getActiveFailoverPlans();
        assert.ok(activePlans.length > 0);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("recordRegionHealth updates region health", () => {
    const h = createHarness("aa-record-health-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 100,
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        service.recordRegionHealth({
            regionId: "us-east-1",
            status: "degraded",
            latencyMs: 200,
            healthScore: 60,
            errorMessage: "High latency detected",
            checkedAt: new Date().toISOString(),
        });
        const region = service.getRegion("us-east-1");
        assert.equal(region.status, "degraded");
        assert.equal(region.healthScore, 60);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("getRegion returns null for nonexistent region", () => {
    const h = createHarness("aa-get-nonexistent-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const result = service.getRegion("nonexistent-region");
        assert.equal(result, null);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("selectRegion returns no_active_regions reason when no regions registered", () => {
    const h = createHarness("aa-select-empty-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const decision = service.selectRegion({});
        assert.ok(decision);
        assert.equal(decision.selectedRegionId, "");
        assert.equal(decision.reasonCode, "no_active_regions");
        assert.deepEqual(decision.allRegionEvaluations, []);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("selectRegion returns fallback_no_eligible when all regions are unhealthy", () => {
    const h = createHarness("aa-select-unhealthy-");
    try {
        const service = new CrossRegionDeploymentService(h.db, { minHealthScoreForTraffic: 80 });
        service.registerRegion({
            regionId: "us-east-1",
            name: "US East",
            endpoint: "https://us-east-1.example.com",
            status: "active",
            priority: 1,
            weight: 100,
            latencyMs: 50,
            healthScore: 50, // Below minHealthScoreForTraffic
            maxConcurrency: 1000,
            currentLoad: 10,
            metadata: null,
        });
        const decision = service.selectRegion({});
        assert.ok(decision);
        assert.equal(decision.selectedRegionId, "us-east-1"); // Still selects but with fallback
        assert.equal(decision.reasonCode, "fallback_no_eligible");
        assert.equal(decision.fallbackUsed, true);
        assert.ok(decision.allRegionEvaluations.length > 0);
        assert.equal(decision.allRegionEvaluations[0].reasonCode, "health_score_too_low");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("initiateFailover returns null when source region does not exist", () => {
    const h = createHarness("aa-failover-no-source-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const plan = service.initiateFailover("nonexistent-region", "manual");
        assert.equal(plan, null);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("completeFailoverStep returns false when plan does not exist", () => {
    const h = createHarness("aa-complete-invalid-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const success = service.completeFailoverStep("nonexistent-plan", "drain_traffic", true);
        assert.equal(success, false);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("getFailoverPlan returns null for nonexistent plan", () => {
    const h = createHarness("aa-get-plan-nonexistent-");
    try {
        const service = new CrossRegionDeploymentService(h.db);
        const plan = service.getFailoverPlan("nonexistent-plan-id");
        assert.equal(plan, null);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=cross-region-deployment-service.test.js.map