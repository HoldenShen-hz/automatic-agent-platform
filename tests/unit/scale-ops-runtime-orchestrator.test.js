import assert from "node:assert/strict";
import test from "node:test";
import { registerScaleOpsRuntimeOrchestrator, SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID, } from "../../src/scale-ops-runtime-orchestrator.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
test("scale-ops runtime orchestrator starts W4 capabilities in canonical order", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.equal(result.ready, true);
        assert.deepEqual(result.startupOrder, ["scale-ecosystem", "ops-maturity"]);
        assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
        assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["w4.scale.bootstrap"]);
    }
    finally {
        await registry.reset();
    }
});
test("scale-ops runtime orchestrator exposes readiness snapshots", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);
        const snapshot = orchestrator.snapshotReadiness();
        assert.equal(snapshot.orchestratorInitialized, true);
        assert.equal(snapshot.runtimeCatalogInitialized, true);
        assert.equal(snapshot.startupPlanInitialized, true);
        assert.equal(snapshot.capabilityReadiness.every((step) => step.initialized), true);
        assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=scale-ops-runtime-orchestrator.test.js.map