import assert from "node:assert/strict";
import test from "node:test";
import { ArchitectureInvariantRegistry, listArchitectureInvariants, listNonOverridableInvariants, NonOverridableInvariantRegistry, } from "../../src/platform/architecture/invariant-registry.js";
test("ArchitectureInvariantRegistry exposes release-gate-ready invariants", () => {
    const registry = new ArchitectureInvariantRegistry();
    const invariants = registry.list();
    assert.deepEqual(invariants.map((invariant) => invariant.invariantId), [
        "INV-STATE-001",
        "INV-RUN-001",
        "INV-GRAPH-001",
        "INV-BUDGET-001",
        "INV-REPLAY-001",
        "INV-SIDEEFFECT-001",
        "INV-POLICY-001",
        "INV-DOMAIN-001",
        "INV-RISK-001",
    ]);
    registry.assertReleaseGateReady();
    assert.equal(listArchitectureInvariants().length, invariants.length);
});
test("NonOverridableInvariantRegistry blocks runtime, security, audit, and risk overrides", () => {
    const registry = new NonOverridableInvariantRegistry();
    const nonOverridable = listNonOverridableInvariants();
    assert.ok(nonOverridable.length >= 8);
    assert.equal(registry.canOverride("INV-STATE-001"), false);
    assert.equal(registry.canOverride("INV-RUN-001"), false);
    assert.equal(registry.canOverride("INV-RISK-001"), false);
    assert.throws(() => registry.assertCanOverride("INV-BUDGET-001"), /non-overridable/);
});
test("Domain hardening invariant remains overridable only through domain release governance", () => {
    const registry = new ArchitectureInvariantRegistry();
    const nonOverridable = new NonOverridableInvariantRegistry();
    const invariant = registry.resolve("INV-DOMAIN-001");
    assert.equal(invariant.phase, "Hardening");
    assert.equal(invariant.nonOverridable, false);
    assert.equal(nonOverridable.canOverride("INV-DOMAIN-001"), true);
});
//# sourceMappingURL=architecture-invariant-registry.test.js.map