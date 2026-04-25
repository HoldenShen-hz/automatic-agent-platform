import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExecutionPlaneBootstrap,
  registerExecutionPlaneBootstrap,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  EXECUTION_PLANE_CATALOG_SERVICE_ID,
} from "../../../../../src/platform/execution/execution-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";
import type { ExecutionCapabilityId } from "../../../../../src/platform/execution/execution-plane-baseline.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tests - buildExecutionPlaneBootstrap
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap returns correct planeId", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.equal(bootstrap.planeId, "execution");
});

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap returns catalog", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(bootstrap.catalog.length > 0);
});

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap returns registeredServiceIds", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.equal(bootstrap.registeredServiceIds.length, 2);
});

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap catalog contains dispatcher capability", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  const dispatcher = bootstrap.catalog.find((item) => item.capabilityId === "dispatcher");
  assert.ok(dispatcher !== undefined);
  assert.equal(dispatcher?.capabilityId, "dispatcher");
});

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap catalog contains tool-executor capability", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  const toolExecutor = bootstrap.catalog.find((item) => item.capabilityId === "tool-executor");
  assert.ok(toolExecutor !== undefined);
  assert.equal(toolExecutor?.capabilityId, "tool-executor");
});

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap catalog contains startup capability", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  const startup = bootstrap.catalog.find((item) => item.capabilityId === "startup");
  assert.ok(startup !== undefined);
  assert.equal(startup?.capabilityId, "startup");
  assert.ok(startup?.entryModule.includes("startup"));
});

test("execution-plane-bootstrap - buildExecutionPlaneBootstrap catalog contains all 14 capabilities", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  const capabilityIds = bootstrap.catalog.map((item) => item.capabilityId);

  assert.ok(capabilityIds.includes("dispatcher"));
  assert.ok(capabilityIds.includes("execution-engine"));
  assert.ok(capabilityIds.includes("tool-executor"));
  assert.ok(capabilityIds.includes("startup"));
  assert.ok(capabilityIds.includes("ha"));
  assert.ok(capabilityIds.includes("recovery"));
  assert.equal(bootstrap.catalog.length, 14);
});

test("execution-plane-bootstrap - registeredServiceIds contains correct service IDs", () => {
  const bootstrap = buildExecutionPlaneBootstrap();

  assert.ok(bootstrap.registeredServiceIds.includes(EXECUTION_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("execution-plane-bootstrap - catalog items have required fields", () => {
  const bootstrap = buildExecutionPlaneBootstrap();

  for (const item of bootstrap.catalog) {
    assert.ok(item.capabilityId.length > 0);
    assert.ok(item.entryModule.length > 0);
    assert.ok(item.description.length > 0);
    assert.ok(Array.isArray(item.baselineServices));
  }
});

test("execution-plane-bootstrap - catalog baselineServices are non-empty", () => {
  const bootstrap = buildExecutionPlaneBootstrap();

  for (const item of bootstrap.catalog) {
    assert.ok(item.baselineServices.length > 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Service IDs
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-bootstrap - EXECUTION_PLANE_CATALOG_SERVICE_ID is correct", () => {
  assert.equal(EXECUTION_PLANE_CATALOG_SERVICE_ID, "plane.execution.catalog");
});

test("execution-plane-bootstrap - EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID is correct", () => {
  assert.equal(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID, "plane.execution.bootstrap");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - registerExecutionPlaneBootstrap
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-bootstrap - registerExecutionPlaneBootstrap registers catalog service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerExecutionPlaneBootstrap(registry);
    assert.equal(registry.isInitialized(EXECUTION_PLANE_CATALOG_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - registerExecutionPlaneBootstrap registers bootstrap service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerExecutionPlaneBootstrap(registry);
    assert.equal(registry.isInitialized(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - registerExecutionPlaneBootstrap returns ExecutionPlaneBootstrap", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    assert.equal(bootstrap.planeId, "execution");
    assert.ok(Array.isArray(bootstrap.catalog));
    assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - registerExecutionPlaneBootstrap uses default registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap();
    assert.equal(bootstrap.planeId, "execution");
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - registered bootstrap has 14 catalog items", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    assert.equal(bootstrap.catalog.length, 14);
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - bootstrap catalog includes dispatcher", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    assert.ok(bootstrap.catalog.some((item) => item.capabilityId === "dispatcher"));
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - bootstrap catalog includes execution-engine", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    assert.ok(bootstrap.catalog.some((item) => item.capabilityId === "execution-engine"));
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - bootstrap catalog includes tool-executor", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    assert.ok(bootstrap.catalog.some((item) => item.capabilityId === "tool-executor"));
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - bootstrap catalog includes startup", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    const startup = bootstrap.catalog.find((item) => item.capabilityId === "startup");
    assert.ok(startup !== undefined);
    assert.ok(startup?.entryModule.includes("startup"));
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - bootstrap catalog includes all major capabilities", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    const ids = bootstrap.catalog.map((item) => item.capabilityId);

    const expected: ExecutionCapabilityId[] = [
      "dispatcher",
      "distributed-lock",
      "execution-engine",
      "ha",
      "hot-upgrade",
      "lease",
      "plugin-executor",
      "queue",
      "recovery",
      "resource",
      "startup",
      "state-transition",
      "tool-executor",
      "worker-pool",
    ];

    for (const cap of expected) {
      assert.ok(ids.includes(cap), `Missing capability: ${cap}`);
    }
  } finally {
    await registry.reset();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Bootstrap idempotency and isolation
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-bootstrap - calling register twice does not throw", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerExecutionPlaneBootstrap(registry);
    registerExecutionPlaneBootstrap(registry); // Should not throw
  } finally {
    await registry.reset();
  }
});

test("execution-plane-bootstrap - bootstrap is immutable", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);

    assert.throws(() => {
      (bootstrap as any).planeId = "changed";
    });
    assert.throws(() => {
      (bootstrap as any).catalog.push({} as any);
    });
    assert.equal(bootstrap.planeId, "execution");
  } finally {
    await registry.reset();
  }
});
