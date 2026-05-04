import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHarnessBootstrap,
  HARNESS_BOOTSTRAP_SERVICE_ID,
  HARNESS_CATALOG_SERVICE_ID,
  HARNESS_EVALUATOR_SERVICE_ID,
  HARNESS_GRAPH_SCHEDULER_SERVICE_ID,
  HARNESS_NODE_RUNTIME_SERVICE_ID,
  HARNESS_SIDE_EFFECT_MGR_SERVICE_ID,
  registerHarnessBootstrap,
} from "../../../../src/platform/five-plane-orchestration/harness/harness-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildHarnessBootstrap exposes all six canonical harness service ids", () => {
  const bootstrap = buildHarnessBootstrap();

  assert.deepEqual(bootstrap.registeredServiceIds, [
    HARNESS_CATALOG_SERVICE_ID,
    HARNESS_BOOTSTRAP_SERVICE_ID,
    HARNESS_NODE_RUNTIME_SERVICE_ID,
    HARNESS_SIDE_EFFECT_MGR_SERVICE_ID,
    HARNESS_EVALUATOR_SERVICE_ID,
    HARNESS_GRAPH_SCHEDULER_SERVICE_ID,
  ]);
});

test("registerHarnessBootstrap initializes every canonical harness service", async () => {
  const registry = ServiceRegistry.getInstance();

  try {
    registerHarnessBootstrap(registry);

    assert.ok(registry.get(HARNESS_CATALOG_SERVICE_ID));
    assert.ok(registry.get(HARNESS_BOOTSTRAP_SERVICE_ID));
    assert.deepEqual(registry.get<{ serviceId: string }>(HARNESS_NODE_RUNTIME_SERVICE_ID), { serviceId: HARNESS_NODE_RUNTIME_SERVICE_ID });
    assert.deepEqual(registry.get<{ serviceId: string }>(HARNESS_SIDE_EFFECT_MGR_SERVICE_ID), { serviceId: HARNESS_SIDE_EFFECT_MGR_SERVICE_ID });
    assert.deepEqual(registry.get<{ serviceId: string }>(HARNESS_EVALUATOR_SERVICE_ID), { serviceId: HARNESS_EVALUATOR_SERVICE_ID });
    assert.deepEqual(registry.get<{ serviceId: string }>(HARNESS_GRAPH_SCHEDULER_SERVICE_ID), { serviceId: HARNESS_GRAPH_SCHEDULER_SERVICE_ID });
  } finally {
    await registry.reset();
  }
});
