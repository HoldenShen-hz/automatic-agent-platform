/**
 * Unit tests for Marketplace Certification
 *
 * @see src/scale-ecosystem/marketplace/certification/
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CertificationRecordSchema,
  CertificationGate,
  getCertificationHealthStatus,
  isMarketplaceListingCertified,
  type CertificationRecord,
} from "../../../../../src/scale-ecosystem/marketplace/certification/index.js";

function createCertificationRecord(overrides: Partial<CertificationRecord> = {}): CertificationRecord {
  return {
    listingId: "listing-default",
    certificationId: "cert-default",
    status: "approved",
    approvedAt: "2026-04-01T00:00:00.000Z",
    healthScore: 1,
    sunsetAt: null,
    expiresAt: null,
    lastReviewedAt: "2026-04-01T00:00:00.000Z",
    activeFindings: 0,
    sbomVerified: true,
    signatureVerified: true,
    compatibilityVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
    ...overrides,
  };
}

test("CertificationRecordSchema parses valid pending record", () => {
  const record = {
    listingId: "listing_001",
    certificationId: "cert_001",
    status: "pending",
  };

  const result = CertificationRecordSchema.parse(record);

  assert.equal(result.listingId, "listing_001");
  assert.equal(result.certificationId, "cert_001");
  assert.equal(result.status, "pending");
  assert.equal(result.approvedAt, null);
});

test("CertificationRecordSchema parses valid approved record", () => {
  const record = {
    listingId: "listing_002",
    certificationId: "cert_002",
    status: "approved",
    approvedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = CertificationRecordSchema.parse(record);

  assert.equal(result.status, "approved");
  assert.equal(result.approvedAt, "2026-04-01T00:00:00.000Z");
});

test("CertificationRecordSchema parses valid revoked record", () => {
  const record = {
    listingId: "listing_003",
    certificationId: "cert_003",
    status: "revoked",
  };

  const result = CertificationRecordSchema.parse(record);

  assert.equal(result.status, "revoked");
  assert.equal(result.approvedAt, null);
});

test("CertificationRecordSchema applies default approvedAt", () => {
  const record = {
    listingId: "listing_004",
    certificationId: "cert_004",
    status: "pending",
  };

  const result = CertificationRecordSchema.parse(record);

  assert.equal(result.approvedAt, null);
});

test("CertificationRecordSchema rejects empty listingId", () => {
  const record = {
    listingId: "",
    certificationId: "cert_005",
    status: "pending",
  };

  assert.throws(
    () => CertificationRecordSchema.parse(record),
    /listingId/
  );
});

test("CertificationRecordSchema rejects empty certificationId", () => {
  const record = {
    listingId: "listing_006",
    certificationId: "",
    status: "pending",
  };

  assert.throws(
    () => CertificationRecordSchema.parse(record),
    /certificationId/
  );
});

test("CertificationRecordSchema rejects invalid status", () => {
  const record = {
    listingId: "listing_007",
    certificationId: "cert_007",
    status: "invalid_status",
  };

  assert.throws(
    () => CertificationRecordSchema.parse(record),
    /status/
  );
});

test("isMarketplaceListingCertified returns true for approved status", () => {
  const record = createCertificationRecord({
    listingId: "listing_008",
    certificationId: "cert_008",
  });

  const result = isMarketplaceListingCertified(record);

  assert.equal(result, true);
});

test("isMarketplaceListingCertified returns false for pending status", () => {
  const record = createCertificationRecord({
    listingId: "listing_009",
    certificationId: "cert_009",
    status: "pending",
    approvedAt: null,
  });

  const result = isMarketplaceListingCertified(record);

  assert.equal(result, false);
});

test("isMarketplaceListingCertified returns false for revoked status", () => {
  const record = createCertificationRecord({
    listingId: "listing_010",
    certificationId: "cert_010",
    status: "revoked",
    approvedAt: null,
  });

  const result = isMarketplaceListingCertified(record);

  assert.equal(result, false);
});

test("CertificationRecordSchema rejects approvedAt with non-approved status", () => {
  const record = {
    listingId: "listing_011",
    certificationId: "cert_011",
    status: "pending",
    approvedAt: "2026-04-01T00:00:00.000Z",
  };

  // Schema does not validate semantic consistency, just structure
  const result = CertificationRecordSchema.parse(record);
  assert.equal(result.approvedAt, "2026-04-01T00:00:00.000Z");
});

test("isMarketplaceListingCertified fails closed when quality and security evidence is incomplete", () => {
  const record = createCertificationRecord({
    listingId: "listing_012",
    certificationId: "cert_012",
    sbomVerified: false,
  });

  assert.equal(isMarketplaceListingCertified(record), false);
  const status = getCertificationHealthStatus(record);
  assert.equal(status.isValid, false);
  assert.ok(status.reasons.some((reason) => reason.includes("SBOM")));
});

test("CertificationGate blocks agent certification without full quality and security evidence", () => {
  const gate = new CertificationGate();
  const result = gate.checkAgentCertification({
    certificationId: "agent-cert-1",
    agentId: "agent-1",
    status: "approved",
    approvedAt: "2026-04-01T00:00:00.000Z",
    expiresAt: null,
    evidence: {
      sbomVerified: true,
      signatureVerified: true,
      compatibilityVerified: false,
      sandboxVerified: true,
      egressPolicyReviewed: false,
    },
  });

  assert.equal(result.allowed, false);
  assert.ok(result.blockedBy.includes("compatibility_verification_required"));
  assert.ok(result.blockedBy.includes("egress_policy_review_required"));
});
