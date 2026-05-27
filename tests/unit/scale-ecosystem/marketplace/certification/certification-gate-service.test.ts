/**
 * Unit tests for Certification Gate Service
 *
 * Tests the CertificationGateService class for marketplace certification validation.
 *
 * @see src/scale-ecosystem/marketplace/certification/certification-gate-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CertificationGateService,
  getCertificationGateService,
  type CertificationResult,
  type SecurityScanStatus,
} from "../../../../../src/scale-ecosystem/marketplace/certification/certification-gate-service.js";
import type { AgentCertification, PackCertification } from "../../../../../src/scale-ecosystem/marketplace/certification/index.js";
import {
  getAgentCertification,
  getPackCertification,
  type CertificationEvidence,
} from "../../../../../src/scale-ecosystem/marketplace/certification/index.js";

test("CertificationGateService is constructable [certification-gate-service]", () => {
  const service = new CertificationGateService();
  assert.ok(service != null);
});

test("getCertificationGateService returns singleton [certification-gate-service]", () => {
  const service1 = getCertificationGateService();
  const service2 = getCertificationGateService();
  assert.ok(service1 === service2);
});

test("validateAgentCertification returns not found when no certification exists [certification-gate-service]", () => {
  const service = new CertificationGateService();
  const result = service.validateAgentCertification("non-existent-agent");

  assert.equal(result.success, false);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some(r => r.includes("not found")));
  assert.ok(result.blockedBy.includes("certification_not_found"));
  assert.equal(result.certificationId, null);
});

test("validatePackCertification returns not found when no certification exists [certification-gate-service]", () => {
  const service = new CertificationGateService();
  const result = service.validatePackCertification("non-existent-pack");

  assert.equal(result.success, false);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some(r => r.includes("not found")));
  assert.ok(result.blockedBy.includes("certification_not_found"));
  assert.equal(result.certificationId, null);
});

test("checkSecurityScanStatus returns pending for non-existent artifact [certification-gate-service]", () => {
  const service = new CertificationGateService();
  const result = service.checkSecurityScanStatus("non-existent-artifact");

  assert.equal(result.status, "pending");
  assert.equal(result.passed, false);
  assert.equal(result.findingsCount, 0);
  assert.equal(result.scanId, "");
});

test("CertificationGateService type exports are correct [certification-gate-service]", () => {
  const result: CertificationResult = {
    success: true,
    allowed: true,
    reasons: ["Approved"],
    blockedBy: [],
    certificationId: "cert-001",
    expiresAt: "2026-12-31T23:59:59Z",
  };

  assert.equal(result.success, true);
  assert.equal(result.allowed, true);
  assert.equal(result.certificationId, "cert-001");
});

test("SecurityScanStatus type exports are correct [certification-gate-service]", () => {
  const status: SecurityScanStatus = {
    artifactId: "artifact-001",
    scanId: "scan-001",
    status: "completed",
    passed: true,
    findingsCount: 0,
    scannedAt: "2026-05-01T00:00:00Z",
    expiresAt: "2026-06-01T00:00:00Z",
  };

  assert.equal(status.status, "completed");
  assert.equal(status.passed, true);
  assert.equal(status.findingsCount, 0);
});

test("checkSecurityScanStatus type structure is correct [certification-gate-service]", () => {
  const service = new CertificationGateService();
  const result = service.checkSecurityScanStatus("test-artifact");

  assert.ok(result.hasOwnProperty("artifactId"));
  assert.ok(result.hasOwnProperty("scanId"));
  assert.ok(result.hasOwnProperty("status"));
  assert.ok(result.hasOwnProperty("passed"));
  assert.ok(result.hasOwnProperty("findingsCount"));
  assert.ok(result.hasOwnProperty("scannedAt"));
  assert.ok(result.hasOwnProperty("expiresAt"));
});

test("CertificationResult blockedBy can be empty [certification-gate-service]", () => {
  const result: CertificationResult = {
    success: true,
    allowed: true,
    reasons: ["Approved"],
    blockedBy: [],
    certificationId: "cert-001",
    expiresAt: null,
  };

  assert.deepEqual(result.blockedBy, []);
});

test("CertificationResult expiresAt can be null [certification-gate-service]", () => {
  const result: CertificationResult = {
    success: false,
    allowed: false,
    reasons: ["Pending"],
    blockedBy: ["certification_pending"],
    certificationId: null,
    expiresAt: null,
  };

  assert.equal(result.expiresAt, null);
  assert.equal(result.certificationId, null);
});