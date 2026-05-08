import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainRiskSpecSchema,
  resolveDomainRiskSpec,
  type DomainRiskSpec,
} from "../../../src/domains/domain-specs.js";

function deriveResponsibilityBoundary(spec: DomainRiskSpec): string {
  if (spec.deterministicHotPathOnly) {
    return "deterministic_hot_path_only";
  }
  if (spec.humanAccountable) {
    return "human_accountable";
  }
  if (spec.advisoryOnly) {
    return "advisory_only";
  }
  return "fully_autonomous";
}

test("risk flags prioritize deterministic hot path over other responsibility modes", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "test-domain",
    riskClass: "critical",
    advisoryOnly: true,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["owner"],
    compensationModel: ["manual_repair"],
  });

  assert.equal(deriveResponsibilityBoundary(spec), "deterministic_hot_path_only");
});

test("risk flags fall back to human accountable when deterministic mode is disabled", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "test-domain",
    riskClass: "high",
    advisoryOnly: true,
    humanAccountable: true,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["manual_repair"],
  });

  assert.equal(deriveResponsibilityBoundary(spec), "human_accountable");
});

test("risk flags fall back to advisory only before fully autonomous", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "test-domain",
    riskClass: "medium",
    advisoryOnly: true,
    humanAccountable: false,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["appeal"],
  });

  assert.equal(deriveResponsibilityBoundary(spec), "advisory_only");
});

test("low-risk domains with no special flags remain fully autonomous", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "test-domain",
    riskClass: "low",
    advisoryOnly: false,
    humanAccountable: false,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  });

  assert.equal(deriveResponsibilityBoundary(spec), "fully_autonomous");
});

test("resolveDomainRiskSpec returns healthcare boundary with all guard flags enabled", () => {
  const spec = resolveDomainRiskSpec("healthcare");

  assert.notEqual(spec, null);
  assert.equal(spec?.riskClass, "critical");
  assert.equal(spec?.advisoryOnly, true);
  assert.equal(spec?.humanAccountable, true);
  assert.equal(spec?.deterministicHotPathOnly, true);
});

test("resolveDomainRiskSpec returns quant-trading boundary with deterministic hot path", () => {
  const spec = resolveDomainRiskSpec("quant-trading");

  assert.notEqual(spec, null);
  assert.equal(spec?.riskClass, "high");
  assert.equal(spec?.deterministicHotPathOnly, true);
  assert.equal(spec?.humanAccountable, true);
});

test("resolveDomainRiskSpec is case-insensitive and trims whitespace", () => {
  const spec = resolveDomainRiskSpec("  HeAlThCaRe  ");

  assert.notEqual(spec, null);
  assert.equal(spec?.domainId, "healthcare");
});

test("DomainRiskSpecSchema still validates required fields", () => {
  const result = DomainRiskSpecSchema.safeParse({
    domainId: "",
    riskClass: "high",
    liabilityOwner: ["owner"],
    compensationModel: ["manual_repair"],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["domainId"]);
  }
});
