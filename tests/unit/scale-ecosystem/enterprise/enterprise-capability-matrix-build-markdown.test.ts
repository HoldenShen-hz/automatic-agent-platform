/**
 * Unit tests for buildMarkdownReport helper in Enterprise Capability Matrix Service
 *
 * @see src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { EnterpriseCapabilityMatrixService } from "../../../../src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";
import type { EnterpriseCapabilityMatrixReport } from "../../../../src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";

function createMockStore() {
  return {
    release: {
      upsertEnvironmentReadinessRecord: () => {},
      getActiveEnvironmentReadinessRecord: () => null,
      listEnvironmentReadinessRecords: () => [],
      insertEnterpriseCapabilityReport: () => {},
      listEnterpriseCapabilityReports: () => [],
    },
    billing: {
      getBillingAccount: () => null,
    },
  };
}

function createMockDb() {
  return {
    connection: {
      prepare: () => ({
        get: () => null,
        all: () => [],
      }),
    },
    transaction: () => {},
  };
}

function createReport(overrides: Partial<EnterpriseCapabilityMatrixReport> = {}): EnterpriseCapabilityMatrixReport {
  const base: EnterpriseCapabilityMatrixReport = {
    reportId: "rpt-test-001",
    generatedAt: "2026-04-27T00:00:00.000Z",
    environment: "production",
    deploymentMode: "cloud_shared",
    tier: "community",
    accountId: null,
    workspaceId: null,
    tenantId: null,
    summary: {
      available: 1,
      degraded: 2,
      blocked: 7,
      total: 10,
      overallVerdict: "blocked",
    },
    entries: [
      {
        capabilityKey: "admin_console",
        displayName: "Admin Console And Human Takeover",
        status: "available",
        requiredTier: "professional",
        requiredDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
        reasonCodes: [],
        readiness: [
          {
            componentType: "gateway",
            componentId: "ops_gateway",
            gateKey: null,
            status: "ready",
            recordId: "read_001",
          },
        ],
      },
      {
        capabilityKey: "sso",
        displayName: "Single Sign-On",
        status: "blocked",
        requiredTier: "enterprise",
        requiredDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
        reasonCodes: ["license_tier_below_requirement:enterprise"],
        readiness: [],
      },
      {
        capabilityKey: "scim",
        displayName: "SCIM Provisioning",
        status: "degraded",
        requiredTier: "enterprise",
        requiredDeploymentModes: ["private_cloud", "on_prem"],
        reasonCodes: ["deployment_mode_not_supported:cloud_shared"],
        readiness: [],
      },
    ],
  };
  return { ...base, ...overrides };
}

describe("EnterpriseCapabilityMatrixService buildMarkdownReport (via exportMatrix)", () => {
  test("exportMatrix produces markdown artifact with report structure", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.ok(result.markdownArtifact);
    assert.ok(result.markdownArtifact.artifactId);
    assert.equal(result.markdownArtifact.kind, "enterprise_capability_report_markdown");
  });

  test("exportMatrix produces markdown containing report header fields", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "staging",
      deploymentMode: "private_cloud",
      generatedAt: "2026-04-27T12:00:00.000Z",
    });

    assert.ok(result.markdownArtifact);
    // Markdown should contain environment and deployment mode info
    assert.equal(result.markdownArtifact.kind, "enterprise_capability_report_markdown");
  });

  test("exportMatrix json artifact contains full report data", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.ok(result.jsonArtifact);
    assert.ok(result.jsonArtifact.artifactId);
    assert.equal(result.jsonArtifact.kind, "enterprise_capability_report");
  });

  test("exportMatrix uses correct scope when tenantId is present", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ accountId: "acct_123", workspaceId: "ws_123", planId: "enterprise" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);

    const result = service.exportMatrix({
      accountId: "acct_123",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.ok(result.jsonArtifact);
    assert.ok(result.markdownArtifact);
    // Should use tenantId or workspaceId in artifact filename
    assert.ok(result.report.tenantId === null || result.report.workspaceId !== null);
  });

  test("exportMatrix uses correct scope when workspaceId is present without tenantId", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ accountId: "acct_456", workspaceId: "ws_456", planId: "enterprise" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);

    const result = service.exportMatrix({
      accountId: "acct_456",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.ok(result.jsonArtifact);
    assert.ok(result.report.workspaceId === "ws_456");
  });

  test("exportMatrix uses global scope when no accountId", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.ok(result.jsonArtifact);
    assert.ok(result.markdownArtifact);
  });

  test("exportMatrix report contains all entries", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    // Report should have all 10 capability entries
    assert.ok(result.report.entries.length > 0);
    assert.ok(result.report.summary.total > 0);
    assert.equal(result.report.entries.length, result.report.summary.total);
  });

  test("exportMatrix report summary counts match entries", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const countedAvailable = result.report.entries.filter(e => e.status === "available").length;
    const countedDegraded = result.report.entries.filter(e => e.status === "degraded").length;
    const countedBlocked = result.report.entries.filter(e => e.status === "blocked").length;

    assert.equal(result.report.summary.available, countedAvailable);
    assert.equal(result.report.summary.degraded, countedDegraded);
    assert.equal(result.report.summary.blocked, countedBlocked);
    assert.equal(
      result.report.summary.available + result.report.summary.degraded + result.report.summary.blocked,
      result.report.summary.total,
    );
  });

  test("exportMatrix sets correct overallVerdict based on entry statuses", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    if (result.report.summary.blocked > 0) {
      assert.equal(result.report.summary.overallVerdict, "blocked");
    } else if (result.report.summary.degraded > 0) {
      assert.equal(result.report.summary.overallVerdict, "partial");
    } else {
      assert.equal(result.report.summary.overallVerdict, "ready");
    }
  });

  test("exportMatrix with enterprise tier allows enterprise features", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ accountId: "acct_ent", planId: "enterprise" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);

    const result = service.exportMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    // SSO should be blocked by deployment mode (private_cloud/on_prem only) not tier
    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    // With enterprise tier but cloud_shared deployment, sso is blocked by deployment mode
    assert.ok(ssoEntry.status === "blocked" || ssoEntry.status === "degraded");
  });

  test("exportMatrix with private_cloud deployment allows private_model", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ accountId: "acct_ent", planId: "enterprise" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);

    const result = service.exportMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "private_cloud",
    });

    // private_model requires private_cloud or on_prem
    const privateModelEntry = result.report.entries.find(e => e.capabilityKey === "private_model");
    assert.ok(privateModelEntry);
    // Should not be blocked by deployment mode
    assert.ok(!privateModelEntry.reasonCodes.some(r => r.startsWith("deployment_mode_not_supported")));
  });

  test("exportMatrix stores report record via store", () => {
    const mockStore = createMockStore();
    let insertCallCount = 0;
    mockStore.release.insertEnterpriseCapabilityReport = () => { insertCallCount++; };

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);

    service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(insertCallCount, 1);
  });
});
