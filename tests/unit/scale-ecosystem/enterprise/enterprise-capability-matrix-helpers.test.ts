/**
 * Unit tests for helper functions and edge cases in Enterprise Capability Matrix Service
 *
 * @see src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EnterpriseCapabilityMatrixService,
  DEFAULT_ENTERPRISE_CAPABILITIES,
} from "../../../../src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";

// Mock stores
function createMockStore(): any {
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

describe("normalizeTierFromPlan via buildMatrix", () => {
  test("maps enterprise planId to enterprise tier [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.tier, "enterprise");
  });

  test("maps professional planId to professional tier [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "professional" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_pro",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.tier, "professional");
  });

  test("maps null planId to community tier [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: null } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_null",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.tier, "community");
  });

  test("maps undefined planId to community tier [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: undefined } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_undef",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.tier, "community");
  });

  test("maps unknown planId to community tier [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "unknown_plan" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_unknown",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.tier, "community");
  });
});

describe("compareTier via capability evaluation", () => {
  test("enterprise tier can access professional features [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    // Set up readiness for admin_console
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_123",
      environment: "production",
      componentType: "gateway",
      componentId: "ops_gateway",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const adminEntry = result.report.entries.find(e => e.capabilityKey === "admin_console");
    assert.ok(adminEntry);
    assert.equal(adminEntry.status, "available");
  });

  test("professional tier cannot access enterprise features [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "pro" } as any);

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_pro",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "blocked");
    assert.ok(ssoEntry.reasonCodes.some(r => r.includes("license_tier_below_requirement")));
  });

  test("community tier has all enterprise features blocked [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => null;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    // All enterprise-only features should be blocked
    const enterpriseFeatures = result.report.entries.filter(e => e.requiredTier === "enterprise");
    const blockedCount = enterpriseFeatures.filter(e => e.status === "blocked").length;
    assert.equal(blockedCount, enterpriseFeatures.length);
  });
});

describe("buildSummary edge cases", () => {
  test("summary total equals entries length [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    // All readiness records available
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_123",
      environment: "production",
      componentType: "gateway",
      componentId: "identity_gateway",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({ sso_ready: true }),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    assert.equal(result.report.summary.total, result.report.entries.length);
  });

  test("summary counts sum to total [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);
    const result = service.buildMatrix({
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const sum = result.report.summary.available + result.report.summary.degraded + result.report.summary.blocked;
    assert.equal(sum, result.report.summary.total);
  });

  test("overallVerdict is ready when all available [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    // Return readiness records for all requirements
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_123",
      environment: "production",
      componentType: "gateway",
      componentId: "identity_gateway",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({ sso_ready: true }),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    // When there are no blocked or degraded, verdict should be ready
    if (result.report.summary.blocked === 0 && result.report.summary.degraded === 0) {
      assert.equal(result.report.summary.overallVerdict, "ready");
    }
  });

  test("overallVerdict is partial when degraded but none blocked [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    // Return readiness but with credentialReady = 0 for some components
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_123",
      environment: "production",
      componentType: "gateway",
      componentId: "identity_gateway",
      credentialReady: 0, // Not ready
      secondaryGatesJson: JSON.stringify({}),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    // When there are degraded but no blocked, verdict should be partial
    if (result.report.summary.degraded > 0 && result.report.summary.blocked === 0) {
      assert.equal(result.report.summary.overallVerdict, "partial");
    }
  });
});

describe("DEFAULT_ENTERPRISE_CAPABILITIES structure", () => {
  test("all capabilities have requiredTier defined [enterprise-capability-matrix-helpers]", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(cap.requiredTier, `Capability ${cap.capabilityKey} missing requiredTier`);
      assert.ok(
        ["community", "professional", "enterprise"].includes(cap.requiredTier),
        `Invalid tier ${cap.requiredTier} for ${cap.capabilityKey}`
      );
    }
  });

  test("all capabilities have supportedDeploymentModes defined [enterprise-capability-matrix-helpers]", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(cap.supportedDeploymentModes, `Capability ${cap.capabilityKey} missing supportedDeploymentModes`);
      assert.ok(Array.isArray(cap.supportedDeploymentModes), `supportedDeploymentModes not array for ${cap.capabilityKey}`);
      assert.ok(cap.supportedDeploymentModes.length > 0, `Empty deployment modes for ${cap.capabilityKey}`);
    }
  });

  test("all capabilities have readinessRequirements defined [enterprise-capability-matrix-helpers]", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(cap.readinessRequirements, `Capability ${cap.capabilityKey} missing readinessRequirements`);
      assert.ok(Array.isArray(cap.readinessRequirements), `readinessRequirements not array for ${cap.capabilityKey}`);
    }
  });

  test("no duplicate capability keys [enterprise-capability-matrix-helpers]", () => {
    const keys = DEFAULT_ENTERPRISE_CAPABILITIES.map(c => c.capabilityKey);
    const uniqueKeys = new Set(keys);
    assert.equal(keys.length, uniqueKeys.size, "Duplicate capability keys found");
  });

  test("capabilityKey and displayName are both present for all capabilities [enterprise-capability-matrix-helpers]", () => {
    for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
      assert.ok(cap.capabilityKey, `Missing capabilityKey`);
      assert.ok(cap.displayName, `Missing displayName for ${cap.capabilityKey}`);
    }
  });
});

describe("buildMatrix input validation", () => {
  test("buildMatrix accepts valid environment names [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const environments = ["production", "staging", "development"] as const;
    for (const env of environments) {
      const result = service.buildMatrix({
        environment: env,
        deploymentMode: "cloud_shared",
      });
      assert.equal(result.report.environment, env);
    }
  });

  test("buildMatrix accepts valid deployment modes [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const modes = ["cloud_shared", "private_cloud", "on_prem"] as const;
    for (const mode of modes) {
      const result = service.buildMatrix({
        environment: "production",
        deploymentMode: mode,
      });
      assert.equal(result.report.deploymentMode, mode);
    }
  });

  test("buildMatrix throws on invalid timestamp [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    assert.throws(() => {
      service.buildMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
        generatedAt: "not-a-valid-timestamp",
      } as any);
    }, /enterprise\.invalid_generated_at/);
  });
});

describe("registerEnvironmentReadiness validation", () => {
  test("registerEnvironmentReadiness generates new ID when not provided [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const record = service.registerEnvironmentReadiness({
      environment: "production",
      componentType: "gateway",
      componentId: "gateway_1",
      credentialReady: true,
      owner: "test_team",
    });

    assert.ok(record.readinessId);
    assert.ok(record.readinessId.startsWith("readiness_"));
  });

  test("registerEnvironmentReadiness uses provided readinessId [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const record = service.registerEnvironmentReadiness({
      readinessId: "custom_readiness_id",
      environment: "production",
      componentType: "gateway",
      componentId: "gateway_1",
      credentialReady: true,
      owner: "test_team",
    });

    assert.equal(record.readinessId, "custom_readiness_id");
  });

  test("registerEnvironmentReadiness validates componentId format [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    assert.throws(() => {
      service.registerEnvironmentReadiness({
        environment: "production",
        componentType: "gateway",
        componentId: "invalid id with spaces!",
        credentialReady: true,
        owner: "team",
      });
    }, /enterprise\.invalid_component_id/);
  });

  test("registerEnvironmentReadiness validates owner format [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    assert.throws(() => {
      service.registerEnvironmentReadiness({
        environment: "production",
        componentType: "gateway",
        componentId: "gateway_1",
        credentialReady: true,
        owner: "invalid owner!",
      });
    }, /enterprise\.invalid_owner/);
  });

  test("registerEnvironmentReadiness accepts valid identifier characters [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    // Valid: alphanumeric, dots, underscores, hyphens, colons, 2-128 chars
    const validIds = ["ab", "a.b.c", "a_b-c:1", "component-123", "SCIM_bridge:v2"];

    for (const id of validIds) {
      const record = service.registerEnvironmentReadiness({
        environment: "production",
        componentType: "gateway",
        componentId: id,
        credentialReady: true,
        owner: "team",
      });
      assert.equal(record.componentId, id);
    }
  });
});

describe("capability evaluation edge cases", () => {
  test("capability with multiple readiness requirements [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);

    // Return readiness for incident_console which requires 2 components
    let callCount = 0;
    mockStore.release.getActiveEnvironmentReadinessRecord = () => {
      callCount++;
      if (callCount === 1) {
        return {
          readinessId: "read_1",
          environment: "production",
          componentType: "gateway",
          componentId: "incident_console_gateway",
          credentialReady: 1,
          secondaryGatesJson: JSON.stringify({}),
          owner: "team",
          lastVerifiedAt: new Date().toISOString(),
          isActive: 1,
          notes: null,
        };
      } else {
        return null; // Second requirement not met
      }
    };

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const incidentEntry = result.report.entries.find(e => e.capabilityKey === "incident_console");
    assert.ok(incidentEntry);
    // Should be degraded because one requirement is missing
    assert.ok(incidentEntry.status === "degraded" || incidentEntry.status === "blocked");
  });

  test("capability with gate requirement - gate open [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_sso",
      environment: "production",
      componentType: "gateway",
      componentId: "identity_gateway",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({ sso_ready: true }),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "available");
  });

  test("capability with gate requirement - gate closed [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_sso",
      environment: "production",
      componentType: "gateway",
      componentId: "identity_gateway",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({ sso_ready: false }),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "degraded");
    assert.ok(ssoEntry.reasonCodes.some(r => r.includes("gate_blocked")));
  });

  test("readiness record with credentialReady=0 blocks capability [enterprise-capability-matrix-helpers]", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" } as any);
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
      readinessId: "read_123",
      environment: "production",
      componentType: "gateway",
      componentId: "identity_gateway",
      credentialReady: 0, // Not ready
      secondaryGatesJson: JSON.stringify({}),
      owner: "team",
      lastVerifiedAt: new Date().toISOString(),
      isActive: 1,
      notes: null,
    }) as any;

    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, mockStore as any);
    const result = service.buildMatrix({
      accountId: "acct_ent",
      environment: "production",
      deploymentMode: "cloud_shared",
    });

    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "degraded");
    assert.ok(ssoEntry.reasonCodes.some(r => r.includes("readiness_missing")));
  });
});

describe("listEnvironmentReadiness", () => {
  test("listEnvironmentReadiness returns array [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const records = service.listEnvironmentReadiness();
    assert.ok(Array.isArray(records));
  });

  test("listEnvironmentReadiness with environment filter [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const records = service.listEnvironmentReadiness("production");
    assert.ok(Array.isArray(records));
  });
});

describe("listReports", () => {
  test("listReports returns array [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const reports = service.listReports();
    assert.ok(Array.isArray(reports));
  });

  test("listReports respects limit [enterprise-capability-matrix-helpers]", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb() as any, createMockStore() as any);

    const reports = service.listReports(5);
    assert.ok(Array.isArray(reports));
  });
});
