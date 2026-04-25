import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  buildScaleOpsRuntimeCatalog,
  registerScaleOpsRuntimeCatalog,
  SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
  type ScaleOpsRuntimeCatalog,
} from "../../../src/scale-ops-runtime-catalog.js";
import {
  buildScaleOpsStartupPlan,
  registerScaleOpsStartupPlan,
  SCALE_OPS_STARTUP_PLAN_SERVICE_ID,
  type ScaleOpsStartupPlan,
} from "../../../src/scale-ops-startup-plan.js";
import {
  ScaleOpsRuntimeOrchestrator,
  registerScaleOpsRuntimeOrchestrator,
  SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  type ScaleOpsRuntimeStartupResult,
  type ScaleOpsReadinessSnapshot,
} from "../../../src/scale-ops-runtime-orchestrator.js";
import {
  SCALE_BOOTSTRAP_SERVICE_ID,
  registerScaleBootstrap,
} from "../../../src/scale-ecosystem/scale-bootstrap.js";
import {
  OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  registerOpsMaturityBootstrap,
} from "../../../src/ops-maturity/ops-maturity-bootstrap.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("scale-ops runtime: buildScaleOpsRuntimeCatalog returns catalog with both capability groups", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  assert.ok(Array.isArray(catalog.scaleEcosystem));
  assert.ok(Array.isArray(catalog.opsMaturity));
  assert.ok(catalog.scaleEcosystem.length > 0, "scaleEcosystem should have capabilities");
  assert.ok(catalog.opsMaturity.length > 0, "opsMaturity should have capabilities");
});

test("scale-ops runtime: buildScaleOpsStartupPlan returns plan with two steps in correct order", () => {
  const plan = buildScaleOpsStartupPlan();

  assert.equal(plan.steps.length, 2);
  assert.deepEqual(plan.startupOrder, ["scale-ecosystem", "ops-maturity"]);

  const [scaleStep, opsStep] = plan.steps;
  assert.equal(scaleStep.stepId, "scale-ecosystem");
  assert.equal(scaleStep.dependsOnStepIds.length, 0);
  assert.ok(scaleStep.capabilityCount > 0);

  assert.equal(opsStep.stepId, "ops-maturity");
  assert.deepEqual(opsStep.dependsOnStepIds, ["scale-ecosystem"]);
  assert.ok(opsStep.capabilityCount > 0);

  assert.ok(plan.totalCapabilityCount > 0);
  assert.ok(plan.totalCapabilityCount === scaleStep.capabilityCount + opsStep.capabilityCount);
});

test("scale-ops runtime: ScaleOpsRuntimeOrchestrator.prepare registers all services", () => {
  const registry = ServiceRegistry.getInstance();

  // Register via the factory function to properly register all services
  registerScaleOpsRuntimeOrchestrator(registry);
  const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);

  const plan = orchestrator.prepare();

  assert.ok(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID));

  assert.equal(plan.steps.length, 2);
});

test("scale-ops runtime: ScaleOpsRuntimeOrchestrator.startup returns successful result", () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);

  const result: ScaleOpsRuntimeStartupResult = orchestrator.startup();

  assert.equal(result.ready, true);
  assert.deepEqual(result.startupOrder, ["scale-ecosystem", "ops-maturity"]);
  assert.ok(result.initializedServiceIds.length >= 2);
  assert.ok(result.steps.length === 2);

  const [scaleStep, opsStep] = result.steps;
  assert.equal(scaleStep.stepId, "scale-ecosystem");
  assert.equal(scaleStep.initialized, true);
  assert.ok(scaleStep.capabilityCount > 0);

  assert.equal(opsStep.stepId, "ops-maturity");
  assert.equal(opsStep.initialized, true);
  assert.deepEqual(opsStep.initializedDependencyServiceIds, [SCALE_BOOTSTRAP_SERVICE_ID]);
});

test("scale-ops runtime: ScaleOpsRuntimeOrchestrator.snapshotReadiness reflects initialization state", () => {
  const registry = ServiceRegistry.getInstance();

  // Register via factory to get proper registration
  const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);

  // Before startup, capability readiness reflects not-initialized state
  const beforeSnapshot: ScaleOpsReadinessSnapshot = orchestrator.snapshotReadiness();
  // The runtime catalog and startup plan are registered but services may not be initialized yet
  // We check that capabilityReadiness shows the step structure
  assert.equal(beforeSnapshot.capabilityReadiness.length, 2);
  assert.ok(beforeSnapshot.capabilityReadiness.some((c) => c.stepId === "scale-ecosystem"));
  assert.ok(beforeSnapshot.capabilityReadiness.some((c) => c.stepId === "ops-maturity"));

  // After startup
  orchestrator.startup();

  const afterSnapshot: ScaleOpsReadinessSnapshot = orchestrator.snapshotReadiness();
  assert.equal(afterSnapshot.runtimeCatalogInitialized, true);
  assert.equal(afterSnapshot.startupPlanInitialized, true);
  assert.ok(afterSnapshot.capabilityReadiness.every((c) => c.initialized === true));
});

test("scale-ops runtime: registerScaleOpsRuntimeCatalog integrates with ServiceRegistry", () => {
  const registry = ServiceRegistry.getInstance();

  registerScaleBootstrap(registry);
  registerOpsMaturityBootstrap(registry);
  const catalog = registerScaleOpsRuntimeCatalog(registry);

  assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(Array.isArray(catalog.scaleEcosystem));
  assert.ok(Array.isArray(catalog.opsMaturity));
});

test("scale-ops runtime: registerScaleOpsStartupPlan integrates with ServiceRegistry", () => {
  const registry = ServiceRegistry.getInstance();

  registerScaleBootstrap(registry);
  registerOpsMaturityBootstrap(registry);
  const plan = registerScaleOpsStartupPlan(registry);

  assert.ok(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID));
  assert.equal(plan.steps.length, 2);
});

test("scale-ops runtime: registerScaleOpsRuntimeOrchestrator composes all bootstrap services", () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);

  assert.ok(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID));
  assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID));

  const result = orchestrator.startup();
  assert.equal(result.ready, true);
});

test("scale-ops runtime: catalog contains expected scale-ecosystem capabilities", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  const scaleIds = catalog.scaleEcosystem.map((c) => c.capabilityId);
  assert.ok(scaleIds.includes("multi-region"));
  assert.ok(scaleIds.includes("resource-manager"));
  assert.ok(scaleIds.includes("sla-engine"));
  assert.ok(scaleIds.includes("marketplace"));
  assert.ok(scaleIds.includes("billing"));
  assert.ok(scaleIds.includes("tenant-platform"));
  assert.ok(scaleIds.includes("intelligence"));
  assert.ok(scaleIds.includes("enterprise"));
  assert.ok(scaleIds.includes("operations"));
  assert.ok(scaleIds.includes("feedback-loop"));
  assert.ok(scaleIds.includes("integration"));
});

test("scale-ops runtime: catalog contains expected ops-maturity capabilities", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  const opsIds = catalog.opsMaturity.map((c) => c.capabilityId);
  assert.ok(opsIds.includes("agent-lifecycle"));
  assert.ok(opsIds.includes("capacity-planner"));
  assert.ok(opsIds.includes("compliance-reporter"));
  assert.ok(opsIds.includes("cost-optimizer"));
  assert.ok(opsIds.includes("drift-detection"));
  assert.ok(opsIds.includes("edge-runtime"));
  assert.ok(opsIds.includes("emergency"));
  assert.ok(opsIds.includes("explainability"));
  assert.ok(opsIds.includes("monitoring"));
  assert.ok(opsIds.includes("multimodal"));
  assert.ok(opsIds.includes("platform-ops-agent"));
  assert.ok(opsIds.includes("workflow-debugger"));
});

test("scale-ops runtime: startup steps have correct entry modules", () => {
  const plan = buildScaleOpsStartupPlan();

  const scaleStep = plan.steps.find((s) => s.stepId === "scale-ecosystem");
  assert.ok(scaleStep?.entryModule.includes("scale-ecosystem"));

  const opsStep = plan.steps.find((s) => s.stepId === "ops-maturity");
  assert.ok(opsStep?.entryModule.includes("ops-maturity"));
});

test("scale-ops runtime: capability baselines have required fields", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  for (const capability of [...catalog.scaleEcosystem, ...catalog.opsMaturity]) {
    assert.ok(typeof capability.capabilityId === "string");
    assert.ok(typeof capability.entryModule === "string");
    assert.ok(typeof capability.description === "string");
    assert.ok(Array.isArray(capability.architectureSections));
    assert.ok(Array.isArray(capability.baselineServices));
  }
});
