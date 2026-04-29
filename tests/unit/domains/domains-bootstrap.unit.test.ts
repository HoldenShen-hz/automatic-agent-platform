import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDomainsBootstrap,
  buildDomainPhaseBootstrap,
  buildDomainRingBootstrap,
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAINS_CATALOG_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
  type DomainReadinessRing,
} from "../../../src/domains/domains-bootstrap.js";

test("buildDomainsBootstrap returns bootstrap with all required properties", () => {
  const bootstrap = buildDomainsBootstrap();

  assert.equal(bootstrap.capabilityGroupId, "domains");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(Array.isArray(bootstrap.rings));
  assert.ok(Array.isArray(bootstrap.phases));
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.ok(Array.isArray(bootstrap.ringServiceIds));
  assert.ok(Array.isArray(bootstrap.phaseServiceIds));
});

test("buildDomainsBootstrap has correct registered service IDs", () => {
  const bootstrap = buildDomainsBootstrap();

  assert.deepEqual(bootstrap.registeredServiceIds, [
    DOMAINS_CATALOG_SERVICE_ID,
    DOMAINS_BOOTSTRAP_SERVICE_ID,
  ]);
});

test("buildDomainsBootstrap catalog contains 31 domain baselines", () => {
  const bootstrap = buildDomainsBootstrap();

  assert.equal(bootstrap.catalog.length, 31);
});

test("buildDomainsBootstrap phases cover all vertical domain phases", () => {
  const bootstrap = buildDomainsBootstrap();

  const phaseIds = bootstrap.phases.map((p) => p.phase);
  assert.ok(phaseIds.includes("9a"));
  assert.ok(phaseIds.includes("9b"));
  assert.ok(phaseIds.includes("9c"));
  assert.ok(phaseIds.includes("9d"));
  assert.ok(phaseIds.includes("9e"));
  assert.ok(phaseIds.includes("9f"));
  assert.equal(bootstrap.phases.length, 6);
});

test("buildDomainsBootstrap rings cover all readiness rings", () => {
  const bootstrap = buildDomainsBootstrap();

  const ringIds = bootstrap.rings.map((r) => r.ringId);
  assert.ok(ringIds.includes("ring1"));
  assert.ok(ringIds.includes("ring2"));
  assert.ok(ringIds.includes("ring3"));
  assert.equal(bootstrap.rings.length, 3);
});

test("buildDomainPhaseBootstrap creates correct phase bootstrap for 9a", () => {
  const phase = buildDomainPhaseBootstrap("9a");

  assert.equal(phase.phase, "9a");
  assert.equal(phase.registeredServiceId, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]);
  assert.ok(Array.isArray(phase.baselines));
  assert.ok(phase.baselines.length > 0);
});

test("buildDomainPhaseBootstrap creates correct phase bootstrap for 9f", () => {
  const phase = buildDomainPhaseBootstrap("9f");

  assert.equal(phase.phase, "9f");
  assert.equal(phase.registeredServiceId, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9f"]);
  assert.ok(Array.isArray(phase.baselines));
  assert.ok(phase.baselines.length > 0);
});

test("buildDomainPhaseBootstrap all baselines in phase have correct phase", () => {
  for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"] as const) {
    const phaseBootstrap = buildDomainPhaseBootstrap(phase);
    for (const baseline of phaseBootstrap.baselines) {
      assert.equal(
        baseline.phase,
        phase,
        `Baseline ${baseline.domainId} should have phase ${phase}`,
      );
    }
  }
});

test("buildDomainRingBootstrap creates correct ring bootstrap for ring1", () => {
  const ring = buildDomainRingBootstrap("ring1");

  assert.equal(ring.ringId, "ring1");
  assert.equal(ring.registeredServiceId, DOMAIN_RING_BOOTSTRAP_SERVICE_IDS["ring1"]);
  assert.ok(Array.isArray(ring.legacyPhases));
  assert.deepEqual(ring.legacyPhases, ["9a", "9b"]);
  assert.ok(Array.isArray(ring.baselines));
  assert.ok(ring.baselines.length > 0);
});

test("buildDomainRingBootstrap ring2 has phases 9c and 9d", () => {
  const ring = buildDomainRingBootstrap("ring2");

  assert.equal(ring.ringId, "ring2");
  assert.deepEqual(ring.legacyPhases, ["9c", "9d"]);
});

test("buildDomainRingBootstrap ring3 has phases 9e and 9f", () => {
  const ring = buildDomainRingBootstrap("ring3");

  assert.equal(ring.ringId, "ring3");
  assert.deepEqual(ring.legacyPhases, ["9e", "9f"]);
});

test("buildDomainRingBootstrap ring baselines contain domains from both phases", () => {
  const ring1 = buildDomainRingBootstrap("ring1");
  const phase9aDomains = new Set(buildDomainPhaseBootstrap("9a").baselines.map((b) => b.domainId));
  const phase9bDomains = new Set(buildDomainPhaseBootstrap("9b").baselines.map((b) => b.domainId));

  for (const baseline of ring1.baselines) {
    const inPhase9a = phase9aDomains.has(baseline.domainId);
    const inPhase9b = phase9bDomains.has(baseline.domainId);
    assert.ok(
      inPhase9a || inPhase9b,
      `Baseline ${baseline.domainId} should be in phase 9a or 9b`,
    );
  }
});

test("buildDomainsBootstrap ringServiceIds match ring bootstrap service IDs", () => {
  const bootstrap = buildDomainsBootstrap();

  assert.deepEqual(
    bootstrap.ringServiceIds,
    Object.values(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS),
  );
});

test("buildDomainsBootstrap phaseServiceIds match phase bootstrap service IDs", () => {
  const bootstrap = buildDomainsBootstrap();

  assert.deepEqual(
    bootstrap.phaseServiceIds,
    Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS),
  );
});

test("buildDomainsBootstrap phases have correct structure", () => {
  const bootstrap = buildDomainsBootstrap();

  for (const phaseBootstrap of bootstrap.phases) {
    assert.ok("phase" in phaseBootstrap);
    assert.ok("baselines" in phaseBootstrap);
    assert.ok("registeredServiceId" in phaseBootstrap);
    assert.ok(Array.isArray(phaseBootstrap.baselines));
    assert.ok(phaseBootstrap.baselines.length > 0);
  }
});

test("buildDomainsBootstrap rings have correct structure", () => {
  const bootstrap = buildDomainsBootstrap();

  for (const ringBootstrap of bootstrap.rings) {
    assert.ok("ringId" in ringBootstrap);
    assert.ok("legacyPhases" in ringBootstrap);
    assert.ok("baselines" in ringBootstrap);
    assert.ok("registeredServiceId" in ringBootstrap);
    assert.ok(Array.isArray(ringBootstrap.legacyPhases));
    assert.ok(Array.isArray(ringBootstrap.baselines));
    assert.ok(ringBootstrap.baselines.length > 0);
  }
});

test("buildDomainsBootstrap catalog matches all phase baselines combined", () => {
  const bootstrap = buildDomainsBootstrap();
  const allPhaseBaselines = bootstrap.phases.flatMap((p) => p.baselines);

  assert.equal(bootstrap.catalog.length, allPhaseBaselines.length);
});

test("buildDomainsBootstrap ring baselines match combined phase baselines", () => {
  const bootstrap = buildDomainsBootstrap();

  for (const ring of bootstrap.rings) {
    const expectedBaselines = ring.legacyPhases.flatMap((phase) =>
      buildDomainPhaseBootstrap(phase).baselines,
    );
    assert.equal(
      ring.baselines.length,
      expectedBaselines.length,
      `Ring ${ring.ringId} should have ${expectedBaselines.length} baselines`,
    );
  }
});
