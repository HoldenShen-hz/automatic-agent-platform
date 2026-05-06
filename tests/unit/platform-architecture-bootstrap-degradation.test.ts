import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlatformArchitectureServices,
  registerPlatformArchitectureServices,
} from "../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import type { PlatformAppManifest } from "../../src/platform-architecture-types.js";

test("platform architecture bootstrap uses health checks before treating services as ready", async () => {
  const registry = new ServiceRegistry();
  try {
    registry.register<readonly PlatformAppManifest[]>("architecture.app-catalog", {
      init: () => [],
      healthCheck: () => false,
    });

    const services = registerPlatformArchitectureServices(registry);
    assert.ok(services.apps.length > 0);
    assert.equal(registry.isInitialized("architecture.app-catalog"), false);
    assert.ok(services.summary.appCount > 0);
  } finally {
    await registry.reset();
  }
});

test("platform architecture bootstrap degrades gracefully when summary dependencies are unhealthy", async () => {
  const registry = new ServiceRegistry();
  try {
    registry.register("architecture.layer-catalog", {
      init: () => {
        throw new Error("catalog unavailable");
      },
    });

    const services = getPlatformArchitectureServices(registry);
    assert.ok(services.layers.length > 0);
    assert.ok(services.summary.layerCount > 0);
    assert.ok(services.summary.startupTargetCount > 0);
  } finally {
    await registry.reset();
  }
});
