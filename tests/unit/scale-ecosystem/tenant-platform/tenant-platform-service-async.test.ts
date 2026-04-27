// @ts-nocheck
/**
 * Unit tests for TenantPlatformServiceAsync
 *
 * @see src/scale-ecosystem/tenant-platform/tenant-platform-service-async.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TenantPlatformServiceAsync } from "../../../../src/scale-ecosystem/tenant-platform/tenant-platform-service-async.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

// ---------------------------------------------------------------------------
// Helper types
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
      listWorkspaceRecords: ({ limit }: { limit?: number } = {}) => Array.from(workspaces.values()).slice(0, limit),
      getOrganizationRecord: (id: string) => organizations.get(id) || null,
      upsertOrganizationRecord: (record: any) => organizations.set(record.organizationId, record),
      listOrganizationRecords: (limit?: number) => Array.from(organizations.values()).slice(0, limit),
      getTenantRecord: (id: string) => tenants.get(id) || null,
      upsertTenantRecord: (record: any) => tenants.set(record.tenantId, record),
      listTenantRecords: ({ limit }: { limit?: number } = {}) => Array.from(tenants.values()).slice(0, limit),
      upsertDeploymentBindingRecord: (record: any) => deploymentBindings.set(record.bindingId, record),
      listDeploymentBindings: ({ limit }: { limit?: number } = {}) => Array.from(deploymentBindings.values()).slice(0, limit),
      upsertDataNamespaceRecord: (record: any) => dataNamespaces.set(record.namespaceId, record),
      listDataNamespaces: ({ limit }: { limit?: number } = {}) => Array.from(dataNamespaces.values()).slice(0, limit),
      listWorkspaceMemberships: (workspaceId: string) => workspaceMemberships.filter((m: any) => m.workspaceId === workspaceId),
      upsertWorkspaceMembershipRecord: (record: any) => workspaceMemberships.push(record),
      listOrganizationMemberships: (orgId: string) => organizationMemberships.filter((m: any) => m.organizationId === orgId),
      upsertOrganizationMembershipRecord: (record: any) => organizationMemberships.push(record),
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
// TenantPlatformServiceAsync construction verification
// ---------------------------------------------------------------------------

test("TenantPlatformServiceAsync can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);
  assert.ok(service instanceof TenantPlatformServiceAsync);
});

test("TenantPlatformServiceAsync getSyncService returns underlying sync service", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);
  const sync = service.getSyncService();
  assert.ok(sync !== null);
});

test("TenantPlatformServiceAsync uses SyncBackedAsyncService pattern", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);

  // Verify service has getSyncService method from SyncBackedAsyncService
  assert.equal(typeof service.getSyncService, "function");
  assert.equal(typeof service.createTenantAsync, "function");
  assert.equal(typeof service.createWorkspaceAsync, "function");
  assert.equal(typeof service.createOrganizationAsync, "function");
  assert.equal(typeof service.createDataNamespaceAsync, "function");
});

test("TenantPlatformServiceAsync createTenantAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);
  assert.equal(typeof service.createTenantAsync, "function");
});

test("TenantPlatformServiceAsync createWorkspaceAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);
  assert.equal(typeof service.createWorkspaceAsync, "function");
});

test("TenantPlatformServiceAsync createOrganizationAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);
  assert.equal(typeof service.createOrganizationAsync, "function");
});

test("TenantPlatformServiceAsync createDataNamespaceAsync is a function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new TenantPlatformServiceAsync(db, store);
  assert.equal(typeof service.createDataNamespaceAsync, "function");
});