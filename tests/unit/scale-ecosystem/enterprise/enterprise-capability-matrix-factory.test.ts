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
  // Note: Factory tests require integration-level store setup.
  // The factory creates a real AuthoritativeTaskStore which cannot be easily mocked.
  // These tests verify the factory structure and exports exist.

  test("createEnterpriseCapabilityMatrixService is exported and callable", () => {
    assert.equal(typeof createEnterpriseCapabilityMatrixService, "function");
  });

  test("EnterpriseCapabilityMatrixService is exported and constructor is available", () => {
    assert.equal(typeof EnterpriseCapabilityMatrixService, "function");
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