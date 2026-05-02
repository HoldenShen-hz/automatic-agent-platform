/**
 * Unit tests for DataPlaneFlowServiceAsync
 *
 * @see src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DataPlaneFlowServiceAsync } from "../../../../src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

// ---------------------------------------------------------------------------
// Helper types and mocks
// ---------------------------------------------------------------------------

function createMockStore(): AuthoritativeTaskStore {
  const workspaces = new Map();
  const workspaceMemberships: any[] = [];
  const organizations = new Map();
  const organizationMemberships: any[] = [];
  const tenants = new Map();
  const deploymentBindings = new Map();
  const dataNamespaces = new Map();
  const billingAccounts = new Map();

  return {
    organization: {
      getWorkspaceRecord: (id: string) => workspaces.get(id) || null,
      upsertWorkspaceRecord: (record: any) => workspaces.set(record.workspaceId, record),
      listWorkspaceRecords: ({ limit }: { limit?: number } = {}) =>
        Array.from(workspaces.values()).slice(0, limit),
      getOrganizationRecord: (id: string) => organizations.get(id) || null,
      upsertOrganizationRecord: (record: any) => organizations.set(record.organizationId, record),
      listOrganizationRecords: (limit?: number) =>
        Array.from(organizations.values()).slice(0, limit),
      getTenantRecord: (id: string) => tenants.get(id) || null,
      upsertTenantRecord: (record: any) => tenants.set(record.tenantId, record),
      listTenantRecords: ({ limit }: { limit?: number } = {}) =>
        Array.from(tenants.values()).slice(0, limit),
      upsertDeploymentBindingRecord: (record: any) =>
        deploymentBindings.set(record.bindingId, record),
      listDeploymentBindings: ({ limit }: { limit?: number } = {}) =>
        Array.from(deploymentBindings.values()).slice(0, limit),
      upsertDataNamespaceRecord: (record: any) =>
        dataNamespaces.set(record.namespaceId, record),
      listDataNamespaces: ({ limit }: { limit?: number } = {}) =>
        Array.from(dataNamespaces.values()).slice(0, limit),
      listWorkspaceMemberships: (workspaceId: string) =>
        workspaceMemberships.filter((m: any) => m.workspaceId === workspaceId),
      upsertWorkspaceMembershipRecord: (record: any) => workspaceMemberships.push(record),
      listOrganizationMemberships: (orgId: string) =>
        organizationMemberships.filter((m: any) => m.organizationId === orgId),
      upsertOrganizationMembershipRecord: (record: any) =>
        organizationMemberships.push(record),
    },
    billing: {
      getBillingAccount: (id: string) => billingAccounts.get(id) || null,
      upsertBillingAccount: (record: any) => billingAccounts.set(record.accountId, record),
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
    filePath: "/tmp/test.db",
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// Constructor and basic structure verification
// ---------------------------------------------------------------------------

test("DataPlaneFlowServiceAsync can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  assert.ok(service instanceof DataPlaneFlowServiceAsync);
});

test("DataPlaneFlowServiceAsync extends SyncBackedAsyncService", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  // Should have getSyncService method from parent
  assert.equal(typeof service.getSyncService, "function");
});

test("DataPlaneFlowServiceAsync getSyncService returns underlying sync service", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  const sync = service.getSyncService();
  assert.ok(sync !== null);
  assert.equal(typeof sync.createAnalyticsFact, "function");
  assert.equal(typeof sync.createArchiveBundle, "function");
  assert.equal(typeof sync.createReplayDataset, "function");
  assert.equal(typeof sync.buildSummary, "function");
});

// ---------------------------------------------------------------------------
// Async method signatures
// ---------------------------------------------------------------------------

test("DataPlaneFlowServiceAsync createAnalyticsFactAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  assert.equal(typeof service.createAnalyticsFactAsync, "function");
});

test("DataPlaneFlowServiceAsync createArchiveBundleAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  assert.equal(typeof service.createArchiveBundleAsync, "function");
});

test("DataPlaneFlowServiceAsync createReplayDatasetAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  assert.equal(typeof service.createReplayDatasetAsync, "function");
});

test("DataPlaneFlowServiceAsync buildSummaryAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);
  assert.equal(typeof service.buildSummaryAsync, "function");
});

// ---------------------------------------------------------------------------
// Async method return type verification (Promise)
// ---------------------------------------------------------------------------

test("DataPlaneFlowServiceAsync createAnalyticsFactAsync returns a Promise", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);

  // Setup minimal organization structure to avoid early errors
  const orgRecord = {
    organizationId: "org_async_test",
    displayName: "Async Test Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertOrganizationRecord(orgRecord);

  const wsRecord = {
    workspaceId: "ws_async_test",
    ownerId: "owner_async",
    displayName: "Async WS",
    planId: "plan_basic",
    organizationId: "org_async_test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertWorkspaceRecord(wsRecord);

  const tenantRecord = {
    tenantId: "tenant_async_test",
    organizationId: "org_async_test",
    displayName: "Async Tenant",
    storageScope: "storage_async",
    identityScope: "identity_async",
    policyScope: "policy_async",
    artifactScope: "artifact_async",
    isolationMode: "shared_hard_scoped" as const,
    deploymentMode: "cloud_shared" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertTenantRecord(tenantRecord);

  const nsRecord = {
    namespaceId: "ns_async_test",
    tenantId: "tenant_async_test",
    organizationId: "org_async_test",
    workspaceId: "ws_async_test",
    plane: "analytics" as const,
    retentionPolicy: "analytics_180d",
    encryptionPolicy: "kms:tenant",
    residencyPolicy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertDataNamespaceRecord(nsRecord);

  const result = service.createAnalyticsFactAsync({
    factId: "fact_async_001",
    namespaceId: "ns_async_test",
    metricName: "test_metric_async",
    value: 100,
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-01T23:59:59.000Z",
    sourceRef: "task:async_test",
  });

  assert.ok(result instanceof Promise);
  const fact = await result;
  assert.equal(fact.factId, "fact_async_001");
  assert.equal(fact.namespaceId, "ns_async_test");
});

test("DataPlaneFlowServiceAsync createAnalyticsFactAsync rejects invalid factId", async () => {
  const db = createMockDb();
  const store = createMockStore();

  // Setup minimal structure
  const orgRecord = {
    organizationId: "org_invalid",
    displayName: "Invalid Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertOrganizationRecord(orgRecord);

  const wsRecord = {
    workspaceId: "ws_invalid",
    ownerId: "owner_invalid",
    displayName: "Invalid WS",
    planId: "plan_basic",
    organizationId: "org_invalid",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertWorkspaceRecord(wsRecord);

  const tenantRecord = {
    tenantId: "tenant_invalid",
    organizationId: "org_invalid",
    displayName: "Invalid Tenant",
    storageScope: "storage_invalid",
    identityScope: "identity_invalid",
    policyScope: "policy_invalid",
    artifactScope: "artifact_invalid",
    isolationMode: "shared_hard_scoped" as const,
    deploymentMode: "cloud_shared" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertTenantRecord(tenantRecord);

  const nsRecord = {
    namespaceId: "ns_invalid",
    tenantId: "tenant_invalid",
    organizationId: "org_invalid",
    workspaceId: "ws_invalid",
    plane: "analytics" as const,
    retentionPolicy: "analytics_180d",
    encryptionPolicy: "kms:tenant",
    residencyPolicy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertDataNamespaceRecord(nsRecord);

  const service = new DataPlaneFlowServiceAsync(db, store);

  await assert.rejects(
    () =>
      service.createAnalyticsFactAsync({
        factId: "invalid!", // Invalid character
        namespaceId: "ns_invalid",
        metricName: "test_metric",
        value: 1,
        windowStart: "2026-04-08T00:00:00.000Z",
        windowEnd: "2026-04-08T23:59:59.000Z",
        sourceRef: "task:test",
      }),
    (err: unknown) => (err as { code?: string }).code === "data_plane.invalid_fact_id",
  );
});

test("DataPlaneFlowServiceAsync createArchiveBundleAsync returns a Promise", async () => {
  const db = createMockDb();
  const store = createMockStore();

  // Setup organization structure
  const orgRecord = {
    organizationId: "org_archive_async",
    displayName: "Archive Async Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertOrganizationRecord(orgRecord);

  const wsRecord = {
    workspaceId: "ws_archive_async",
    ownerId: "owner_archive",
    displayName: "Archive Async WS",
    planId: "plan_basic",
    organizationId: "org_archive_async",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertWorkspaceRecord(wsRecord);

  const tenantRecord = {
    tenantId: "tenant_archive_async",
    organizationId: "org_archive_async",
    displayName: "Archive Async Tenant",
    storageScope: "storage_archive",
    identityScope: "identity_archive",
    policyScope: "policy_archive",
    artifactScope: "artifact_archive",
    isolationMode: "shared_hard_scoped" as const,
    deploymentMode: "cloud_shared" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertTenantRecord(tenantRecord);

  const nsRecord = {
    namespaceId: "ns_archive_async",
    tenantId: "tenant_archive_async",
    organizationId: "org_archive_async",
    workspaceId: "ws_archive_async",
    plane: "memory_archive" as const,
    retentionPolicy: "archive_365d",
    encryptionPolicy: "kms:tenant",
    residencyPolicy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertDataNamespaceRecord(nsRecord);

  const service = new DataPlaneFlowServiceAsync(db, store);

  const result = service.createArchiveBundleAsync({
    namespaceId: "ns_archive_async",
    bundleType: "test_bundle_async",
    sourceRefs: ["artifact:1"],
    summaryRef: "artifact:summary",
  });

  assert.ok(result instanceof Promise);
  const bundle = await result;
  assert.equal(bundle.bundleType, "test_bundle_async");
  assert.equal(bundle.namespaceId, "ns_archive_async");
});

test("DataPlaneFlowServiceAsync createReplayDatasetAsync returns a Promise", async () => {
  const db = createMockDb();
  const store = createMockStore();

  // Setup organization structure
  const orgRecord = {
    organizationId: "org_replay_async",
    displayName: "Replay Async Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertOrganizationRecord(orgRecord);

  const wsRecord = {
    workspaceId: "ws_replay_async",
    ownerId: "owner_replay",
    displayName: "Replay Async WS",
    planId: "plan_basic",
    organizationId: "org_replay_async",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertWorkspaceRecord(wsRecord);

  const tenantRecord = {
    tenantId: "tenant_replay_async",
    organizationId: "org_replay_async",
    displayName: "Replay Async Tenant",
    storageScope: "storage_replay",
    identityScope: "identity_replay",
    policyScope: "policy_replay",
    artifactScope: "artifact_replay",
    isolationMode: "shared_hard_scoped" as const,
    deploymentMode: "cloud_shared" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertTenantRecord(tenantRecord);

  const nsRecord = {
    namespaceId: "ns_replay_async",
    tenantId: "tenant_replay_async",
    organizationId: "org_replay_async",
    workspaceId: "ws_replay_async",
    plane: "replay" as const,
    retentionPolicy: "replay_90d",
    encryptionPolicy: "kms:tenant",
    residencyPolicy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  store.organization.upsertDataNamespaceRecord(nsRecord);

  const service = new DataPlaneFlowServiceAsync(db, store);

  const result = service.createReplayDatasetAsync({
    namespaceId: "ns_replay_async",
    datasetType: "test_dataset_async",
    sampleRefs: ["sample:1"],
    truthRefs: ["truth:1"],
    version: "v1_async",
  });

  assert.ok(result instanceof Promise);
  const dataset = await result;
  assert.equal(dataset.datasetType, "test_dataset_async");
  assert.equal(dataset.namespaceId, "ns_replay_async");
  assert.equal(dataset.version, "v1_async");
});

test("DataPlaneFlowServiceAsync buildSummaryAsync returns a Promise", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);

  const result = service.buildSummaryAsync();

  assert.ok(result instanceof Promise);
  const summary = await result;
  assert.equal(typeof summary.environment, "string");
  assert.equal(typeof summary.generatedAt, "string");
  assert.equal(typeof summary.planeCounts, "object");
});

test("DataPlaneFlowServiceAsync buildSummaryAsync accepts optional input", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new DataPlaneFlowServiceAsync(db, store);

  const result = service.buildSummaryAsync({
    environment: "test-environment",
  });

  assert.ok(result instanceof Promise);
  const summary = await result;
  assert.equal(summary.environment, "test-environment");
});