/**
 * Tests for CrossBorderTransferComplianceService
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CrossBorderTransferComplianceService,
  type CrossBorderTransferRequest,
} from "../../../../src/scale-ecosystem/multi-region/cross-border-transfer-compliance-service.js";

test("CrossBorderTransferComplianceService: allows non-cross-border transfers within same jurisdiction", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-east-2",
    sourceJurisdiction: "us",
    targetJurisdiction: "us",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.allowed, true);
  assert.equal(assessment.jurisdictionClassifier.isCrossBorder, false);
  assert.equal(assessment.mechanismSelection.mechanism, "none_required");
});

test("CrossBorderTransferComplianceService: blocks cross-border transfer when dataResidencyPolicy is local_only", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-west-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    dataResidencyPolicy: "local_only",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.allowed, false);
  assert.equal(assessment.mechanismSelection.mechanism, "blocked");
  assert.ok(assessment.transferImpactAssessment.reasons.includes("local_only_residency_policy"));
});

test("CrossBorderTransferComplianceService: assigns high risk for cross-border transfers with PII", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.transferImpactAssessment.riskLevel, "high");
  assert.ok(assessment.transferImpactAssessment.reasons.includes("multi_region.cross_border_transfer"));
  assert.ok(assessment.transferImpactAssessment.reasons.includes("multi_region.contains_pii"));
});

test("CrossBorderTransferComplianceService: assigns medium risk for cross-border transfers without PII", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.transferImpactAssessment.riskLevel, "medium");
});

test("CrossBorderTransferComplianceService: blocks high-risk transfer without preferred mechanism", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "backup",
  };

  const assessment = service.assessTransfer(request);

  // High risk with PII but no preferred mechanism - blocked
  assert.equal(assessment.mechanismSelection.mechanism, "blocked");
});

test("CrossBorderTransferComplianceService: uses preferred mechanism when specified", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    preferredMechanism: "dpf",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.mechanismSelection.mechanism, "dpf");
});

test("CrossBorderTransferComplianceService: minimizes payload based on allowedDataFields", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    payload: {
      id: "123",
      name: "John",
      ssn: "555-55-5555",
      email: "john@example.com",
    },
    allowedDataFields: ["id", "email"],
  };

  const assessment = service.assessTransfer(request);

  assert.ok(assessment.dataMinimizer.minimizedPayload);
  assert.ok(Object.keys(assessment.dataMinimizer.minimizedPayload).includes("id"));
  assert.ok(Object.keys(assessment.dataMinimizer.minimizedPayload).includes("email"));
  assert.ok(!Object.keys(assessment.dataMinimizer.minimizedPayload).includes("ssn"));
  assert.ok(!Object.keys(assessment.dataMinimizer.minimizedPayload).includes("name"));
});

test("CrossBorderTransferComplianceService: detects high-risk identifiers in payload", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    payload: {
      id: "123",
      ssn: "555-55-5555",
    },
    allowedDataFields: ["id", "ssn"],
  };

  const assessment = service.assessTransfer(request);

  assert.ok(assessment.outputScanner.blockedFindings.includes("multi_region.high_risk_identifier_present"));
});

test("CrossBorderTransferComplianceService: detects PII without minimization", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    payload: { name: "John" },
    allowedDataFields: [],
  };

  const assessment = service.assessTransfer(request);

  assert.ok(assessment.outputScanner.blockedFindings.includes("multi_region.pii_without_minimization"));
});

test("CrossBorderTransferComplianceService: creates transfer log entry for each assessment", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-east-2",
    sourceJurisdiction: "us",
    targetJurisdiction: "us",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
  };

  service.assessTransfer(request);
  service.assessTransfer(request);

  const log = service.getTransferLog();
  assert.equal(log.length, 2);
  assert.ok(log[0]!.transferLogId.startsWith("transfer_log:"));
});

test("CrossBorderTransferComplianceService: handles regional dataResidencyPolicy (not blocked)", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
    dataResidencyPolicy: "regional",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.allowed, true);
  assert.equal(assessment.mechanismSelection.mechanism, "scc");
});

test("CrossBorderTransferComplianceService: handles global dataResidencyPolicy", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
    dataResidencyPolicy: "global",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.allowed, true);
});

test("CrossBorderTransferComplianceService: records mechanism in transfer log", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
    preferredMechanism: "bcr",
  };

  service.assessTransfer(request);
  const log = service.getTransferLog();

  assert.equal(log[0]!.mechanism, "bcr");
});

test("CrossBorderTransferComplianceService: passes when no blocked findings", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-east-2",
    sourceJurisdiction: "us",
    targetJurisdiction: "us",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
    payload: { id: "123" },
    allowedDataFields: ["id"],
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.outputScanner.passed, true);
  assert.equal(assessment.allowed, true);
});

test("CrossBorderTransferComplianceService: getTransferLog returns empty array when no assessments", () => {
  const service = new CrossBorderTransferComplianceService();
  const log = service.getTransferLog();
  assert.equal(log.length, 0);
});

test("CrossBorderTransferComplianceService: getTransferLog returns copy of transfer log", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-east-2",
    sourceJurisdiction: "us",
    targetJurisdiction: "us",
    dataCategories: ["logs"],
    containsPii: false,
    purpose: "analytics",
  };

  service.assessTransfer(request);
  const log = service.getTransferLog();

  assert.equal(log.length, 1);
  // Verify it's a copy, not the original
  assert.ok(!Object.isFrozen(log));
});

test("CrossBorderTransferComplianceService: set allowed to false when blocked", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-west-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    dataResidencyPolicy: "local_only",
  };

  const assessment = service.assessTransfer(request);

  assert.equal(assessment.allowed, false);
  assert.equal(assessment.transferLog.allowed, false);
});

test("CrossBorderTransferComplianceService: includes block reason in blocked findings", () => {
  const service = new CrossBorderTransferComplianceService();
  const request: CrossBorderTransferRequest = {
    sourceRegionId: "us-west-1",
    targetRegionId: "eu-west-1",
    sourceJurisdiction: "us",
    targetJurisdiction: "eu",
    dataCategories: ["user_data"],
    containsPii: true,
    purpose: "analytics",
    dataResidencyPolicy: "local_only",
  };

  const assessment = service.assessTransfer(request);

  assert.ok(assessment.outputScanner.blockedFindings.includes("local_only_residency_policy"));
  assert.equal(assessment.mechanismSelection.rationale, "multi_region.transfer_blocked:local_only_residency_policy");
});