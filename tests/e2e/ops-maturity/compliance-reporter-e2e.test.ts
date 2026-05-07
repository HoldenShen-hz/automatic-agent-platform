/**
 * E2E Compliance Reporter Tests
 *
 * End-to-end tests covering compliance reporting:
 * 1. Report generation
 * 2. Compliance checks
 * 3. Audit export
 * 4. Policy violation detection
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { ComplianceReporterService } from "../../../src/ops-maturity/compliance-reporter/compliance-reporter-service.js";
import type { ComplianceReport, PolicyCheck, ViolationRecord } from "../../../src/ops-maturity/compliance-reporter/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createPolicyCheck(overrides: Partial<PolicyCheck> = {}): PolicyCheck {
  return {
    policyId: overrides.policyId ?? "policy_data_isolation",
    policyName: overrides.policyName ?? "Data Isolation Policy",
    description: overrides.description ?? "Ensure tenant data is isolated",
    applicableRules: overrides.applicableRules ?? ["tenant_boundary", "data_classification"],
    checkedAt: overrides.checkedAt ?? new Date().toISOString(),
    passed: overrides.passed ?? true,
    details: overrides.details ?? {},
    ...overrides,
  };
}

function createViolationRecord(overrides: Partial<ViolationRecord> = {}): ViolationRecord {
  return {
    violationId: overrides.violationId ?? "violation_e2e_001",
    policyId: overrides.policyId ?? "policy_data_isolation",
    severity: overrides.severity ?? "high",
    entityType: overrides.entityType ?? "task",
    entityId: overrides.entityId ?? "task_e2e_001",
    description: overrides.description ?? "Tenant boundary breach detected",
    detectedAt: overrides.detectedAt ?? new Date().toISOString(),
    remediatedAt: overrides.remediatedAt ?? null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Compliance Report Generation
// ---------------------------------------------------------------------------

test("E2E Compliance: ComplianceReporterService generates periodic reports", async () => {
  const harness = createE2EHarness("aa-e2e-compliance-");
  try {
    const service = new ComplianceReporterService();

    const report = await service.generateReport({
      tenantId: "tenant_e2e",
      periodStart: "2026-05-01T00:00:00Z",
      periodEnd: "2026-05-02T00:00:00Z",
    });

    assert.ok(report, "Should return compliance report");
    assert.ok(report.summary, "Should have summary");
    assert.ok(report.passedChecks >= 0, "Should have passed checks count");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Policy Violation Detection
// ---------------------------------------------------------------------------

test("E2E Compliance: Service detects and records policy violations", async () => {
  const harness = createE2EHarness("aa-e2e-violation-");
  try {
    const service = new ComplianceReporterService();

    const violation = createViolationRecord({
      severity: "critical",
      description: "Unauthorized data access attempt",
    });

    service.recordViolation(violation);

    const activeViolations = service.getActiveViolations("tenant_e2e");
    assert.ok(activeViolations.length > 0, "Should have recorded violation");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Compliance Check Execution
// ---------------------------------------------------------------------------

test("E2E Compliance: Service executes policy checks against entities", async () => {
  const harness = createE2EHarness("aa-e2e-policy-check-");
  try {
    const service = new ComplianceReporterService();

    const check = createPolicyCheck({
      policyId: "policy_tenant_isolation",
      passed: true,
    });

    const result = await service.executeCheck("tenant_e2e", check);

    assert.ok(result, "Should return check result");
    assert.ok(typeof result.passed === "boolean", "Should have passed flag");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Audit Export
// ---------------------------------------------------------------------------

test("E2E Compliance: Service exports audit trail for external review", async () => {
  const harness = createE2EHarness("aa-e2e-audit-export-");
  try {
    const service = new ComplianceReporterService();

    // Add some records
    const violation = createViolationRecord({ policyId: "policy_001" });
    service.recordViolation(violation);

    const exported = await service.exportAuditTrail({
      tenantId: "tenant_e2e",
      format: "json",
    });

    assert.ok(exported, "Should return exported data");
    assert.ok(exported.content, "Should have content");
  } finally {
    harness.cleanup();
  }
});
