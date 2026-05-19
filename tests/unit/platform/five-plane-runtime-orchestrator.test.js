import assert from "node:assert/strict";
import test from "node:test";
import { FivePlaneRuntimeOrchestrator, FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID, registerFivePlaneRuntimeOrchestrator, } from "../../../src/platform/five-plane-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("five-plane runtime orchestrator starts planes in canonical order", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.equal(result.ready, true);
        assert.deepEqual(result.startupOrder, [
            "interface",
            "x1-fabric",
            "control-plane",
            "orchestration",
            "execution",
            "state-evidence",
        ]);
        assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
        assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["plane.interface.bootstrap"]);
        assert.deepEqual(result.steps[2]?.initializedDependencyServiceIds, ["plane.x1-fabric.bootstrap"]);
        assert.equal(result.runtimeCatalog.executionPlane.length, 14);
    }
    finally {
        await registry.reset();
    }
});
test("five-plane runtime orchestrator exposes readiness snapshots", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        const beforeStartup = orchestrator.snapshotReadiness();
        assert.equal(beforeStartup.orchestratorInitialized, true);
        assert.equal(beforeStartup.runtimeCatalogInitialized, true);
        assert.equal(beforeStartup.startupPlanInitialized, true);
        assert.equal(beforeStartup.planeReadiness.every((step) => step.initialized), true);
        const afterStartup = orchestrator.startup();
        assert.equal(afterStartup.initializedServiceIds.includes("plane.state-evidence.bootstrap"), true);
        assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
test("prepare returns startup plan and runtime catalog", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = new FivePlaneRuntimeOrchestrator(registry);
        const { startupPlan, runtimeCatalog } = orchestrator.prepare();
        assert.ok(startupPlan, "prepare should return startupPlan");
        assert.ok(runtimeCatalog, "prepare should return runtimeCatalog");
        assert.equal(startupPlan.steps.length, 6, "startupPlan should have 6 steps");
        assert.equal(runtimeCatalog.interfacePlane.length, 6);
        assert.equal(runtimeCatalog.controlPlane.length, 12);
    }
    finally {
        await registry.reset();
    }
});
test("startup returns correct initialized status for each step", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.equal(result.steps.length, 6);
        assert.equal(result.steps[0].stepId, "interface");
        assert.equal(result.steps[0].initialized, true);
        assert.equal(result.steps[0].capabilityCount, 6);
        assert.equal(result.steps[1].stepId, "x1-fabric");
        assert.equal(result.steps[1].initialized, true);
        assert.equal(result.steps[1].capabilityCount, 20);
        assert.equal(result.steps[2].stepId, "control-plane");
        assert.equal(result.steps[2].initialized, true);
        assert.equal(result.steps[2].capabilityCount, 12);
        assert.equal(result.steps[3].stepId, "orchestration");
        assert.equal(result.steps[3].initialized, true);
        assert.equal(result.steps[3].capabilityCount, 8);
        assert.equal(result.steps[4].stepId, "execution");
        assert.equal(result.steps[4].initialized, true);
        assert.equal(result.steps[4].capabilityCount, 14);
        assert.equal(result.steps[5].stepId, "state-evidence");
        assert.equal(result.steps[5].initialized, true);
        assert.equal(result.steps[5].capabilityCount, 10);
    }
    finally {
        await registry.reset();
    }
});
test("startup returns all initialized service IDs", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.ok(result.initializedServiceIds.length > 0);
        assert.ok(result.initializedServiceIds.includes("plane.interface.bootstrap"));
        assert.ok(result.initializedServiceIds.includes("plane.x1-fabric.bootstrap"));
        assert.ok(result.initializedServiceIds.includes("plane.control.bootstrap"));
        assert.ok(result.initializedServiceIds.includes("plane.orchestration.bootstrap"));
        assert.ok(result.initializedServiceIds.includes("plane.execution.bootstrap"));
        assert.ok(result.initializedServiceIds.includes("plane.state-evidence.bootstrap"));
    }
    finally {
        await registry.reset();
    }
});
test("snapshotReadiness returns plane readiness for all startup steps", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        const snapshot = orchestrator.snapshotReadiness();
        assert.equal(snapshot.planeReadiness.length, 6);
        assert.deepEqual(snapshot.planeReadiness.map(s => s.stepId), [
            "interface",
            "x1-fabric",
            "control-plane",
            "orchestration",
            "execution",
            "state-evidence",
        ]);
    }
    finally {
        await registry.reset();
    }
});
test("runtimeCatalog is accessible from startup result", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        const result = orchestrator.startup();
        assert.ok(result.runtimeCatalog);
        assert.equal(result.runtimeCatalog.interfacePlane.length, 6);
        assert.equal(result.runtimeCatalog.controlPlane.length, 12);
        assert.equal(result.runtimeCatalog.orchestrationPlane.length, 8);
        assert.equal(result.runtimeCatalog.executionPlane.length, 14);
        assert.equal(result.runtimeCatalog.stateEvidencePlane.length, 10);
    }
    finally {
        await registry.reset();
    }
});
test("FivePlaneRuntimeOrchestrator can be instantiated without arguments", () => {
    const orchestrator = new FivePlaneRuntimeOrchestrator();
    assert.ok(orchestrator);
});
test("registerFivePlaneRuntimeOrchestrator registers with correct dependencies", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
        assert.ok(orchestrator);
        assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=five-plane-runtime-orchestrator.test.js.map