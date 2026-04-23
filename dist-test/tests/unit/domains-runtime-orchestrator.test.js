import assert from "node:assert/strict";
import test from "node:test";
import { registerDomainsRuntimeOrchestrator, DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID, } from "../../src/domains-runtime-orchestrator.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
test("domains runtime orchestrator starts W5 capabilities in canonical order", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerDomainsRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.equal(result.ready, true);
        assert.deepEqual(result.startupOrder, ["9a", "9b", "9c", "9d", "9e", "9f"]);
        assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
        assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["w5.domains.phase.9a.bootstrap"]);
    }
    finally {
        await registry.reset();
    }
});
test("domains runtime orchestrator exposes readiness snapshots", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerDomainsRuntimeOrchestrator(registry);
        const snapshot = orchestrator.snapshotReadiness();
        assert.equal(snapshot.orchestratorInitialized, true);
        assert.equal(snapshot.runtimeCatalogInitialized, true);
        assert.equal(snapshot.startupPlanInitialized, true);
        assert.equal(snapshot.capabilityReadiness.every((step) => step.initialized), true);
        assert.equal(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=domains-runtime-orchestrator.test.js.map