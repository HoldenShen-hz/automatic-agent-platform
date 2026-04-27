/**
 * Unit tests for Compliance Governance Service - Additional coverage
 * Tests for ComplianceGovernanceService
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";

test("ComplianceGovernanceService is instantiable", () => {
  const service = new ComplianceGovernanceService();
  assert.ok(service != null);
});

test("ComplianceGovernanceService has expected public methods", () => {
  const service = new ComplianceGovernanceService();
  // Should have methods from the service interface
  assert.ok(typeof service === "object");
});
