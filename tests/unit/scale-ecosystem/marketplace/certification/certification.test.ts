/**
 * Unit tests for Marketplace Certification
 *
 * @see src/scale-ecosystem/marketplace/certification/
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentCertificationSchema,
  PackCertificationSchema,
  CertificationGate,
  isAgentMarketplaceReady,
  isPackMarketplaceReady,
  type AgentCertification,
  type PackCertification,
} from "../../../../../src/scale-ecosystem/marketplace/certification/index.js";

test("AgentCertificationSchema parses valid pending record", () => {
  const record = {
    certificationId: "cert_001",
    agentId: "agent_001",
    version: "1.0.0",
    status: "pending",
    trustLevel: "unverified",
  };

  const result = AgentCertificationSchema.parse(record);

  assert.equal(result.certificationId, "cert_001");
  assert.equal(result.agentId, "agent_001");
  assert.equal(result.status, "pending");
});

test("AgentCertificationSchema parses valid approved record", () => {
  const record = {
    certificationId: "cert_002",
    agentId: "agent_002",
    version: "1.0.0",
    status: "approved",
    approvedAt: "2026-04-01T00:00:00.000Z",
    trustLevel: "trusted",
  };

  const result = AgentCertificationSchema.parse(record);

  assert.equal(result.status, "approved");
  assert.equal(result.approvedAt, "2026-04-01T00:00:00.000Z");
});

test("AgentCertificationSchema parses valid revoked record", () => {
  const record = {
    certificationId: "cert_003",
    agentId: "agent_003",
    version: "1.0.0",
    status: "revoked",
    trustLevel: "unverified",
  };

  const result = AgentCertificationSchema.parse(record);

  assert.equal(result.status, "revoked");
});

test("CertificationGate checkAgentCertification allows approved agent", () => {
  const cert: AgentCertification = {
    certificationId: "cert_004",
    agentId: "agent_004",
    version: "1.0.0",
    status: "approved",
    securityScan: {
      scanId: "scan_001",
      passed: true,
      findings: [],
      scannedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    evaluationResult: {
      evalId: "eval_001",
      passed: true,
      score: 85,
      categories: [],
      evaluatedAt: "2026-04-01T00:00:00.000Z",
    },
    sbomRef: {
      sbomId: "sbom_001",
      uri: "https://example.com/sbom.json",
      hash: "abc123",
      format: "spdx",
      version: "1.0",
      createdAt: "2026-04-01T00:00:00.000Z",
    },
    sandboxCertification: null,
    compatibilityTest: null,
    egressPolicyReview: null,
    trustLevel: "trusted",
    approvedAt: "2026-04-01T00:00:00.000Z",
    revokedAt: null,
    expiresAt: null,
    approvedBy: "admin",
    notes: "",
  };

  const gate = new CertificationGate();
  const result = gate.checkAgentCertification(cert);

  assert.equal(result.allowed, true);
});

test("CertificationGate checkAgentCertification blocks revoked agent", () => {
  const cert: AgentCertification = {
    certificationId: "cert_005",
    agentId: "agent_005",
    version: "1.0.0",
    status: "revoked",
    securityScan: {
      scanId: "scan_002",
      passed: true,
      findings: [],
      scannedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    evaluationResult: {
      evalId: "eval_002",
      passed: true,
      score: 85,
      categories: [],
      evaluatedAt: "2026-04-01T00:00:00.000Z",
    },
    sbomRef: {
      sbomId: "sbom_002",
      uri: "https://example.com/sbom.json",
      hash: "def456",
      format: "spdx",
      version: "1.0",
      createdAt: "2026-04-01T00:00:00.000Z",
    },
    sandboxCertification: null,
    compatibilityTest: null,
    egressPolicyReview: null,
    trustLevel: "unverified",
    approvedAt: null,
    revokedAt: "2026-04-02T00:00:00.000Z",
    expiresAt: null,
    approvedBy: null,
    notes: "",
  };

  const gate = new CertificationGate();
  const result = gate.checkAgentCertification(cert);

  assert.equal(result.allowed, false);
  assert.ok(result.blockedBy.includes("certification_revoked"));
});

test("CertificationGate checkAgentCertification blocks unverified agent", () => {
  const cert: AgentCertification = {
    certificationId: "cert_006",
    agentId: "agent_006",
    version: "1.0.0",
    status: "approved",
    securityScan: {
      scanId: "scan_003",
      passed: true,
      findings: [],
      scannedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    evaluationResult: {
      evalId: "eval_003",
      passed: true,
      score: 85,
      categories: [],
      evaluatedAt: "2026-04-01T00:00:00.000Z",
    },
    sbomRef: {
      sbomId: "sbom_003",
      uri: "https://example.com/sbom.json",
      hash: "ghi789",
      format: "spdx",
      version: "1.0",
      createdAt: "2026-04-01T00:00:00.000Z",
    },
    sandboxCertification: null,
    compatibilityTest: null,
    egressPolicyReview: null,
    trustLevel: "unverified",
    approvedAt: "2026-04-01T00:00:00.000Z",
    revokedAt: null,
    expiresAt: null,
    approvedBy: "admin",
    notes: "",
  };

  const gate = new CertificationGate();
  const result = gate.checkAgentCertification(cert);

  assert.equal(result.allowed, false);
  assert.ok(result.blockedBy.includes("trust_level_unverified"));
});

test("PackCertificationSchema parses valid pending record", () => {
  const record = {
    certificationId: "cert_007",
    packId: "pack_001",
    version: "1.0.0",
    status: "pending",
    trustLevel: "unverified",
  };

  const result = PackCertificationSchema.parse(record);

  assert.equal(result.certificationId, "cert_007");
  assert.equal(result.packId, "pack_001");
  assert.equal(result.status, "pending");
});

test("PackCertificationSchema parses valid approved record", () => {
  const record = {
    certificationId: "cert_008",
    packId: "pack_002",
    version: "1.0.0",
    status: "approved",
    approvedAt: "2026-04-01T00:00:00.000Z",
    trustLevel: "community",
  };

  const result = PackCertificationSchema.parse(record);

  assert.equal(result.status, "approved");
  assert.equal(result.approvedAt, "2026-04-01T00:00:00.000Z");
});

test("CertificationGate checkPackCertification allows approved pack with all gates passed", () => {
  const cert: PackCertification = {
    certificationId: "cert_009",
    packId: "pack_003",
    version: "1.0.0",
    status: "approved",
    securityScan: {
      scanId: "scan_004",
      passed: true,
      findings: [],
      scannedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    evaluationResult: null,
    sbomRef: {
      sbomId: "sbom_004",
      uri: "https://example.com/sbom.json",
      hash: "jkl012",
      format: "spdx",
      version: "1.0",
      createdAt: "2026-04-01T00:00:00.000Z",
    },
    sandboxCertification: {
      sandboxId: "sandbox_001",
      passed: true,
      sandboxType: "isolated",
      capabilitiesVerified: ["net_isolation", "fs_isolation"],
      isolationLevel: "high",
      testedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    compatibilityTest: {
      testId: "test_001",
      passed: true,
      apiContract: "v1",
      permissionSurface: "minimal",
      runtimeCapability: "standard",
      testResults: [],
      testedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    egressPolicyReview: {
      reviewId: "review_001",
      passed: true,
      allowedEgressEndpoints: ["https://api.example.com"],
      blockedEgressEndpoints: [],
      reviewNotes: "All clear",
      reviewedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
    },
    trustLevel: "community",
    approvedAt: "2026-04-01T00:00:00.000Z",
    revokedAt: null,
    expiresAt: null,
    approvedBy: "admin",
    notes: "",
  };

  const gate = new CertificationGate();
  const result = gate.checkPackCertification(cert);

  assert.equal(result.allowed, true);
});