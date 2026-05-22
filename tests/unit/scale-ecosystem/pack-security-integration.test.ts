/**
 * Pack Security Integration Tests
 *
 * Tests integration between pack security module and marketplace services.
 * Validates that security policies work correctly with existing pack infrastructure.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SECURITY_POLICIES,
  evaluatePackSecurityPolicy,
  generatePackSecurityReport,
  type PackSecurityEvaluationInput,
  type PackSecurityScanResult,
} from "../../../src/scale-ecosystem/pack-security/index.js";

import { PackSecurityService } from "../../../src/scale-ecosystem/marketplace/pack-security-service.js";
import { PluginTrustStore } from "../../../src/scale-ecosystem/marketplace/plugin-trust-store.js";
import { createHash } from "node:crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// PackSecurityService Integration
// ─────────────────────────────────────────────────────────────────────────────

test("PackSecurityService.runSecurityScan produces scan result compatible with pack security types", async () => {
  const service = new PackSecurityService();
  const sourceCode = "console.log('hello');";

  const result = await service.runSecurityScan({
    packId: "integration-test-pack",
    version: "1.0.0",
    sourceUri: `inline:${sourceCode}`,
    manifestChecksum: sha256(sourceCode),
    capabilities: ["read"],
    permissions: ["read:data"],
  });

  // Verify the scan result conforms to the interface
  assert.ok(result.scanId);
  assert.ok(result.packId === "integration-test-pack");
  assert.ok(result.version === "1.0.0");
  assert.ok(["passed", "warning", "failed"].includes(result.status));
  assert.ok(Array.isArray(result.issues));
  assert.ok(result.scannedAt);
  assert.ok(typeof result.scanDurationMs === "number");
});

test("PackSecurityService detects dangerous patterns and produces security issues", async () => {
  const service = new PackSecurityService();
  const maliciousCode = "exec(userInput); eval(userData);";

  const result = await service.runSecurityScan({
    packId: "malicious-pack",
    version: "1.0.0",
    sourceUri: `inline:${maliciousCode}`,
    manifestChecksum: sha256(maliciousCode),
    capabilities: ["exec"],
    permissions: ["exec:bash"],
  });

  assert.equal(result.status, "failed");
  assert.ok(result.issues.length > 0);

  // Check for expected security issue codes
  const codes = result.issues.map((i) => i.code);
  assert.ok(codes.includes("SAND001") || codes.includes("SAND010"));
});

test("PackSecurityService with custom fetch returns vulnerability results", async () => {
  const service = new PackSecurityService({
    fetchImpl: (async () => ({
      ok: true,
      json: async () => ({
        vulns: [{
          id: "CVE-2024-TEST",
          aliases: ["CVE-2024-TEST"],
          summary: "Test vulnerability",
          database_specific: { severity: "high" },
          affected: [{
            ranges: [{ events: [{ introduced: "0", fixed: "2.0.0" }] }],
          }],
        }],
      }),
    })) as typeof fetch,
  });

  const vulnerabilities = await service.scanDependencyVulnerabilitiesAsync([
    { packId: "test-package", version: "1.0.0", capabilities: [] },
  ]);

  assert.equal(vulnerabilities.length, 1);
  assert.equal(vulnerabilities[0]!.packId, "test-package");
  assert.equal(vulnerabilities[0]!.vulnerabilities.length, 1);
});

test("PackSecurityService detectDependencyConflicts returns proper structure", () => {
  const service = new PackSecurityService();

  const result = service.detectDependencyConflicts(
    "test-pack",
    "1.0.0",
    [
      { packId: "dep-a", version: "2.0.0", capabilities: ["compute"] },
      { packId: "dep-b", version: "1.0.0", capabilities: ["storage"] },
    ],
    [
      { packId: "existing-pack", version: "1.0.0", capabilities: ["compute"] },
    ],
  );

  assert.equal(result.packId, "test-pack");
  assert.equal(result.version, "1.0.0");
  assert.ok(typeof result.resolved === "boolean");
  assert.ok(Array.isArray(result.conflicts));
  assert.ok(Array.isArray(result.suggestions));
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginTrustStore Integration
// ─────────────────────────────────────────────────────────────────────────────

test("PluginTrustStore works with security evaluation", () => {
  const store = new PluginTrustStore();

  // Register a trust root
  const trustRoot = store.registerTrustRoot({
    publisherId: "trusted-publisher",
    rootFingerprint: "fingerprint-1234567890abcdef",
    source: "sigstore://trusted-publisher",
    trustLevel: "verified",
    supportedArtifactTypes: ["pack", "plugin"],
    requiredIsolationMode: "dedicated_pool",
  });

  // Record provenance
  const provenance = store.recordProvenance({
    artifactId: "artifact-trusted",
    publisherId: "trusted-publisher",
    sourceUri: "registry://trusted-artifact",
    manifestChecksum: "checksum-abc",
    sbomDigest: "sbom-abc",
    signatureDigest: "sig-abc",
  });

  // Evaluate artifact
  const decision = store.evaluateArtifact({
    artifactId: "artifact-trusted",
    publisherId: "trusted-publisher",
    artifactType: "pack",
    manifestChecksum: "checksum-abc",
    sbomDigest: "sbom-abc",
    signatureDigest: "sig-abc",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
  });

  assert.equal(decision.trusted, true);
  assert.equal(decision.matchedTrustRootId, trustRoot.trustRootId);
  assert.equal(decision.provenanceId, provenance.provenanceId);
  assert.equal(decision.requiredIsolationMode, "dedicated_pool");
});

test("PluginTrustStore blocks unverified artifacts", () => {
  const store = new PluginTrustStore();

  // Register trust root
  store.registerTrustRoot({
    publisherId: "publisher-xyz",
    rootFingerprint: "fingerprint-xyz-123456",
    source: "sigstore://publisher-xyz",
    supportedArtifactTypes: ["pack"],
  });

  // Evaluate without provenance
  const decision = store.evaluateArtifact({
    artifactId: "unverified-artifact",
    publisherId: "publisher-xyz",
    artifactType: "pack",
    manifestChecksum: "wrong-checksum",
    sbomDigest: "wrong-sbom",
    signatureDigest: "wrong-sig",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: true,
    egressPolicyReviewed: true,
  });

  assert.equal(decision.trusted, false);
  assert.ok(decision.blockedBy.length > 0);
});

test("PluginTrustStore revocation blocks artifacts", () => {
  const store = new PluginTrustStore();

  store.registerTrustRoot({
    publisherId: "revoked-publisher",
    rootFingerprint: "fingerprint-revoked-123456",
    source: "sigstore://revoked-publisher",
    supportedArtifactTypes: ["pack"],
  });

  store.recordProvenance({
    artifactId: "revoked-artifact",
    publisherId: "revoked-publisher",
    sourceUri: "registry://revoked",
    manifestChecksum: "checksum-revoked",
    sbomDigest: "sbom-revoked",
    signatureDigest: "sig-revoked",
  });

  // Revoke the artifact
  store.revokeArtifact({
    artifactId: "revoked-artifact",
    publisherId: "revoked-publisher",
    reasonCode: "security_incident",
  });

  // Evaluate should be blocked
  const decision = store.evaluateArtifact({
    artifactId: "revoked-artifact",
    publisherId: "revoked-publisher",
    artifactType: "pack",
    manifestChecksum: "checksum-revoked",
    sbomDigest: "sbom-revoked",
    signatureDigest: "sig-revoked",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
  });

  assert.equal(decision.trusted, false);
  assert.ok(decision.blockedBy.includes("plugin_artifact_revoked"));
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-End Security Workflow
// ─────────────────────────────────────────────────────────────────────────────

test("End-to-end: Security scan + policy evaluation workflow", async () => {
  const securityService = new PackSecurityService();
  const trustStore = new PluginTrustStore();

  // Setup trusted publisher
  const trustRoot = trustStore.registerTrustRoot({
    publisherId: "publisher-e2e",
    rootFingerprint: "e2e-fingerprint-1234567890abcdef",
    source: "sigstore://publisher-e2e",
    supportedArtifactTypes: ["pack"],
  });

  // Register provenance
  const sourceCode = "export default { action: 'process' };";
  trustStore.recordProvenance({
    artifactId: "pack-e2e",
    publisherId: "publisher-e2e",
    sourceUri: "registry://pack-e2e",
    manifestChecksum: sha256(sourceCode),
    sbomDigest: "sbom-e2e",
    signatureDigest: "sig-e2e",
  });

  // Run security scan
  const scanResult = await securityService.runSecurityScan({
    packId: "pack-e2e",
    version: "1.0.0",
    sourceUri: `inline:${sourceCode}`,
    manifestChecksum: sha256(sourceCode),
    capabilities: ["data_processing"],
    permissions: [],
  });

  // Evaluate against policy
  const evaluationInput: PackSecurityEvaluationInput = {
    packId: "pack-e2e",
    version: "1.0.0",
    publisherId: "publisher-e2e",
    trustLevel: "verified",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [],
  };

  const policy = DEFAULT_SECURITY_POLICIES[0]!; // Strict policy
  const evaluation = evaluatePackSecurityPolicy(evaluationInput, policy);

  // Generate report
  const scanResultsForReport: readonly PackSecurityScanResult[] = [scanResult as PackSecurityScanResult];
  const report = generatePackSecurityReport("pack-e2e", "1.0.0", scanResultsForReport, evaluation);

  assert.equal(report.packId, "pack-e2e");
  assert.equal(report.version, "1.0.0");
  assert.equal(report.trustEvaluation.trusted, true);
});

test("End-to-end: Malicious pack blocked by scan and policy", async () => {
  const securityService = new PackSecurityService();

  // Malicious code
  const maliciousCode = "exec(userInput); child_process.spawn('rm', {shell: true});";
  const scanResult = await securityService.runSecurityScan({
    packId: "malicious-pack-e2e",
    version: "1.0.0",
    sourceUri: `inline:${maliciousCode}`,
    manifestChecksum: sha256(maliciousCode),
    capabilities: ["exec", "file_write"],
    permissions: ["exec:bash", "file:delete"],
  });

  // Policy evaluation
  const evaluationInput: PackSecurityEvaluationInput = {
    packId: "malicious-pack-e2e",
    version: "1.0.0",
    publisherId: "untrusted-publisher",
    trustLevel: "untrusted",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: false,
    egressPolicyReviewed: false,
    dependencyVulnerabilities: [],
  };

  const policy = DEFAULT_SECURITY_POLICIES[0]!;
  const evaluation = evaluatePackSecurityPolicy(evaluationInput, policy);

  const scanResultsForReport: readonly PackSecurityScanResult[] = [scanResult as PackSecurityScanResult];
  const report = generatePackSecurityReport("malicious-pack-e2e", "1.0.0", scanResultsForReport, evaluation);

  assert.equal(report.trustEvaluation.trusted, false);
  assert.ok(report.trustEvaluation.blockingReasons.length > 0);
});

test("End-to-end: Trusted pack with vulnerabilities but allowed by moderate policy", async () => {
  const securityService = new PackSecurityService();

  // Safe code but with dependency vulnerability
  const safeCode = "console.log('safe');";

  // Scan with no issues
  const scanResult = await securityService.runSecurityScan({
    packId: "pack-with-vulns",
    version: "1.0.0",
    sourceUri: `inline:${safeCode}`,
    manifestChecksum: sha256(safeCode),
    capabilities: [],
    permissions: [],
  });

  // Evaluation with moderate vulnerabilities
  const evaluationInput: PackSecurityEvaluationInput = {
    packId: "pack-with-vulns",
    version: "1.0.0",
    publisherId: "community-publisher",
    trustLevel: "community",
    signatureVerified: false,
    sbomVerified: false,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    dependencyVulnerabilities: [
      { cveId: "CVE-2024-LOW1", severity: "low", description: "Minor issue", affectedVersionRange: "<2.0.0" },
      { cveId: "CVE-2024-LOW2", severity: "low", description: "Minor issue", affectedVersionRange: "<2.0.0" },
    ],
  };

  const moderatePolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-moderate")!;
  const evaluation = evaluatePackSecurityPolicy(evaluationInput, moderatePolicy);

  const scanResultsForReport: readonly PackSecurityScanResult[] = [scanResult as PackSecurityScanResult];
  const report = generatePackSecurityReport("pack-with-vulns", "1.0.0", scanResultsForReport, evaluation);

  // Moderate policy allows community packs with low vulnerabilities
  assert.equal(evaluation.allowed, true);
  assert.equal(report.trustEvaluation.trustLevel, "community");
});

// ─────────────────────────────────────────────────────────────────────────────
// Policy Selection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Default strict policy is appropriate for production", () => {
  const strictPolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-strict")!;

  assert.equal(strictPolicy.enabled, true);
  assert.equal(strictPolicy.minTrustLevel, "verified");
  assert.equal(strictPolicy.blockUnverified, true);
  assert.equal(strictPolicy.criticalVulnerabilitiesBlockInstall, true);
});

test("Moderate policy balances security and usability", () => {
  const moderatePolicy = DEFAULT_SECURITY_POLICIES.find((p) => p.policyId === "default-moderate")!;

  // Moderate policy should allow more flexibility
  assert.ok([
    "community",
    "verified",
    "untrusted",
  ].includes(moderatePolicy.minTrustLevel));
  assert.ok(moderatePolicy.maxDependencyVulnerabilities >= 5);
});

test("All policies have unique IDs", () => {
  const policyIds = DEFAULT_SECURITY_POLICIES.map((p) => p.policyId);
  const uniqueIds = new Set(policyIds);
  assert.equal(uniqueIds.size, policyIds.length);
});

test("All policies have required fields", () => {
  for (const policy of DEFAULT_SECURITY_POLICIES) {
    assert.ok(policy.policyId);
    assert.ok(policy.name);
    assert.ok(typeof policy.enabled === "boolean");
    assert.ok(policy.minTrustLevel);
    assert.ok(typeof policy.blockUnverified === "boolean");
    assert.ok(typeof policy.requireSignature === "boolean");
    assert.ok(typeof policy.requireSbom === "boolean");
    assert.ok(typeof policy.allowCommunityPacks === "boolean");
    assert.ok(typeof policy.maxDependencyVulnerabilities === "number");
    assert.ok(typeof policy.criticalVulnerabilitiesBlockInstall === "boolean");
  }
});
