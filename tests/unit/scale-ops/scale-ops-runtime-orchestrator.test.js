import assert from "node:assert/strict";
import test from "node:test";
import { ScaleOpsRuntimeOrchestrator, registerScaleOpsRuntimeOrchestrator, SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID, } from "../../../src/scale-ops-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("ScaleOpsRuntimeOrchestrator.prepare registers all services", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const plan = orchestrator.prepare();
        assert.ok(Array.isArray(plan.steps));
        assert.equal(plan.steps.length, 2);
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup returns result with ready=true", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.equal(result.ready, true);
        assert.ok(Array.isArray(result.startupOrder));
        assert.ok(Array.isArray(result.steps));
        assert.ok(Array.isArray(result.initializedServiceIds));
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup startupOrder is scale-ecosystem then ops-maturity", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.deepEqual(result.startupOrder, ["scale-ecosystem", "ops-maturity"]);
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup returns steps with correct stepIds", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        const stepIds = result.steps.map((s) => s.stepId);
        assert.ok(stepIds.includes("scale-ecosystem"));
        assert.ok(stepIds.includes("ops-maturity"));
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup marks both steps as initialized", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.ok(result.steps.every((s) => s.initialized === true));
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup includes bootstrapServiceId in each step", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        for (const step of result.steps) {
            assert.ok(typeof step.bootstrapServiceId === "string");
            assert.ok(step.bootstrapServiceId.length > 0);
        }
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup includes capabilityCount in each step", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        for (const step of result.steps) {
            assert.ok(typeof step.capabilityCount === "number");
            assert.ok(step.capabilityCount > 0);
        }
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.startup initializedServiceIds includes both bootstraps", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.ok(result.initializedServiceIds.length >= 2);
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.snapshotReadiness returns snapshot with all flags", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        orchestrator.startup();
        const snapshot = orchestrator.snapshotReadiness();
        assert.equal(typeof snapshot.runtimeCatalogInitialized, "boolean");
        assert.equal(typeof snapshot.startupPlanInitialized, "boolean");
        assert.equal(typeof snapshot.orchestratorInitialized, "boolean");
        assert.ok(Array.isArray(snapshot.capabilityReadiness));
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.snapshotReadiness capabilityReadiness has entry per step", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        orchestrator.startup();
        const snapshot = orchestrator.snapshotReadiness();
        assert.equal(snapshot.capabilityReadiness.length, 2);
    }
    finally {
        await registry.reset();
    }
});
test("ScaleOpsRuntimeOrchestrator.snapshotReadiness capabilityReadiness entries have stepId and initialized", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        orchestrator.startup();
        const snapshot = orchestrator.snapshotReadiness();
        for (const entry of snapshot.capabilityReadiness) {
            assert.ok(typeof entry.stepId === "string");
            assert.ok(typeof entry.bootstrapServiceId === "string");
            assert.equal(typeof entry.initialized, "boolean");
        }
    }
    finally {
        await registry.reset();
    }
});
test("registerScaleOpsRuntimeOrchestrator registers orchestrator in registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);
        assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
test("registerScaleOpsRuntimeOrchestrator returns orchestrator instance", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const first = registerScaleOpsRuntimeOrchestrator(registry);
        const second = registry.get(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
        assert.equal(first, second);
    }
    finally {
        await registry.reset();
    }
});
test("orchestrator.startup() after prepare() returns consistent results", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        orchestrator.prepare();
        const result = orchestrator.startup();
        assert.equal(result.ready, true);
        assert.equal(result.steps.length, 2);
    }
    finally {
        await registry.reset();
    }
});
test("orchestrator snapshot reflects post-startup state", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
        orchestrator.startup();
        const snapshot = orchestrator.snapshotReadiness();
        // After startup, all bootstrap services should be initialized
        assert.ok(snapshot.capabilityReadiness.every((e) => e.initialized === true));
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=scale-ops-runtime-orchestrator.test.js.map