import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDomainsRuntimeCatalog,
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  type DomainsRuntimeCatalog,
} from "../../../src/domains-runtime-catalog.js";
import {
  buildDomainsBootstrap,
  listVerticalDomainBaselines,
  listVerticalDomainBaselinesByPhase,
} from "../../../src/domains/domain-baseline-catalog.js";

test("buildDomainsRuntimeCatalog returns catalog with all three readiness rings", () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok("ring1" in catalog);
  assert.ok("ring2" in catalog);
  assert.ok("ring3" in catalog);
});

test("buildDomainsRuntimeCatalog ring1 contains expected phase 9a and 9b domains", () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.ring1) {
    assert.ok(
      ["9a", "9b"].includes(baseline.phase),
      `Ring1 baseline ${baseline.domainId} should have phase 9a or 9b`,
    );
  }
});

test("buildDomainsRuntimeCatalog ring2 contains expected phase 9c and 9d domains", () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.ring2) {
    assert.ok(
      ["9c", "9d"].includes(baseline.phase),
      `Ring2 baseline ${baseline.domainId} should have phase 9c or 9d`,
    );
  }
});

test("buildDomainsRuntimeCatalog ring3 contains expected phase 9e and 9f domains", () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.ring3) {
    assert.ok(
      ["9e", "9f"].includes(baseline.phase),
      `Ring3 baseline ${baseline.domainId} should have phase 9e or 9f`,
    );
  }
});

test("buildDomainsRuntimeCatalog ring domains have correct counts", () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(catalog.ring1.length, 8);
  assert.equal(catalog.ring2.length, 11);
  assert.equal(catalog.ring3.length, 12);
});

test("buildDomainsRuntimeCatalog rings contain DomainBaseline objects with required properties", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const allBaselines = [...catalog.ring1, ...catalog.ring2, ...catalog.ring3];

  for (const baseline of allBaselines) {
    assert.ok("domainId" in baseline);
    assert.ok("phase" in baseline);
    assert.ok("definition" in baseline);
    assert.ok("riskProfile" in baseline);
    assert.ok("knowledgeSchema" in baseline);
    assert.ok("evalFramework" in baseline);
    assert.ok("promptLibrary" in baseline);
    assert.ok("recipes" in baseline);
  }
});

test("buildDomainsRuntimeCatalog ring1 includes expected domains", () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok(catalog.ring1.some((b) => b.domainId === "coding"));
  assert.ok(catalog.ring1.some((b) => b.domainId === "quant-trading"));
});

test("buildDomainsRuntimeCatalog ring3 includes expected domains", () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok(catalog.ring3.some((b) => b.domainId === "healthcare"));
  assert.ok(catalog.ring3.some((b) => b.domainId === "marketing"));
});

test("buildDomainsRuntimeCatalog ring domains retain historical batch metadata", () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.ring1) {
    assert.ok(["9a", "9b"].includes(baseline.phase));
  }
  for (const baseline of catalog.ring2) {
    assert.ok(["9c", "9d"].includes(baseline.phase));
  }
  for (const baseline of catalog.ring3) {
    assert.ok(["9e", "9f"].includes(baseline.phase));
  }
});

test("buildDomainsRuntimeCatalog total count matches all baselines", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const allBaselines = listVerticalDomainBaselines();

  assert.equal(catalog.ring1.length + catalog.ring2.length + catalog.ring3.length, allBaselines.length);
});

test("buildDomainsRuntimeCatalog ring1 phase distribution is correct", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const phase9aCount = catalog.ring1.filter((b) => b.phase === "9a").length;
  const phase9bCount = catalog.ring1.filter((b) => b.phase === "9b").length;

  assert.equal(phase9aCount, 4, "ring1 should have 4 phase 9a baselines");
  assert.equal(phase9bCount, 4, "ring1 should have 4 phase 9b baselines");
});

test("buildDomainsRuntimeCatalog ring2 phase distribution is correct", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const phase9cCount = catalog.ring2.filter((b) => b.phase === "9c").length;
  const phase9dCount = catalog.ring2.filter((b) => b.phase === "9d").length;

  assert.equal(phase9cCount, 6, "ring2 should have 6 phase 9c baselines");
  assert.equal(phase9dCount, 5, "ring2 should have 5 phase 9d baselines");
});

test("buildDomainsRuntimeCatalog ring3 phase distribution is correct", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const phase9eCount = catalog.ring3.filter((b) => b.phase === "9e").length;
  const phase9fCount = catalog.ring3.filter((b) => b.phase === "9f").length;

  assert.equal(phase9eCount, 6, "ring3 should have 6 phase 9e baselines");
  assert.equal(phase9fCount, 6, "ring3 should have 6 phase 9f baselines");
});

test("buildDomainsRuntimeCatalog returns same data as direct catalog query", () => {
  const catalog = buildDomainsRuntimeCatalog();

  const ring1Baselines = listVerticalDomainBaselinesByPhase("9a").concat(
    listVerticalDomainBaselinesByPhase("9b"),
  );
  const ring2Baselines = listVerticalDomainBaselinesByPhase("9c").concat(
    listVerticalDomainBaselinesByPhase("9d"),
  );
  const ring3Baselines = listVerticalDomainBaselinesByPhase("9e").concat(
    listVerticalDomainBaselinesByPhase("9f"),
  );

  assert.equal(catalog.ring1.length, ring1Baselines.length);
  assert.equal(catalog.ring2.length, ring2Baselines.length);
  assert.equal(catalog.ring3.length, ring3Baselines.length);
});

test("buildDomainsRuntimeCatalog all domains are in exactly one ring", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const allBaselines = [...catalog.ring1, ...catalog.ring2, ...catalog.ring3];
  const uniqueDomainIds = new Set(allBaselines.map((b) => b.domainId));

  assert.equal(uniqueDomainIds.size, allBaselines.length, "Each domain should appear in exactly one ring");
});

test("buildDomainsRuntimeCatalog type DomainsRuntimeCatalog has correct shape", () => {
  const catalog = buildDomainsRuntimeCatalog() as DomainsRuntimeCatalog;

  assert.ok(Array.isArray(catalog.ring1));
  assert.ok(Array.isArray(catalog.ring2));
  assert.ok(Array.isArray(catalog.ring3));
  assert.ok(catalog.ring1.length > 0);
  assert.ok(catalog.ring2.length > 0);
  assert.ok(catalog.ring3.length > 0);
});
