import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDomainsBootstrap,
  registerDomainsBootstrap,
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAINS_CATALOG_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
} from "../../../src/domains/domains-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("domains bootstrap exposes canonical W5 domain services", () => {
  const bootstrap = buildDomainsBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "domains");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    DOMAINS_CATALOG_SERVICE_ID,
    DOMAINS_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 31);
  assert.deepEqual(bootstrap.phases.map((phase) => phase.phase), ["9a", "9b", "9c", "9d", "9e", "9f"]);
});

test("domains bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerDomainsBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.domainId === "coding"), true);
    assert.equal(bootstrap.catalog.some((item) => item.domainId === "quant-trading"), true);
    assert.equal(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID), true);
    assert.equal(registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9f"]), true);
  } finally {
    await registry.reset();
  }
});
