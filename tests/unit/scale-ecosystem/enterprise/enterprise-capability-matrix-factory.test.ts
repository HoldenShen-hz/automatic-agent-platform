/**
 * Unit tests for createEnterpriseCapabilityMatrixService factory and related exports
 *
 * @see src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.ts
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach, afterEach } from "node:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  EnterpriseCapabilityMatrixService,
  createEnterpriseCapabilityMatrixService,
  DEFAULT_ENTERPRISE_CAPABILITIES,
  type LicenseTier,
  type EnterpriseCapabilityDefinition,
} from "../../../../src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";

describe("createEnterpriseCapabilityMatrixService factory", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    tempDirs.length = 0;
  });

  test("factory creates service with default options", () => {
    const dbPath = join(tmpdir(), `test-enterprise-${Date.now()}-${Math.random()}.db`);
    tempDirs.push(dbPath);

    const service = createEnterpriseCapabilityMatrixService(dbPath);

    assert.ok(service instanceof EnterpriseCapabilityMatrixService);
  });

  test("factory creates service with custom artifact root", () => {
    const dbPath = join(tmpdir(), `test-enterprise-${Date.now()}-${Math.random()}.db`);
    const artifactRoot = join(tmpdir(), `test-artifacts-${Date.now()}-${Math.random()}`);
    tempDirs.push(dbPath);
    tempDirs.push(artifactRoot);

    const service = createEnterpriseCapabilityMatrixService(dbPath, {
      artifactRoot,
    });

    assert.ok(service instanceof EnterpriseCapabilityMatrixService);
  });

  test("factory creates service with custom capability definitions", () => {
    const dbPath = join(tmpdir(), `test-enterprise-${Date.now()}-${Math.random()}.db`);
    tempDirs.push(dbPath);

    const customCapabilities: readonly EnterpriseCapabilityDefinition[] = [
      {
        capabilityKey: "admin_console",
        displayName: "Custom Feature",
        requiredTier: "professional",
        supportedDeploymentModes: ["cloud_shared"],
        readinessRequirements: [],
      },
    ];

    const service = createEnterpriseCapabilityMatrixService(dbPath, {
      capabilityDefinitions: customCapabilities,
    });

    assert.ok(service instanceof EnterpriseCapabilityMatrixService);
  });

  test("factory service can register readiness and build matrix", () => {
    const dbPath = join(tmpdir(), `test-enterprise-${Date.now()}-${Math.random()}.db`);
    tempDirs.push(dbPath);

    const service = createEnterpriseCapabilityMatrixService(dbPath);

    const record = service.registerEnvironmentReadiness({
      environment: "production",
      componentType: "gateway",
      componentId: "ops_gateway",
      credentialReady: true,
      owner: "test_team",
    });

    assert.ok(record.readinessId);
    assert.equal(record.environment, "production");
    assert.equal(record.componentType, "gateway");
    assert.equal(record.componentId, "ops_gateway");
    assert.equal(record.credentialReady, 1);
  });

  test("factory service can export matrix with artifacts", () => {
    const dbPath = join(tmpdir(), `test-enterprise-${Date.now()}-${Math.random()}.db`);
    const artifactRoot = join(tmpdir(), `test-artifacts-${Date.now()}-${Math.random()}`);
    tempDirs.push(dbPath);
    tempDirs.push(artifactRoot);

    const service = createEnterpriseCapabilityMatrixService(dbPath, {
      artifactRoot,
    });

    const result = service.exportMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.ok(result.report);
    assert.ok(result.jsonArtifact);
    assert.ok(result.markdownArtifact);
    assert.equal(result.jsonArtifact.kind, "enterprise_capability_report");
    assert.equal(result.markdownArtifact.kind, "enterprise_capability_report_markdown");
  });

  test("factory service listEnvironmentReadiness and listReports work", () => {
    const dbPath = join(tmpdir(), `test-enterprise-${Date.now()}-${Math.random()}.db`);
    tempDirs.push(dbPath);

    const service = createEnterpriseCapabilityMatrixService(dbPath);

    service.registerEnvironmentReadiness({
      environment: "staging",
      componentType: "gateway",
      componentId: "test_gateway",
      credentialReady: true,
      owner: "team",
    });

    const readinessRecords = service.listEnvironmentReadiness("staging");
    assert.ok(Array.isArray(readinessRecords));

    const reports = service.listReports(10);
    assert.ok(Array.isArray(reports));
  });
});

describe("DEFAULT_ENTERPRISE_CAPABILITIES validation", () => {
  test("all capability keys are unique", () => {
    const keys = DEFAULT_ENTERPRISE_CAPABILITIES.map((c) => c.capabilityKey);
    const uniqueKeys = new Set(keys);
    assert.equal(keys.length, uniqueKeys.size, "Duplicate capability keys found");
  });

  test("all capabilities have valid tier levels", () => {
    const validTiers: LicenseTier[] = ["community", "professional", "enterprise"];
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(
        validTiers.includes(cap.requiredTier),
        `Invalid tier ${cap.requiredTier} for ${cap.capabilityKey}`
      );
    }
  });

  test("all capabilities have non-empty display names", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(cap.displayName.length > 0, `Empty displayName for ${cap.capabilityKey}`);
    }
  });

  test("all capabilities have at least one supported deployment mode", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(
        cap.supportedDeploymentModes.length > 0,
        `No deployment modes for ${cap.capabilityKey}`
      );
    }
  });

  test("readiness requirements have valid component types", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      for (const req of cap.readinessRequirements) {
        assert.ok(req.componentType.length > 0, `Empty componentType for ${cap.capabilityKey}`);
        assert.ok(req.componentId.length > 0, `Empty componentId for ${cap.capabilityKey}`);
      }
    }
  });

  test("capability keys match expected set", () => {
    const expectedKeys = [
      "admin_console",
      "audit_export",
      "sso",
      "scim",
      "tenant_isolation",
      "private_model",
      "private_network_deployment",
      "rollout_and_rollback",
      "incident_console",
      "data_residency_controls",
    ];

    const actualKeys = DEFAULT_ENTERPRISE_CAPABILITIES.map((c) => c.capabilityKey).sort();
    const expectedSorted = [...expectedKeys].sort();

    assert.deepEqual(actualKeys, expectedSorted);
  });
});

describe("EnterpriseCapabilityMatrixService with mocked store", () => {
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

  test("service can be instantiated with custom capability definitions", () => {
    const customCapabilities: readonly EnterpriseCapabilityDefinition[] = [
      {
        capabilityKey: "admin_console",
        displayName: "Test Feature",
        requiredTier: "enterprise",
        supportedDeploymentModes: ["cloud_shared"],
        readinessRequirements: [],
      },
    ];

    const service = new EnterpriseCapabilityMatrixService(
      createMockDb() as any,
      createMockStore() as any,
      { capabilityDefinitions: customCapabilities }
    );

    const result = service.buildMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    // Should have exactly 1 entry (our custom one)
    assert.equal(result.report.entries.length, 1);
    assert.equal(result.report.entries[0]!.capabilityKey, "admin_console");
  });

  test("report includes all scope fields (accountId, workspaceId, tenantId)", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({
      accountId: "acct_123",
      workspaceId: "ws_456",
      planId: "enterprise",
    } as any);

    const service = new EnterpriseCapabilityMatrixService(
      createMockDb() as any,
      mockStore as any
    );

    const result = service.buildMatrix({
      accountId: "acct_123",
      workspaceId: "ws_456",
      tenantId: "tenant_789",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.accountId, "acct_123");
    assert.equal(result.report.workspaceId, "ws_456");
    assert.equal(result.report.tenantId, "tenant_789");
  });

  test("report generatedAt is set from input or defaults to now", () => {
    const service = new EnterpriseCapabilityMatrixService(
      createMockDb() as any,
      createMockStore() as any
    );

    const customTime = "2026-01-15T10:30:00.000Z";
    const result = service.buildMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
      generatedAt: customTime,
    });

    assert.equal(result.report.generatedAt, customTime);
  });

  test("record is persisted when building matrix", () => {
    const mockStore = createMockStore();
    let insertCount = 0;
    mockStore.release.insertEnterpriseCapabilityReport = () => {
      insertCount++;
    };

    const service = new EnterpriseCapabilityMatrixService(
      createMockDb() as any,
      mockStore as any
    );

    service.buildMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(insertCount, 1);
  });

  test("buildMatrix throws when accountId provided but account not found", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => null;

    const service = new EnterpriseCapabilityMatrixService(
      createMockDb() as any,
      mockStore as any
    );

    assert.throws(
      () => {
        service.buildMatrix({
          accountId: "nonexistent_account",
          environment: "production",
          deploymentMode: "cloud_shared",
        });
      },
      /enterprise\.billing_account_not_found/
    );
  });

  test("environment readiness record persistence", () => {
    const mockStore = createMockStore();
    let upsertCount = 0;
    mockStore.release.upsertEnvironmentReadinessRecord = () => {
      upsertCount++;
    };

    const service = new EnterpriseCapabilityMatrixService(
      createMockDb() as any,
      mockStore as any
    );

    service.registerEnvironmentReadiness({
      environment: "production",
      componentType: "gateway",
      componentId: "ops_gateway",
      credentialReady: true,
      owner: "team",
    });

    assert.equal(upsertCount, 1);
  });
});