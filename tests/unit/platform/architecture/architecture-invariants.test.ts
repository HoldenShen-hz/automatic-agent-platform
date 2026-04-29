import assert from "node:assert/strict";
import test from "node:test";

import {
  ARCHITECTURE_INVARIANTS,
  ArchitectureInvariantRegistry,
  NonOverridableInvariantRegistry,
  listArchitectureInvariants,
  listNonOverridableInvariants,
  NON_OVERRIDABLE_INVARIANT_IDS,
} from "../../../../src/platform/architecture/invariant-registry.js";

test("ARCHITECTURE_INVARIANTS is frozen", () => {
  assert.ok(Object.isFrozen(ARCHITECTURE_INVARIANTS), "ARCHITECTURE_INVARIANTS should be frozen");
});

test("ARCHITECTURE_INVARIANTS has expected number of invariants", () => {
  assert.equal(ARCHITECTURE_INVARIANTS.length, 9, "should have 9 architecture invariants");
});

test("each invariant has required fields", () => {
  for (const invariant of ARCHITECTURE_INVARIANTS) {
    assert.ok(typeof invariant.invariantId === "string", `${invariant.invariantId}: invariantId should be string`);
    assert.ok(typeof invariant.statement === "string", `${invariant.invariantId}: statement should be string`);
    assert.ok(typeof invariant.category === "string", `${invariant.invariantId}: category should be string`);
    assert.ok(typeof invariant.enforcementPoint === "string", `${invariant.invariantId}: enforcementPoint should be string`);
    assert.ok(typeof invariant.testRef === "string", `${invariant.invariantId}: testRef should be string`);
    assert.ok(typeof invariant.failureBehavior === "string", `${invariant.invariantId}: failureBehavior should be string`);
    assert.ok(typeof invariant.owner === "string", `${invariant.invariantId}: owner should be string`);
    assert.ok(typeof invariant.phase === "string", `${invariant.invariantId}: phase should be string`);
    assert.ok(typeof invariant.nonOverridable === "boolean", `${invariant.invariantId}: nonOverridable should be boolean`);
  }
});

test("all invariant IDs follow naming pattern INV-XXX-###", () => {
  const pattern = /^INV-[A-Z]+-\d{3}$/;
  for (const invariant of ARCHITECTURE_INVARIANTS) {
    assert.ok(pattern.test(invariant.invariantId), `${invariant.invariantId} should match INV-XXX-### pattern`);
  }
});

test("all categories are valid ArchitectureInvariantCategory values", () => {
  const validCategories = ["RuntimeInvariant", "SecurityInvariant", "AuditInvariant", "PolicyInvariant", "DomainInvariant", "RiskInvariant"];
  for (const invariant of ARCHITECTURE_INVARIANTS) {
    assert.ok(validCategories.includes(invariant.category), `${invariant.invariantId}: category '${invariant.category}' should be valid`);
  }
});

test("all phases are valid ArchitectureInvariantPhase values", () => {
  const validPhases = ["MVP", "Hardening", "Enterprise"];
  for (const invariant of ARCHITECTURE_INVARIANTS) {
    assert.ok(validPhases.includes(invariant.phase), `${invariant.invariantId}: phase '${invariant.phase}' should be valid`);
  }
});

test("ArchitectureInvariantRegistry.list returns all invariants", () => {
  const registry = new ArchitectureInvariantRegistry();
  const invariants = registry.list();
  assert.equal(invariants.length, ARCHITECTURE_INVARIANTS.length);
});

test("ArchitectureInvariantRegistry.resolve returns correct invariant", () => {
  const registry = new ArchitectureInvariantRegistry();
  const invariant = registry.resolve("INV-STATE-001");
  assert.equal(invariant.invariantId, "INV-STATE-001");
  assert.ok(invariant.statement.includes("HarnessRun"));
});

test("ArchitectureInvariantRegistry.resolve throws for unknown invariant", () => {
  const registry = new ArchitectureInvariantRegistry();
  assert.throws(
    () => registry.resolve("INV-UNKNOWN-001"),
    { message: /Unknown architecture invariant: INV-UNKNOWN-001/ },
  );
});

test("ArchitectureInvariantRegistry.assertReleaseGateReady passes for valid invariants", () => {
  const registry = new ArchitectureInvariantRegistry();
  registry.assertReleaseGateReady();
});

test("NON_OVERRIDABLE_INVARIANT_IDS contains only nonOverridable invariants", () => {
  for (const invariantId of NON_OVERRIDABLE_INVARIANT_IDS) {
    const invariant = ARCHITECTURE_INVARIANTS.find((i) => i.invariantId === invariantId);
    assert.ok(invariant, `${invariantId} should exist in ARCHITECTURE_INVARIANTS`);
    assert.equal(invariant.nonOverridable, true, `${invariantId} should be nonOverridable`);
  }
});

test("listNonOverridableInvariants returns only nonOverridable invariants", () => {
  const invariants = listNonOverridableInvariants();
  for (const invariant of invariants) {
    assert.equal(invariant.nonOverridable, true);
  }
});

test("NonOverridableInvariantRegistry.canOverride returns false for nonOverridable invariants", () => {
  const registry = new NonOverridableInvariantRegistry();
  assert.equal(registry.canOverride("INV-STATE-001"), false);
  assert.equal(registry.canOverride("INV-RUN-001"), false);
});

test("NonOverridableInvariantRegistry.canOverride returns true for overridable invariants", () => {
  const registry = new NonOverridableInvariantRegistry();
  assert.equal(registry.canOverride("INV-DOMAIN-001"), true);
});

test("NonOverridableInvariantRegistry.assertCanOverride throws for nonOverridable invariants", () => {
  const registry = new NonOverridableInvariantRegistry();
  assert.throws(
    () => registry.assertCanOverride("INV-STATE-001"),
    { message: /Architecture invariant is non-overridable: INV-STATE-001/ },
  );
});

test("NonOverridableInvariantRegistry.assertCanOverride does not throw for overridable invariants", () => {
  const registry = new NonOverridableInvariantRegistry();
  registry.assertCanOverride("INV-DOMAIN-001");
});

test("listArchitectureInvariants returns same data as registry.list", () => {
  const invariants = listArchitectureInvariants();
  assert.equal(invariants.length, ARCHITECTURE_INVARIANTS.length);
});

test("each invariant's testRef starts with 'tests/'", () => {
  for (const invariant of ARCHITECTURE_INVARIANTS) {
    assert.ok(
      invariant.testRef.startsWith("tests/"),
      `${invariant.invariantId}: testRef should start with 'tests/', got ${invariant.testRef}`,
    );
  }
});

test("MVP phase invariants are all nonOverridable", () => {
  const mvpInvariants = ARCHITECTURE_INVARIANTS.filter((i) => i.phase === "MVP");
  for (const invariant of mvpInvariants) {
    assert.equal(invariant.nonOverridable, true, `${invariant.invariantId} in MVP phase should be nonOverridable`);
  }
});
