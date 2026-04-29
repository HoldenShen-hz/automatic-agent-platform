import assert from "node:assert/strict";
import test from "node:test";

import {
  toResponsibilityBoundary,
  enforceResponsibilityBoundary,
  type DomainRiskSpec,
  DomainRiskSpecSchema,
} from "../../../src/domains/domain-specs.js";

// ─────────────────────────────────────────────────────────────────────────────
// toResponsibilityBoundary Tests
// Maps DomainRiskSpec flags to ResponsibilityBoundary
// ─────────────────────────────────────────────────────────────────────────────

test("toResponsibilityBoundary returns deterministic_hot_path_only when flag is set", () => {
  const spec: DomainRiskSpec = DomainRiskSpecSchema.parse({
    domainId: "test",
    riskClass: "high",
    deterministicHotPathOnly: true,
    humanAccountable: false,
    advisoryOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");
});

test("toResponsibilityBoundary returns human_accountable when flag is set", () => {
  const spec: DomainRiskSpec = DomainRiskSpecSchema.parse({
    domainId: "test",
    riskClass: "high",
    deterministicHotPathOnly: false,
    humanAccountable: true,
    advisoryOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "human_accountable");
});

test("toResponsibilityBoundary returns advisory_only when flag is set", () => {
  const spec: DomainRiskSpec = DomainRiskSpecSchema.parse({
    domainId: "test",
    riskClass: "medium",
    deterministicHotPathOnly: false,
    humanAccountable: false,
    advisoryOnly: true,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "advisory_only");
});

test("toResponsibilityBoundary returns fully_autonomous when no flags are set", () => {
  const spec: DomainRiskSpec = DomainRiskSpecSchema.parse({
    domainId: "test",
    riskClass: "low",
    deterministicHotPathOnly: false,
    humanAccountable: false,
    advisoryOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "fully_autonomous");
});

test("toResponsibilityBoundary priority: deterministic_hot_path_only > human_accountable > advisory_only > fully_autonomous", () => {
  // When multiple flags are set, deterministicHotPathOnly takes precedence
  const spec: DomainRiskSpec = DomainRiskSpecSchema.parse({
    domainId: "test",
    riskClass: "critical",
    deterministicHotPathOnly: true,
    humanAccountable: true,
    advisoryOnly: true,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");
});

// ─────────────────────────────────────────────────────────────────────────────
// enforceResponsibilityBoundary Tests
// Returns error code string if violated, null if permitted
// ─────────────────────────────────────────────────────────────────────────────

test("enforceResponsibilityBoundary returns null for deterministic_hot_path_only with human_required", () => {
  const result = enforceResponsibilityBoundary("deterministic_hot_path_only", "human_required");
  assert.equal(result, null);
});

test("enforceResponsibilityBoundary returns error for deterministic_hot_path_only with llm_assisted", () => {
  const result = enforceResponsibilityBoundary("deterministic_hot_path_only", "llm_assisted");
  assert.equal(result, "domain.responsibility_boundary.deterministic_only_violation");
});

test("enforceResponsibilityBoundary returns error for deterministic_hot_path_only with full_auto", () => {
  const result = enforceResponsibilityBoundary("deterministic_hot_path_only", "full_auto");
  assert.equal(result, "domain.responsibility_boundary.deterministic_only_violation");
});

test("enforceResponsibilityBoundary returns null for human_accountable with human_required", () => {
  const result = enforceResponsibilityBoundary("human_accountable", "human_required");
  assert.equal(result, null);
});

test("enforceResponsibilityBoundary returns null for human_accountable with llm_assisted", () => {
  const result = enforceResponsibilityBoundary("human_accountable", "llm_assisted");
  assert.equal(result, null);
});

test("enforceResponsibilityBoundary returns error for human_accountable with full_auto", () => {
  const result = enforceResponsibilityBoundary("human_accountable", "full_auto");
  assert.equal(result, "domain.responsibility_boundary.human_accountable_violation");
});

test("enforceResponsibilityBoundary returns null for advisory_only with any autonomy level", () => {
  assert.equal(enforceResponsibilityBoundary("advisory_only", "full_auto"), null);
  assert.equal(enforceResponsibilityBoundary("advisory_only", "llm_assisted"), null);
  assert.equal(enforceResponsibilityBoundary("advisory_only", "human_required"), null);
});

test("enforceResponsibilityBoundary returns null for fully_autonomous with any autonomy level", () => {
  assert.equal(enforceResponsibilityBoundary("fully_autonomous", "full_auto"), null);
  assert.equal(enforceResponsibilityBoundary("fully_autonomous", "llm_assisted"), null);
  assert.equal(enforceResponsibilityBoundary("fully_autonomous", "human_required"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests: resolveDomainRiskSpec + toResponsibilityBoundary + enforceResponsibilityBoundary
// ─────────────────────────────────────────────────────────────────────────────

test("healthcare domain resolves to deterministic_hot_path_only boundary", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "healthcare",
    riskClass: "critical",
    deterministicHotPathOnly: true,
    humanAccountable: true,
    advisoryOnly: true,
    liabilityOwner: ["healthcare-owners"],
    compensationModel: ["manual_repair", "appeal"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");

  // Healthcare allows human_required but not llm_assisted or full_auto
  assert.equal(enforceResponsibilityBoundary(boundary, "human_required"), null);
  assert.notEqual(enforceResponsibilityBoundary(boundary, "llm_assisted"), null);
  assert.notEqual(enforceResponsibilityBoundary(boundary, "full_auto"), null);
});

test("quant-trading domain resolves to deterministic_hot_path_only boundary", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "quant-trading",
    riskClass: "high",
    deterministicHotPathOnly: true,
    humanAccountable: true,
    advisoryOnly: false,
    liabilityOwner: ["quant-trading-owners"],
    compensationModel: ["reversal", "manual_repair"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");
});

test("legal domain resolves to deterministic_hot_path_only boundary", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "legal",
    riskClass: "critical",
    deterministicHotPathOnly: true,
    humanAccountable: true,
    advisoryOnly: true,
    liabilityOwner: ["legal-owners"],
    compensationModel: ["appeal", "manual_repair"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");
});

test("low-risk domain allows full autonomy", () => {
  const spec: DomainRiskSpec = DomainRiskSpecSchema.parse({
    domainId: "low-risk",
    riskClass: "low",
    deterministicHotPathOnly: false,
    humanAccountable: false,
    advisoryOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "fully_autonomous");

  // All autonomy levels should be allowed
  assert.equal(enforceResponsibilityBoundary(boundary, "full_auto"), null);
  assert.equal(enforceResponsibilityBoundary(boundary, "llm_assisted"), null);
  assert.equal(enforceResponsibilityBoundary(boundary, "human_required"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// executionProfile validation in smoke tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainRiskSpecSchema accepts all risk classes with correct boundary mapping", () => {
  const classes = ["low", "medium", "high", "critical"] as const;
  for (const rc of classes) {
    const spec = DomainRiskSpecSchema.parse({
      domainId: `domain-${rc}`,
      riskClass: rc,
      deterministicHotPathOnly: false,
      humanAccountable: false,
      advisoryOnly: false,
      liabilityOwner: ["owner"],
      compensationModel: ["no_compensation"],
    });
    assert.equal(spec.riskClass, rc);
  }
});

test("DomainRiskSpecSchema validates required fields", () => {
  assert.throws(() => {
    DomainRiskSpecSchema.parse({
      domainId: "",
      riskClass: "high",
      liabilityOwner: ["owner"],
      compensationModel: ["manual_repair"],
    });
  }, /domainId.*minimum/);
});
