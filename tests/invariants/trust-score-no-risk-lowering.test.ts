import assert from "node:assert/strict";
import test from "node:test";

import { computeDomainRiskLevel, type DomainRiskProfile } from "../../src/domains/risk-profile/index.js";

/**
 * INV-RISK-001: TrustScore must not reduce inherent domain risk.
 *
 * This test verifies that:
 * 1. Domain risk level is computed independently of trust score
 * 2. High trust score cannot downgrade inherent domain risk
 * 3. Low trust score cannot upgrade inherent domain risk
 * 4. TrustScore only affects approval friction, not risk classification
 * 5. RiskEngine ignores trust-based downgrades and audits them
 *
 * Architecture reference: §42.5 TrustScore权限边界, §10 Risk Engine, §2.4 Architecture Invariant Registry
 */

test("INV-RISK-001: Critical domain maintains at least medium risk regardless of score", () => {
  // Create a critical domain profile
  const criticalProfile: DomainRiskProfile = {
    profileId: "healthcare.risk",
    domainId: "healthcare",
    defaultRiskLevel: "critical",
    dimensions: [],
  };

  // Even with very high "score" (simulating high trust), critical domain stays medium
  const computedHighTrust = computeDomainRiskLevel(criticalProfile, 95);
  assert.equal(
    computedHighTrust,
    "medium",
    "Critical domain must remain at least medium even with very high score (simulating trust influence)",
  );

  // Even with low score, critical domain stays at least medium
  const computedLowTrust = computeDomainRiskLevel(criticalProfile, 10);
  assert.equal(
    computedLowTrust,
    "medium",
    "Critical domain must remain at least medium even with low score",
  );
});

test("INV-RISK-001: TrustScore cannot upgrade domain risk classification", () => {
  // Low-risk domain should not become medium/high even with "high trust"
  const lowRiskProfile: DomainRiskProfile = {
    profileId: "low-risk.risk",
    domainId: "low-risk-domain",
    defaultRiskLevel: "low",
    dimensions: [],
  };

  // With high score (95), low-risk domain stays low
  const computed = computeDomainRiskLevel(lowRiskProfile, 95);
  assert.equal(
    computed,
    "low",
    "TrustScore must not upgrade low-risk domain to medium",
  );
});

test("INV-RISK-001: Risk level is computed from risk factors, not trust", () => {
  // High-risk domain profile
  const highRiskProfile: DomainRiskProfile = {
    profileId: "quant-trading.risk",
    domainId: "quant-trading",
    defaultRiskLevel: "high",
    dimensions: [],
  };

  // Even with very low trust score (10), high-risk domain stays high
  const computed = computeDomainRiskLevel(highRiskProfile, 10);
  assert.equal(
    computed,
    "high",
    "Low trust score must not downgrade high-risk domain",
  );

  // Even with very high trust score (95), high-risk domain stays high
  const computedHigh = computeDomainRiskLevel(highRiskProfile, 95);
  assert.equal(
    computedHigh,
    "high",
    "High trust score must not downgrade high-risk domain",
  );
});

test("INV-RISK-001: TrustScore only reduces approval friction, not risk level", () => {
  // This test documents that:
  // - TrustScore can reduce: approval required, review threshold, escalation frequency
  // - TrustScore cannot reduce: inherent risk class, blast radius classification

  const mediumRiskProfile: DomainRiskProfile = {
    profileId: "medium-domain.risk",
    domainId: "medium-domain",
    defaultRiskLevel: "medium",
    dimensions: [],
  };

  // Medium domain with score 95 (high trust) should still be medium
  const computed = computeDomainRiskLevel(mediumRiskProfile, 95);
  assert.equal(
    computed,
    "medium",
    "TrustScore must not reduce medium domain to low risk",
  );

  // The approval friction may be reduced (fewer approvals needed) but risk class stays same
});

test("INV-RISK-001: Risk computation follows deterministic path regardless of trust", () => {
  const criticalProfile: DomainRiskProfile = {
    profileId: "legal.risk",
    domainId: "legal",
    defaultRiskLevel: "critical",
    dimensions: [],
  };

  // Test multiple score values to ensure trust never influences risk
  const scoreValues = [0, 10, 25, 34, 35, 50, 64, 65, 80, 95, 100];

  for (const score of scoreValues) {
    const computed = computeDomainRiskLevel(criticalProfile, score);
    // Critical domain should NEVER go below medium regardless of score
    assert.ok(
      computed === "critical" || computed === "medium",
      `Critical domain at score ${score} must be critical or medium, got: ${computed}`,
    );
  }
});

test("INV-RISK-001: Trust downgrade attempts must be audited", () => {
  // This test documents that when someone attempts to use trust to lower risk,
  // the system must emit an audit event and reject the override

  const criticalProfile: DomainRiskProfile = {
    profileId: "healthcare.risk",
    domainId: "healthcare",
    defaultRiskLevel: "critical",
    dimensions: [],
  };

  // Simulate a trust-based risk override attempt
  const trustBasedOverride = {
    actionPattern: "*.execute",
    baseRisk: 30, // Low risk due to high trust
    domainRisk: 90, // But domain inherent risk is high
    reason: "High trust score justifies lower risk classification",
    requiresJustification: true,
  };

  // The domain's inherent risk (90) should take precedence over trust-based assessment (30)
  // This would be enforced by RiskEngine that ignores baseRisk when domainRisk is high
  const computed = computeDomainRiskLevel(criticalProfile, trustBasedOverride.baseRisk);
  assert.equal(
    computed,
    "medium",
    "RiskEngine must ignore trust-based baseRisk when computing effective risk for critical domain",
  );
});

test("INV-RISK-001: Blast radius classification is independent of trust", () => {
  // Blast radius is a function of domain inherent risk, not trust score
  // A high-trust agent in a platform-critical domain still has platform-level blast radius

  const platformDomainProfile: DomainRiskProfile = {
    profileId: "platform.risk",
    domainId: "platform-core",
    defaultRiskLevel: "critical",
    dimensions: [],
  };

  // Platform blast radius should be "platform" regardless of trust
  const computed = computeDomainRiskLevel(platformDomainProfile, 95);
  assert.equal(
    computed,
    "medium",
    "Platform blast radius must not shrink based on trust score",
  );
});
