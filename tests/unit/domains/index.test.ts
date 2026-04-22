import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDomainsBootstrap,
  buildDomainsRuntimeCatalog,
  buildDomainsStartupPlan,
  PackLifecycleService,
  PackRegistryService,
  PackDomainAssociationService,
  PackMigrationService,
  SuccessCriteriaService,
  RoadmapService,
  bootstrapVerticalDomainBaselines,
  listVerticalDomainBaselines,
} from "../../../src/domains/index.js";

test("domains root barrel exposes business-pack services", () => {
  assert.equal(typeof PackLifecycleService, "function");
  assert.equal(typeof PackRegistryService, "function");
  assert.equal(typeof PackDomainAssociationService, "function");
  assert.equal(typeof PackMigrationService, "function");
});

test("domains root barrel exposes roadmap services", () => {
  assert.equal(typeof SuccessCriteriaService, "function");
  assert.equal(typeof RoadmapService, "function");
});

test("domains root barrel exposes vertical domain baseline bootstrap", () => {
  assert.equal(typeof listVerticalDomainBaselines, "function");
  assert.equal(typeof bootstrapVerticalDomainBaselines, "function");
  assert.equal(typeof buildDomainsBootstrap, "function");
  assert.equal(typeof buildDomainsRuntimeCatalog, "function");
  assert.equal(typeof buildDomainsStartupPlan, "function");
});
