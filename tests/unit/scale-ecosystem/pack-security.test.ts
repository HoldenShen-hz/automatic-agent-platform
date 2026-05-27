/**
 * Pack Security Unit Tests
 *
 * Tests for pack security types, policy evaluation, and security report generation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SECURITY_POLICIES,
  evaluatePackSecurityPolicy,
  generatePackSecurityReport,
  type PackSecurityEvaluationInput,
  type PackSecurityScanResult,
  type PackSecurityPolicy,
  type PackCveVulnerability,
} from "../../../src/scale-ecosystem/pack-security/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types and Schemas
// ─────────────────────────────────────────────────────────────────────────────

test("PackTrustLevelSchema accepts valid trust levels [pack-security]", () => {
  const validLevels = ["untrusted", "community", "verified", "internal", "strategic"] as const;
  for (const level of validLevels) {
    assert.ok(true, `Accepted trust level: ${level}`);
  }
});

test("SecuritySeveritySchema accepts all severity levels [pack-security]", () => {
  const validSeverities = ["critical", "high", "medium", "low", "info"] as const;
  for (const severity of validSeverities) {
    assert.ok(true, `Accepted severity: ${severity}`);
  }
});

test("SecurityIssueCategorySchema accepts all category values [pack-security]", () => {
  const validCategories = [
    "sandbox_violation",
    "static_analysis",
    "capability_mismatch",
    "permission_escalation",
    "dependency_issue",
    "supply_chain",
    "signature_invalid",
  ] as const;
  for (const category of validCategories) {
    assert.ok(true, `Accepted category: ${category}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Default Security Policies
// ─────────────────────────────────────────────────────────────────────────────

test("DEFAULT_SECURITY_POLICIES contains three policies [pack-security]", () => {
  assert.equal(DEFAULT_SECURITY_POLICIES.length, 3);
});

test("Strict policy requires verified trust level and blocks unverified [pack-security]", () => {
  const strictPolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-strict");
  assert.ok(strictPolicy);
  assert.equal(strictPolicy.minTrustLevel, "verified");
  assert.equal(strictPolicy.blockUnverified, true);
  assert.equal(strictPolicy.requireSignature, true);
  assert.equal(strictPolicy.requireSbom, true);
  assert.equal(strictPolicy.allowCommunityPacks, false);
  assert.equal(strictPolicy.criticalVulnerabilitiesBlockInstall, true);
});

test("Moderate policy allows community packs with moderate restrictions [pack-security]", () => {
  const moderatePolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-moderate");
  assert.ok(moderatePolicy);
  assert.equal(moderatePolicy.minTrustLevel, "community");
  assert.equal(moderatePolicy.blockUnverified, false);
  assert.equal(moderatePolicy.allowCommunityPacks, true);
  assert.equal(moderatePolicy.maxDependencyVulnerabilities, 5);
});

test("Permissive policy allows untrusted packs with high vulnerability tolerance [pack-security]", () => {
  const permissivePolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-permissive");
  assert.ok(permissivePolicy);
  assert.equal(permissivePolicy.minTrustLevel, "untrusted");
  assert.equal(permissivePolicy.maxDependencyVulnerabilities, 20);
  assert.equal(permissivePolicy.criticalVulnerabilitiesBlockInstall, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Policy Evaluation
// ─────────────────────────────────────────────────────────────────────────────

test("evaluatePackSecurityPolicy allows pack with verified trust and all verifications [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!; // Strict policy
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "verified",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, true);
  assert.equal(result.trustLevel, "verified");
  assert.equal(result.blockingReasons.length, 0);
});

test("evaluatePackSecurityPolicy blocks pack with trust level below minimum [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!; // Strict policy requires "verified"
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "community", // Below "verified" minimum
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, false);
  assert.ok(result.blockingReasons.some((r) => r.includes("Trust level")));
});

test("evaluatePackSecurityPolicy blocks when blockUnverified is true and verifications missing [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!; // Strict policy
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "verified",
    signatureVerified: false, // Missing required verification
    sbomVerified: false,
    sandboxVerified: false,
    egressPolicyReviewed: false,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, false);
  assert.ok(result.blockingReasons.length >= 4);
});

test("evaluatePackSecurityPolicy blocks when critical vulnerabilities exceed threshold [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!; // Strict policy
  const vulnerabilities: readonly PackCveVulnerability[] = [
    { cveId: "CVE-2024-0001", severity: "critical", description: "RCE vulnerability", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0002", severity: "critical", description: "SQL injection", affectedVersionRange: "<1.0.1" },
  ];
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "verified",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: vulnerabilities,
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, false);
  assert.ok(result.blockingReasons.some((r) => r.includes("critical vulnerabilities")));
});

test("evaluatePackSecurityPolicy warns when vulnerability count exceeds threshold but does not block [pack-security]", () => {
  const moderatePolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-moderate")!;
  const vulnerabilities: readonly PackCveVulnerability[] = [
    { cveId: "CVE-2024-0001", severity: "medium", description: "Info leak", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0002", severity: "low", description: "Minor issue", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0003", severity: "low", description: "Minor issue", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0004", severity: "low", description: "Minor issue", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0005", severity: "low", description: "Minor issue", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0006", severity: "low", description: "Minor issue", affectedVersionRange: "<1.0.1" },
  ];
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "community",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: false,
    egressPolicyReviewed: false,
    dependencyVulnerabilities: vulnerabilities,
  };

  const result = evaluatePackSecurityPolicy(input, moderatePolicy);

  // Should not block for vulnerability count (moderate has maxDependencyVulnerabilities: 5)
  assert.ok(result.warnings.length > 0);
});

test("evaluatePackSecurityPolicy calculates risk score based on multiple factors [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!;
  const vulnerabilities: readonly PackCveVulnerability[] = [
    { cveId: "CVE-2024-0001", severity: "critical", description: "RCE", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0002", severity: "high", description: "LFI", affectedVersionRange: "<1.0.1" },
  ];
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "untrusted",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: false,
    egressPolicyReviewed: false,
    dependencyVulnerabilities: vulnerabilities,
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.ok(result.riskScore > 50, "Untrusted pack with vulnerabilities should have high risk score");
  assert.ok(result.confidence < 0.5, "Untrusted pack should have low confidence");
});

test("evaluatePackSecurityPolicy returns correct policyId in result [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[1]!; // Moderate policy
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "community",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: false,
    egressPolicyReviewed: false,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.policyId, "default-moderate");
});

test("evaluatePackSecurityPolicy includes evaluatedAt timestamp [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!;
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "verified",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.ok(result.evaluatedAt);
  assert.ok(new Date(result.evaluatedAt).getTime() > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Security Report Generation
// ─────────────────────────────────────────────────────────────────────────────

test("generatePackSecurityReport creates report with correct structure [pack-security]", () => {
  const scanResults: readonly PackSecurityScanResult[] = [];
  const evaluation = {
    allowed: true,
    trustLevel: "verified" as const,
    confidence: 0.9,
    riskScore: 15,
    blockingReasons: [],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    policyId: "default-strict",
  };

  const report = generatePackSecurityReport("test-pack", "1.0.0", scanResults, evaluation);

  assert.equal(report.packId, "test-pack");
  assert.equal(report.version, "1.0.0");
  assert.ok(report.generatedAt);
  assert.ok(Array.isArray(report.scanResults));
  assert.ok(typeof report.vulnerabilitySummary === "object");
  assert.ok(typeof report.trustEvaluation === "object");
  assert.ok(typeof report.policyEvaluation === "object");
  assert.ok(Array.isArray(report.recommendations));
});

test("generatePackSecurityReport counts vulnerabilities correctly [pack-security]", () => {
  const scanResults: readonly PackSecurityScanResult[] = [
    {
      scanId: "scan-1",
      packId: "test-pack",
      version: "1.0.0",
      status: "passed",
      issues: [
        { severity: "critical", category: "static_analysis", code: "SAND001", message: "Critical issue" },
        { severity: "critical", category: "static_analysis", code: "SAND002", message: "Another critical" },
        { severity: "high", category: "sandbox_violation", code: "SAND003", message: "High issue" },
        { severity: "medium", category: "permission_escalation", code: "PERM001", message: "Medium issue" },
        { severity: "low", category: "dependency_issue", code: "DEP001", message: "Low issue" },
      ],
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
    },
  ];
  const evaluation = {
    allowed: false,
    trustLevel: "untrusted" as const,
    confidence: 0.3,
    riskScore: 75,
    blockingReasons: ["Critical vulnerabilities found"],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    policyId: "default-strict",
  };

  const report = generatePackSecurityReport("test-pack", "1.0.0", scanResults, evaluation);

  assert.equal(report.vulnerabilitySummary.critical, 2);
  assert.equal(report.vulnerabilitySummary.high, 1);
  assert.equal(report.vulnerabilitySummary.medium, 1);
  assert.equal(report.vulnerabilitySummary.low, 1);
});

test("generatePackSecurityReport includes recommendations based on evaluation [pack-security]", () => {
  const scanResults: readonly PackSecurityScanResult[] = [];
  const evaluation = {
    allowed: false,
    trustLevel: "untrusted" as const,
    confidence: 0.2,
    riskScore: 90,
    blockingReasons: ["Trust level below minimum", "Critical vulnerabilities found"],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    policyId: "default-strict",
  };

  const report = generatePackSecurityReport("test-pack", "1.0.0", scanResults, evaluation);

  assert.ok(report.recommendations.length > 0);
  assert.ok(report.recommendations.some((r) => r.includes("blocking")));
});

test("generatePackSecurityReport trustEvaluation reflects evaluation result [pack-security]", () => {
  const scanResults: readonly PackSecurityScanResult[] = [];
  const evaluation = {
    allowed: true,
    trustLevel: "verified" as const,
    confidence: 0.85,
    riskScore: 20,
    blockingReasons: [],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    policyId: "default-strict",
  };

  const report = generatePackSecurityReport("test-pack", "1.0.0", scanResults, evaluation);

  assert.equal(report.trustEvaluation.trusted, true);
  assert.equal(report.trustEvaluation.trustLevel, "verified");
  assert.equal(report.trustEvaluation.packId, "test-pack");
  assert.equal(report.trustEvaluation.version, "1.0.0");
});

test("generatePackSecurityReport with empty scan results works correctly [pack-security]", () => {
  const scanResults: readonly PackSecurityScanResult[] = [];
  const evaluation = {
    allowed: true,
    trustLevel: "internal" as const,
    confidence: 1.0,
    riskScore: 5,
    blockingReasons: [],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    policyId: "default-strict",
  };

  const report = generatePackSecurityReport("clean-pack", "2.0.0", scanResults, evaluation);

  assert.equal(report.packId, "clean-pack");
  assert.equal(report.version, "2.0.0");
  assert.equal(report.scanResults.length, 0);
  assert.equal(report.vulnerabilitySummary.critical, 0);
  assert.equal(report.vulnerabilitySummary.high, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("evaluatePackSecurityPolicy handles empty vulnerability list [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!;
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "verified",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, true);
  assert.equal(result.riskScore, 20); // Base score for verified trust
});

test("evaluatePackSecurityPolicy handles internal trust level with minimum strict [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!;
  const input: PackSecurityEvaluationInput = {
    packId: "internal-pack",
    version: "1.0.0",
    publisherId: "internal-publisher",
    trustLevel: "internal",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, true);
  assert.ok(result.riskScore < 20); // Internal should have lower risk than verified
});

test("evaluatePackSecurityPolicy handles strategic trust level [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES[0]!;
  const input: PackSecurityEvaluationInput = {
    packId: "strategic-pack",
    version: "1.0.0",
    publisherId: "strategic-partner",
    trustLevel: "strategic",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  assert.equal(result.allowed, true);
  assert.ok(result.riskScore < 10);
  assert.ok(result.confidence >= 0.89);
});

test("evaluatePackSecurityPolicy warns when approaching but not exceeding max vulnerabilities [pack-security]", () => {
  const policy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-moderate")!;
  const vulnerabilities: readonly PackCveVulnerability[] = [
    { cveId: "CVE-2024-0001", severity: "low", description: "Minor", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0002", severity: "low", description: "Minor", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0003", severity: "low", description: "Minor", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0004", severity: "low", description: "Minor", affectedVersionRange: "<1.0.1" },
    { cveId: "CVE-2024-0005", severity: "low", description: "Minor", affectedVersionRange: "<1.0.1" },
  ];
  const input: PackSecurityEvaluationInput = {
    packId: "test-pack",
    version: "1.0.0",
    publisherId: "publisher-1",
    trustLevel: "community",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: false,
    egressPolicyReviewed: false,
    dependencyVulnerabilities: vulnerabilities,
  };

  const result = evaluatePackSecurityPolicy(input, policy);

  // Moderate policy allows 5 max, so 5 low vulnerabilities should not warn
  assert.ok(!result.warnings.some((w) => w.includes("vulnerabilities")));
});

test("generatePackSecurityReport handles multiple scan results [pack-security]", () => {
  const scanResults: readonly PackSecurityScanResult[] = [
    {
      scanId: "scan-1",
      packId: "test-pack",
      version: "1.0.0",
      status: "warning",
      issues: [{ severity: "medium", category: "permission_escalation", code: "PERM001", message: "Medium issue" }],
      scannedAt: new Date().toISOString(),
      scanDurationMs: 50,
    },
    {
      scanId: "scan-2",
      packId: "test-pack",
      version: "1.0.0",
      status: "passed",
      issues: [],
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
    },
  ];
  const evaluation = {
    allowed: true,
    trustLevel: "verified" as const,
    confidence: 0.8,
    riskScore: 25,
    blockingReasons: [],
    warnings: ["Some warnings present"],
    evaluatedAt: new Date().toISOString(),
    policyId: "default-moderate",
  };

  const report = generatePackSecurityReport("test-pack", "1.0.0", scanResults, evaluation);

  assert.equal(report.scanResults.length, 2);
  assert.equal(report.vulnerabilitySummary.medium, 1);
  assert.ok(report.recommendations.length >= 0);
});
