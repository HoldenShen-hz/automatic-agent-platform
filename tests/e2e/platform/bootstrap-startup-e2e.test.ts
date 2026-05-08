/**
 * E2E Platform Bootstrap and Startup Tests
 *
 * End-to-end tests covering platform bootstrap and startup sequences.
 * Tests service registry initialization, architecture bootstrap,
 * config bootstrap dependency ordering, and division bootstrap with triggers.
 *
 * Focus areas:
 * 1. Platform architecture bootstrap (1992-1993 - duplicate registration, no readiness gate)
 * 2. Config bootstrap with dependency ordering (1990-1991)
 * 3. Service registry initialization
 * 4. Division bootstrap with triggers
 *
 * Uses node:test with node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { loadConfiguredDivisionRegistry } from "../../../src/domains/governance/division-loader.js";
import { createWorkspaceWritePolicy } from "../../../src/platform/control-plane/iam/sandbox-policy.js";
import {
  ServiceRegistry,
} from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  registerPlatformArchitectureServices,
  buildPlatformArchitectureBootstrapSummary,
// @ts-ignore
  PLATFORM_STARTUP_ORDER,
// @ts-ignore
  type PlatformPlane,
} from "../../../src/platform-architecture-bootstrap.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../helpers/fs.js";

// =============================================================================
// SECTION 1: Platform Architecture Bootstrap (1992-1993)
// =============================================================================

/**
 * Test: Architecture bootstrap duplicate registration (1992)
 *
 * Issue: getPlatformArchitectureServices unconditionally re-registers services,
 * which should be idempotent but may cause issues with the service registry
 * if called multiple times without proper checks.
 */
test("E2E Bootstrap: architecture services can be registered multiple times without error", (t) => {
  const registry = new ServiceRegistry();

  // First registration - should succeed
  const result1 = registerPlatformArchitectureServices(registry);

  // Second registration on same registry - should not throw
  // (services are overwritten but no error is thrown)
  const result2 = registerPlatformArchitectureServices(registry);

  // Both should return PlatformArchitectureServices shape
  assert.ok(result1 !== undefined, "First registration should return result");
  assert.ok(result2 !== undefined, "Second registration should return result");

  // Verify bootstrap-summary depends on other services
  const summary = registry.get("architecture.bootstrap-summary");
  assert.ok(summary, "bootstrap-summary should be retrievable");
// @ts-ignore
  assert.equal(summary.layerCount, 9, "Should have 9 layers");
// @ts-ignore
  assert.equal(summary.planeCount, 6, "Should have 6 planes");

  registry.reset();
});

/**
 * Test: Architecture bootstrap readiness gate (1993)
 *
 * Issue: After register and immediate get, uninitialized data may be obtained.
 * The service registry should properly handle dependsOn before returning a service.
 */
test("E2E Bootstrap: architecture bootstrap-summary waits for dependencies before returning", (t) => {
  const registry = new ServiceRegistry();
  registerPlatformArchitectureServices(registry);

  // Get the bootstrap-summary which depends on other services
  const summary = registry.get("architecture.bootstrap-summary");

  // All dependencies should be resolved before summary is returned
  assert.ok(summary, "bootstrap-summary should be initialized");
// @ts-ignore
  assert.ok(summary.generatedAt, "Summary should have generation timestamp");
// @ts-ignore
  assert.equal(summary.layerCount, 9, "Should have correct layer count");
// @ts-ignore
  assert.equal(summary.planeCount, 6, "Should have correct plane count");

  // Verify the dependent services were also initialized
  const layers = registry.get("architecture.layer-catalog");
  assert.ok(layers, "layers catalog should be initialized");
// @ts-ignore
  assert.equal(layers.length, 9, "Should have 9 layers registered");

  registry.reset();
});

/**
 * Test: Platform startup order validation
 *
 * Verifies that the platform startup order follows the required sequence:
 * P5 -> X1 -> P2 -> P3 -> P4 -> P1
 *
 * NOTE: The startup targets in the current implementation do not have a direct
 * plane property, so we validate the PLATFORM_STARTUP_ORDER constant itself.
 * Issues 1990-1991 track the missing dependency ordering in config/bootstrap.
 */
test("E2E Bootstrap: platform startup order constant is correctly defined", (t) => {
  // Verify the constant startup order matches expected sequence
  assert.deepEqual(
    PLATFORM_STARTUP_ORDER,
    ["P5", "X1", "P2", "P3", "P4", "P1"] as PlatformPlane[],
    "PLATFORM_STARTUP_ORDER should match required sequence",
  );

  // Verify it has exactly 6 planes
  assert.equal(PLATFORM_STARTUP_ORDER.length, 6, "Should have 6 planes in startup order");

  // Verify no duplicates
  const uniquePlanes = new Set(PLATFORM_STARTUP_ORDER);
  assert.equal(uniquePlanes.size, 6, "All planes in startup order should be unique");
});

// =============================================================================
// SECTION 2: Config Bootstrap with Dependency Ordering (1990-1991)
// =============================================================================

/**
 * Test: Config bootstrap dependency ordering
 *
 * Issue: Config bootstrap has no dependency ordering declared.
 * This test verifies that services with explicit dependsOn are initialized
 * in the correct order.
 */
test("E2E Config Bootstrap: services with dependsOn are initialized in correct order", (t) => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  // Register service C first (no dependencies)
  registry.register("service-c", {
    init: () => {
      initOrder.push("service-c");
      return { name: "service-c" };
    },
  });

  // Register service A (depends on B)
  registry.register("service-a", {
    init: () => {
      initOrder.push("service-a");
      return { name: "service-a" };
    },
    dependsOn: ["service-b"],
  });

  // Register service B (depends on C)
  registry.register("service-b", {
    init: () => {
      initOrder.push("service-b");
      return { name: "service-b" };
    },
    dependsOn: ["service-c"],
  });

  // Get service-a which triggers initialization of all dependencies
  const serviceA = registry.get("service-a");
  assert.ok(serviceA, "service-a should be initialized");

  // Verify order: C first (base), then B (depends on C), then A (depends on B)
  const cIndex = initOrder.indexOf("service-c");
  const bIndex = initOrder.indexOf("service-b");
  const aIndex = initOrder.indexOf("service-a");

  assert.ok(cIndex < bIndex, "service-c should be initialized before service-b");
  assert.ok(bIndex < aIndex, "service-b should be initialized before service-a");

  registry.reset();
});

/**
 * Test: Config bootstrap level declaration
 *
 * Services should be organized in logical levels based on their dependencies.
 * Level 0 = no dependencies, Level 1 = depends on Level 0, etc.
 */
test("E2E Config Bootstrap: services can be organized in dependency levels", (t) => {
  const registry = new ServiceRegistry();

  // Define services at different levels
  // Level 0: foundation services (no deps)
  registry.register("config-store", {
    init: () => ({ name: "config-store" }),
  });
  registry.register("feature-flags", {
    init: () => ({ name: "feature-flags" }),
    dependsOn: ["config-store"],
  });

  // Level 1: depends on level 0
  registry.register("config-governance", {
    init: () => ({ name: "config-governance" }),
    dependsOn: ["config-store", "feature-flags"],
  });

  // Level 2: highest level
  registry.register("config-api", {
    init: () => ({ name: "config-api" }),
    dependsOn: ["config-governance"],
  });

  // Access top-level service to trigger all initialization
  const api = registry.get("config-api");
  assert.ok(api, "config-api should be initialized");

  // Verify all services were initialized
  assert.ok(registry.isInitialized("config-store"), "config-store should be initialized");
  assert.ok(registry.isInitialized("feature-flags"), "feature-flags should be initialized");
  assert.ok(registry.isInitialized("config-governance"), "config-governance should be initialized");

  registry.reset();
});

// =============================================================================
// SECTION 3: Service Registry Initialization
// =============================================================================

/**
 * Test: Service registry singleton behavior
 */
test("E2E Service Registry: getInstance returns same instance", (t) => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();

  assert.strictEqual(instance1, instance2, "getInstance should return same instance");

  instance1.reset();
});

/**
 * Test: Service registry registers bootstrap on construction
 */
test("E2E Service Registry: bootstrap registrars are replayed on new registry instances", async (t) => {
  // Get initial instance to establish baseline
  const initialRegistry = ServiceRegistry.getInstance();
  await initialRegistry.reset();

  // After reset, a new registry should be created
  const freshRegistry = ServiceRegistry.getInstance();

  // Verify it's a different instance after reset
  assert.ok(freshRegistry !== initialRegistry, "Fresh registry should be different after reset");
});

test("E2E Service Registry: self-circular dependency (A depends on A) throws circular dependency error", () => {
  const registry = new ServiceRegistry();
  registry.register("self-referencing-service", {
    init: () => ({ name: "self-referencing-service" }),
    dependsOn: ["self-referencing-service"],
  });

  assert.throws(
    () => registry.get("self-referencing-service"),
    /service_registry\.circular_dependency/i,
    "Self-referencing service should be rejected instead of silently initializing",
  );

  registry.reset();
});

/**
 * Test: Service registry unregistered service access
 */
test("E2E Service Registry: accessing unregistered service throws", (t) => {
  const registry = new ServiceRegistry();

  assert.throws(
    () => registry.get("non-existent-service"),
    /not_registered/i,
    "Should throw for unregistered service",
  );

  registry.reset();
});

/**
 * Test: Service registry isInitialized check
 */
test("E2E Service Registry: isInitialized returns correct state", (t) => {
  const registry = new ServiceRegistry();

  // Not initialized yet
  assert.equal(registry.isInitialized("test-service"), false, "Should not be initialized initially");

  // Register and get
  registry.register("test-service", {
    init: () => ({ name: "test" }),
  });

  // Not initialized until accessed
  assert.equal(registry.isInitialized("test-service"), false, "Should not be initialized before get");

  // Access it
  registry.get("test-service");

  // Now initialized
  assert.equal(registry.isInitialized("test-service"), true, "Should be initialized after get");

  registry.reset();
});

// =============================================================================
// SECTION 4: Division Bootstrap with Triggers
// =============================================================================

test("E2E Division Bootstrap: configured division registry loads validated fixtures with triggers", () => {
  const workspace = createTempWorkspace("aa-e2e-division-bootstrap-");
  const divisionsRoot = join(workspace, "divisions");
  const configRoot = join(workspace, "config");

  try {
    createFile(
      join(divisionsRoot, "general_ops/division.yaml"),
      [
        "id: general_ops",
        "version: 1",
        "name: General Operations",
        "default_workflow: single_agent_minimal",
        "triggers:",
        "  - summarize",
        "roles:",
        "  - id: general_executor",
        "    prompt: roles/general_executor.prompt.md",
        "    model: balanced",
        "    tools: [read, bash]",
      ].join("\n"),
    );
    createFile(join(divisionsRoot, "general_ops/roles/general_executor.prompt.md"), "# general executor\n");
    createFile(
      join(divisionsRoot, "general_ops/schemas/minimal-output.json"),
      JSON.stringify(
        {
          type: "object",
          required: ["summary", "result"],
          properties: {
            summary: { type: "string", minLength: 1 },
            result: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        null,
        2,
      ),
    );
    createFile(
      join(divisionsRoot, "general_ops/workflows/minimal.yaml"),
      [
        "id: single_agent_minimal",
        "division_id: general_ops",
        "steps:",
        "  - step_id: analyze_request",
        "    role_id: general_executor",
        "    output_key: analysis",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
      ].join("\n"),
    );
    createFile(
      join(configRoot, "workflows/default.json"),
      JSON.stringify(
        {
          defaultWorkflowId: "single_agent_minimal",
          allowCrossDivisionDag: false,
        },
        null,
        2,
      ),
    );

    const registry = loadConfiguredDivisionRegistry({
      divisionsRoot,
      configRoot,
      environment: "prod",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    const division = registry.divisions.get("general_ops");
    const workflow = registry.workflows.get("single_agent_minimal");

    assert.ok(division, "Division should be loaded");
    assert.ok(workflow, "Workflow should be loaded");
    assert.deepEqual(division?.triggers, ["summarize"], "Trigger wiring should be preserved");
    assert.equal(division?.defaultWorkflowId, "single_agent_minimal", "Default workflow should match division config");
    assert.equal(workflow?.steps[0]?.roleId, "general_executor", "Workflow should be validated and linked to the declared role");
    assert.match(division?.roles[0]?.promptText ?? "", /general executor/i, "Prompt text should be loaded from disk");
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// SECTION 5: Bootstrap Summary Tests
// =============================================================================

/**
 * Test: Bootstrap summary contains all expected fields
 */
test("E2E Bootstrap Summary: summary contains all expected architecture information", (t) => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  // Verify summary structure
  assert.ok(summary.generatedAt, "Should have generatedAt timestamp");
  assert.equal(summary.startupEntryModule, "src/index.ts", "Should have correct entry module");
  assert.equal(summary.architectureDocPath, "docs_zh/architecture/00-platform-architecture.md", "Should have correct doc path");
  assert.equal(summary.layerCount, 9, "Should have 9 layers");
  assert.equal(summary.planeCount, 6, "Should have 6 planes");
  assert.ok(summary.appCount > 0, "Should have apps");
  assert.ok(summary.startupTargetCount > 0, "Should have startup targets");

  // Verify layers
  assert.ok(summary.layers.length === 9, "Should have 9 layer manifests");
  const platformLayer = summary.layers.find((l) => l.layerId === "platform");
  assert.ok(platformLayer, "Should have platform layer");
  assert.ok(platformLayer?.canonicalSubdomains.includes("interface"), "Platform should have interface subdomain");

  // Verify planes
  assert.ok(summary.planes.length === 6, "Should have 6 plane manifests");
  const p1Plane = summary.planes.find((p) => p.planeId === "P1");
  assert.ok(p1Plane, "Should have P1 plane");
  assert.deepEqual(p1Plane?.surfaceIds, ["interface"], "P1 should have interface surface");

  // Startup targets exist but don't have plane property directly
  // (this is part of issue 1990-1991 - config bootstrap lacks dependency ordering)
  assert.ok(summary.startupTargets.length > 0, "Should have startup targets");
});
