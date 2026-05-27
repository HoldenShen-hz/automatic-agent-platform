import assert from "node:assert/strict";
import test from "node:test";

import {
  ComplianceProgramService,
  type ComplianceProgramInput,
} from "../../../../src/scale-ecosystem/tenant-platform/compliance-program-service.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { DataNamespaceRecord } from "../../../../src/platform/contracts/types/domain.js";

function createMockStore(overrides: Partial<{
  tenants: ReturnType<AuthoritativeTaskStore["organization"]["listTenantRecords"]>;
  workspaces: ReturnType<AuthoritativeTaskStore["organization"]["listWorkspaceRecords"]>;
  organizations: ReturnType<AuthoritativeTaskStore["organization"]["listOrganizationRecords"]>;
  namespaces: ReturnType<AuthoritativeTaskStore["organization"]["listDataNamespaces"]>;
  enterpriseReports: ReturnType<AuthoritativeTaskStore["release"]["listEnterpriseCapabilityReports"]>;
}> = {}): AuthoritativeTaskStore {
  return {
    organization: {
      listTenantRecords: () => overrides.tenants ?? [],
      listWorkspaceRecords: () => overrides.workspaces ?? [],
      listOrganizationRecords: () => overrides.organizations ?? [],
      listDataNamespaces: () => overrides.namespaces ?? [],
    } as AuthoritativeTaskStore["organization"],
    release: {
      listEnterpriseCapabilityReports: () => overrides.enterpriseReports ?? [],
    } as AuthoritativeTaskStore["release"],
  } as unknown as AuthoritativeTaskStore;
}

test("ComplianceProgramService.buildReport returns empty report when no data [compliance-program-service]", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.tenantCount, 0);
  assert.equal(report.workspaceCount, 0);
  assert.equal(report.organizationCount, 0);
  assert.equal(report.namespaceCount, 0);
  assert.deepEqual(report.residencySummary, []);
  assert.equal(report.auditExportReady, false);
  assert.ok(report.reportId.startsWith("compliance_program_"));
});

test("ComplianceProgramService.buildReport counts entities correctly [compliance-program-service]", () => {
  const store = createMockStore({
    tenants: [{ tenantId: "tenant-1" }, { tenantId: "tenant-2" }] as AuthoritativeTaskStore["organization"]["listTenantRecords"] extends (...args: unknown[]) => infer R ? R : never,
    workspaces: [{ workspaceId: "ws-1" }, { workspaceId: "ws-2" }, { workspaceId: "ws-3" }] as AuthoritativeTaskStore["organization"]["listWorkspaceRecords"] extends (...args: unknown[]) => infer R ? R : never,
    organizations: [{ organizationId: "org-1" }] as AuthoritativeTaskStore["organization"]["listOrganizationRecords"] extends (...args: unknown[]) => infer R ? R : never,
    namespaces: [] as DataNamespaceRecord[],
  });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.tenantCount, 2);
  assert.equal(report.workspaceCount, 3);
  assert.equal(report.organizationCount, 1);
  assert.equal(report.namespaceCount, 0);
});

test("ComplianceProgramService.buildReport groups namespaces by residency policy [compliance-program-service]", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns-1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "us-east" },
    { namespaceId: "ns-2", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "artifact", residencyPolicy: "us-east" },
    { namespaceId: "ns-3", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "analytics", residencyPolicy: "eu-west" },
    { namespaceId: "ns-4", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "replay", residencyPolicy: null as unknown as string },
  ] as DataNamespaceRecord[];

  const store = createMockStore({ namespaces });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.namespaceCount, 4);
  assert.equal(report.residencySummary.length, 3); // us-east, eu-west, unspecified

  const usEast = report.residencySummary.find((s) => s.residencyPolicy === "us-east");
  assert.ok(usEast);
  assert.equal(usEast.namespaceCount, 2);

  const euWest = report.residencySummary.find((s) => s.residencyPolicy === "eu-west");
  assert.ok(euWest);
  assert.equal(euWest.namespaceCount, 1);

  const unspecified = report.residencySummary.find((s) => s.residencyPolicy === "unspecified");
  assert.ok(unspecified);
  assert.equal(unspecified.namespaceCount, 1);
});

test("ComplianceProgramService.buildReport sets auditExportReady based on reports and namespaces [compliance-program-service]", () => {
  const storeWithoutReports = createMockStore({ namespaces: [] as DataNamespaceRecord[] });
  const service1 = new ComplianceProgramService(storeWithoutReports);
  const report1 = service1.buildReport();
  assert.equal(report1.auditExportReady, false);

  const storeWithReports = createMockStore({
    namespaces: [] as DataNamespaceRecord[],
    enterpriseReports: [{ reportId: "report-1" }],
  });
  const service2 = new ComplianceProgramService(storeWithReports);
  const report2 = service2.buildReport();
  assert.equal(report2.auditExportReady, true);

  const storeWithNamespaces = createMockStore({
    namespaces: [{ namespaceId: "ns-1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "us-east" }] as DataNamespaceRecord[],
  });
  const service3 = new ComplianceProgramService(storeWithNamespaces);
  const report3 = service3.buildReport();
  assert.equal(report3.auditExportReady, true);
});

test("ComplianceProgramService.buildReport includes compliance controls [compliance-program-service]", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.ok(report.complianceControls.length > 0);
  assert.ok(report.complianceControls.some((c) => c.includes("Audit export")));
  assert.ok(report.complianceControls.some((c) => c.includes("Residency policy")));
});

test("ComplianceProgramService.buildReport uses custom generatedAt when provided [compliance-program-service]", () => {
  const store = createMockStore();
  const service = new ComplianceProgramService(store);
  const customTime = "2024-01-15T10:00:00.000Z";
  const input: ComplianceProgramInput = { generatedAt: customTime };

  const report = service.buildReport(input);

  assert.equal(report.generatedAt, customTime);
});

test("ComplianceProgramService.buildReport sorts residency summary alphabetically [compliance-program-service]", () => {
  const namespaces: DataNamespaceRecord[] = [
    { namespaceId: "ns-1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "transactional", residencyPolicy: "zulu" },
    { namespaceId: "ns-2", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "artifact", residencyPolicy: "alpha" },
    { namespaceId: "ns-3", tenantId: "t1", organizationId: "o1", workspaceId: "w1", plane: "analytics", residencyPolicy: "mike" },
  ] as DataNamespaceRecord[];

  const store = createMockStore({ namespaces });
  const service = new ComplianceProgramService(store);

  const report = service.buildReport();

  assert.equal(report.residencySummary[0].residencyPolicy, "alpha");
  assert.equal(report.residencySummary[1].residencyPolicy, "mike");
  assert.equal(report.residencySummary[2].residencyPolicy, "zulu");
});
