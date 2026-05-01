// @ts-nocheck
/**
 * Unit tests for ComplianceProgramService
 *
 * @see src/scale-ecosystem/tenant-platform/compliance-program-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceProgramService } from "../../../../src/scale-ecosystem/tenant-platform/compliance-program-service.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { DataNamespaceRecord } from "../../../../src/platform/contracts/types/domain.js";

function createMockStore(overrides = {}) {
  const defaults = {
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => [],
    },
    release: {
      listEnterpriseCapabilityReports: () => [],
    },
  };
  return { ...defaults, ...overrides } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

test("ComplianceProgramService can be instantiated with a store", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);
  assert.ok(service instanceof ComplianceProgramService);
});

test("ComplianceProgramService accepts optional service options", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store, { artifactStoreOptions: { storageDir: "/tmp/artifacts" } });
  assert.ok(service instanceof ComplianceProgramService);
});

// ---------------------------------------------------------------------------
// buildReport - happy path
// ---------------------------------------------------------------------------

test("buildReport returns empty report when no data exists", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.ok(report.reportId.startsWith("compliance_program_"));
  assert.ok(report.generatedAt);
  assert.equal(report.tenantCount, 0);
  assert.equal(report.workspaceCount, 0);
  assert.equal(report.organizationCount, 0);
  assert.equal(report.namespaceCount, 0);
  assert.deepEqual(report.residencySummary, []);
  assert.equal(report.auditExportReady, false);
  assert.equal(report.complianceControls.length, 3);
});

test("buildReport counts tenants, workspaces, organizations, namespaces correctly", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [{ tenantId: "tenant_1" }, { tenantId: "tenant_2" }],
      listWorkspaceRecords: () => [{ workspaceId: "ws_1" }, { workspaceId: "ws_2" }, { workspaceId: "ws_3" }],
      listOrganizationRecords: () => [{ organizationId: "org_1" }],
      listDataNamespaces: () => [],
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.tenantCount, 2);
  assert.equal(report.workspaceCount, 3);
  assert.equal(report.organizationCount, 1);
  assert.equal(report.namespaceCount, 0);
});

test("buildReport groups namespaces by residency policy", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "us-east" },
    { namespaceId: "ns_2", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "artifact", residencyPolicy: "us-east" },
    { namespaceId: "ns_3", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "analytics", residencyPolicy: "eu-west" },
  ];
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => namespaces,
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.namespaceCount, 3);
  assert.equal(report.residencySummary.length, 2);
  const usEast = report.residencySummary.find((s) => s.residencyPolicy === "us-east");
  assert.ok(usEast);
  assert.equal(usEast.namespaceCount, 2);
  const euWest = report.residencySummary.find((s) => s.residencyPolicy === "eu-west");
  assert.ok(euWest);
  assert.equal(euWest.namespaceCount, 1);
});

test("buildReport groups namespaces with null residencyPolicy as unspecified", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: null },
    { namespaceId: "ns_2", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "artifact", residencyPolicy: "us-east" },
  ];
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => namespaces,
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.namespaceCount, 2);
  assert.equal(report.residencySummary.length, 2);
  const unspecified = report.residencySummary.find((s) => s.residencyPolicy === "unspecified");
  assert.ok(unspecified);
  assert.equal(unspecified.namespaceCount, 1);
});

test("buildReport sorts residency summary alphabetically", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "zulu" },
    { namespaceId: "ns_2", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "artifact", residencyPolicy: "alpha" },
    { namespaceId: "ns_3", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "analytics", residencyPolicy: "mike" },
  ];
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => namespaces,
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.residencySummary[0].residencyPolicy, "alpha");
  assert.equal(report.residencySummary[1].residencyPolicy, "mike");
  assert.equal(report.residencySummary[2].residencyPolicy, "zulu");
});

test("buildReport sets auditExportReady true when enterprise reports exist", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => [],
    },
    release: {
      listEnterpriseCapabilityReports: () => [{ reportId: "report_1" }],
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.auditExportReady, true);
});

test("buildReport sets auditExportReady true when namespaces exist (even without reports)", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "us-east" },
  ];
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => namespaces,
    },
    release: {
      listEnterpriseCapabilityReports: () => [],
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.auditExportReady, true);
});

test("buildReport uses custom generatedAt when provided", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);
  const customTime = "2024-01-15T10:00:00.000Z";

  const report = service.buildReport({ generatedAt: customTime });

  assert.equal(report.generatedAt, customTime);
});

test("buildReport includes compliance controls", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.complianceControls.length, 3);
  assert.ok(report.complianceControls.some((c) => c.includes("Audit export")));
  assert.ok(report.complianceControls.some((c) => c.includes("Residency policy")));
  assert.ok(report.complianceControls.some((c) => c.includes("Enterprise capability")));
});

// ---------------------------------------------------------------------------
// buildReport - error cases
// ---------------------------------------------------------------------------

test("buildReport handles empty tenant list gracefully", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => [],
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.tenantCount, 0);
  assert.equal(report.workspaceCount, 0);
});

test("buildReport handles workspaces with no organization gracefully", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [{ workspaceId: "ws_orphan" }],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => [],
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.workspaceCount, 1);
  assert.equal(report.organizationCount, 0);
});

test("buildReport handles all namespaces with undefined residency gracefully", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: undefined as unknown as string },
    { namespaceId: "ns_2", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "artifact", residencyPolicy: undefined as unknown as string },
  ];
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => namespaces,
    },
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.namespaceCount, 2);
  assert.equal(report.residencySummary.length, 1);
  const unspecified = report.residencySummary.find((s) => s.residencyPolicy === "unspecified");
  assert.ok(unspecified);
  assert.equal(unspecified.namespaceCount, 2);
});

// ---------------------------------------------------------------------------
// exportReport
// ---------------------------------------------------------------------------

test("exportReport returns report plus artifact references", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);

  const result = service.exportReport();

  assert.ok(result.report);
  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.equal(result.jsonArtifact.kind, "compliance_program");
  assert.equal(result.markdownArtifact.kind, "compliance_program_markdown");
});

test("exportReport json artifact contains valid report content", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [{ tenantId: "tenant_export" }],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => [],
    },
  });
  const service = new ComplianceProgramService(store);

  const result = service.exportReport();

  assert.equal(result.report.tenantCount, 1);
  assert.ok(result.report.reportId);
  assert.equal(result.report.complianceControls.length, 3);
});

test("exportReport markdown artifact uses correct mimeType", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);

  const result = service.exportReport();

  assert.equal(result.markdownArtifact.mimeType, "text/markdown");
});

test("exportReport passes through custom generatedAt to the report", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);
  const customTime = "2025-03-20T08:00:00.000Z";

  const result = service.exportReport({ generatedAt: customTime });

  assert.equal(result.report.generatedAt, customTime);
});

test("exportReport includes residency summary in exported report", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns_export", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "ap-southeast-1" },
  ];
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [],
      listWorkspaceRecords: () => [],
      listOrganizationRecords: () => [],
      listDataNamespaces: () => namespaces,
    },
  });
  const service = new ComplianceProgramService(store);

  const result = service.exportReport();

  assert.equal(result.report.namespaceCount, 1);
  assert.ok(result.report.residencySummary.length > 0);
});