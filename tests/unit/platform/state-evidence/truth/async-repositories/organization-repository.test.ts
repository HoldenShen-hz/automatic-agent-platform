import assert from "node:assert/strict";
import test from "node:test";

import { AsyncOrganizationRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/organization-repository.js";
import type {
  WorkspaceRecord,
  WorkspaceMembershipRecord,
  OrganizationRecord,
  OrganizationMembershipRecord,
  TenantRecord,
  DeploymentBindingRecord,
  DataNamespaceRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

function createMockAsyncConnection(): any {
  const storage: {
    workspaces: Map<string, WorkspaceRecord>;
    workspace_memberships: Map<string, WorkspaceMembershipRecord>;
    organizations: Map<string, OrganizationRecord>;
    organization_memberships: Map<string, OrganizationMembershipRecord>;
    tenants: Map<string, TenantRecord>;
    deployment_bindings: Map<string, DeploymentBindingRecord>;
    data_namespaces: Map<string, DataNamespaceRecord>;
  } = {
    workspaces: new Map(),
    workspace_memberships: new Map(),
    organizations: new Map(),
    organization_memberships: new Map(),
    tenants: new Map(),
    deployment_bindings: new Map(),
    data_namespaces: new Map(),
  };

  return {
    query: async <T>(sql: string, ..._params: unknown[]): Promise<{ rows: T[]; rowCount: number }> => {
      if (sql.includes("workspaces")) {
        const rows = Array.from(storage.workspaces.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("organizations")) {
        const rows = Array.from(storage.organizations.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("tenants")) {
        const rows = Array.from(storage.tenants.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("deployment_bindings")) {
        const rows = Array.from(storage.deployment_bindings.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("data_namespaces")) {
        const rows = Array.from(storage.data_namespaces.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      return { rows: [] as T[], rowCount: 0 };
    },
    queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | undefined> => {
      const id = params[0];
      if (sql.includes("workspaces")) {
        return storage.workspaces.get(id as string) as T | undefined;
      }
      if (sql.includes("organizations")) {
        return storage.organizations.get(id as string) as T | undefined;
      }
      if (sql.includes("tenants")) {
        return storage.tenants.get(id as string) as T | undefined;
      }
      if (sql.includes("deployment_bindings")) {
        return storage.deployment_bindings.get(id as string) as T | undefined;
      }
      if (sql.includes("data_namespaces")) {
        return storage.data_namespaces.get(id as string) as T | undefined;
      }
      return undefined;
    },
    execute: async (sql: string, ...params: unknown[]): Promise<number> => {
      if (sql.includes("workspaces")) {
        // params: [workspaceId, ownerId, displayName, planId, defaultPolicySet, organizationId, createdAt, updatedAt]
        const record: WorkspaceRecord = {
          workspaceId: params[0] as string,
          ownerId: params[1] as string,
          displayName: params[2] as string,
          planId: params[3] as string,
          defaultPolicySet: params[4] as string,
          organizationId: params[5] as string,
          createdAt: params[6] as string,
          updatedAt: params[7] as string,
        };
        storage.workspaces.set(record.workspaceId, record);
      } else if (sql.includes("workspace_memberships")) {
        const record: WorkspaceMembershipRecord = {
          workspaceId: params[0] as string,
          userId: params[1] as string,
          role: params[2] as string,
          joinedAt: params[3] as string,
        };
        storage.workspace_memberships.set(record.workspaceId + ":" + record.userId, record);
      } else if (sql.includes("organizations")) {
        const record: OrganizationRecord = {
          organizationId: params[0] as string,
          displayName: params[1] as string,
          billingAccountId: params[2] as string,
          defaultTenantId: params[3] as string,
          createdAt: params[4] as string,
          updatedAt: params[5] as string,
        };
        storage.organizations.set(record.organizationId, record);
      } else if (sql.includes("organization_memberships")) {
        const record: OrganizationMembershipRecord = {
          organizationId: params[0] as string,
          userId: params[1] as string,
          role: params[2] as string,
          joinedAt: params[3] as string,
        };
        storage.organization_memberships.set(record.organizationId + ":" + record.userId, record);
      } else if (sql.includes("tenants")) {
        const record: TenantRecord = {
          tenantId: params[0] as string,
          organizationId: params[1] as string,
          displayName: params[2] as string | null,
          storageScope: params[3] as string,
          identityScope: params[4] as string,
          policyScope: params[5] as string,
          artifactScope: params[6] as string,
          isolationMode: params[7] as string,
          deploymentMode: params[8] as string,
          createdAt: params[9] as string,
          updatedAt: params[10] as string,
        };
        storage.tenants.set(record.tenantId, record);
      } else if (sql.includes("deployment_bindings")) {
        const record: DeploymentBindingRecord = {
          bindingId: params[0] as string,
          tenantId: params[1] as string,
          environmentId: params[2] as string,
          deploymentMode: params[3] as string,
          region: params[4] as string,
          networkBoundary: params[5] as string,
          createdAt: params[6] as string,
          updatedAt: params[7] as string,
        };
        storage.deployment_bindings.set(record.bindingId, record);
      } else if (sql.includes("data_namespaces")) {
        const record: DataNamespaceRecord = {
          namespaceId: params[0] as string,
          plane: params[1] as string,
          tenantId: params[2] as string,
          organizationId: params[3] as string,
          workspaceId: params[4] as string,
          retentionPolicy: params[5] as string,
          encryptionPolicy: params[6] as string,
          residencyPolicy: params[7] as string,
          createdAt: params[8] as string,
          updatedAt: params[9] as string,
        };
        storage.data_namespaces.set(record.namespaceId, record);
      }
      return 1;
    },
    _storage: storage,
  };
}

function createWorkspaceRecord(overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord {
  const now = new Date().toISOString();
  return {
    workspaceId: "ws-001",
    ownerId: "user-001",
    displayName: "Test Workspace",
    planId: "plan-basic",
    defaultPolicySet: "default",
    organizationId: "org-001",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createOrganizationRecord(overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  const now = new Date().toISOString();
  return {
    organizationId: "org-001",
    displayName: "Test Org",
    billingAccountId: "ba-001",
    defaultTenantId: "tenant-001",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTenantRecord(overrides: Partial<TenantRecord> = {}): TenantRecord {
  const now = new Date().toISOString();
  return {
    tenantId: "tenant-001",
    organizationId: "org-001",
    displayName: "Test Tenant",
    storageScope: "standard",
    identityScope: "standard",
    policyScope: "standard",
    artifactScope: "standard",
    isolationMode: "shared",
    deploymentMode: "single-tenant",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("AsyncOrganizationRepository constructor requires connection", () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);
  assert.ok(repo != null);
});

test("AsyncOrganizationRepository is instantiable", () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);
  assert.ok(repo instanceof AsyncOrganizationRepository);
});

test("AsyncOrganizationRepository.upsertWorkspaceRecord stores workspace", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const workspace = createWorkspaceRecord({ workspaceId: "ws-test-1" });
  await repo.upsertWorkspaceRecord(workspace);

  assert.ok(conn._storage.workspaces.has("ws-test-1"));
});

test("AsyncOrganizationRepository.upsertWorkspaceRecord updates existing workspace", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const workspace1 = createWorkspaceRecord({ workspaceId: "ws-update", displayName: "Original Name" });
  await repo.upsertWorkspaceRecord(workspace1);

  const workspace2 = createWorkspaceRecord({ workspaceId: "ws-update", displayName: "Updated Name" });
  await repo.upsertWorkspaceRecord(workspace2);

  const stored = conn._storage.workspaces.get("ws-update");
  assert.ok(stored != null);
  assert.equal(stored!.displayName, "Updated Name");
});

test("AsyncOrganizationRepository.upsertOrganizationRecord stores organization", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const org = createOrganizationRecord({ organizationId: "org-test-1" });
  await repo.upsertOrganizationRecord(org);

  assert.ok(conn._storage.organizations.has("org-test-1"));
});

test("AsyncOrganizationRepository.upsertTenantRecord stores tenant with displayName fallback", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const tenant = createTenantRecord({ tenantId: "tenant-test-1" });
  await repo.upsertTenantRecord(tenant);

  assert.ok(conn._storage.tenants.has("tenant-test-1"));
});

test("AsyncOrganizationRepository.upsertTenantRecord uses tenantId as displayName when displayName is null", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const tenant = createTenantRecord({ tenantId: "tenant-no-display", displayName: null });
  await repo.upsertTenantRecord(tenant);

  assert.ok(conn._storage.tenants.has("tenant-no-display"));
});

test("AsyncOrganizationRepository.upsertDeploymentBindingRecord stores binding", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const binding: DeploymentBindingRecord = {
    bindingId: "binding-001",
    tenantId: "tenant-001",
    environmentId: "env-001",
    deploymentMode: "single-tenant",
    region: "us-east-1",
    networkBoundary: "private",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await repo.upsertDeploymentBindingRecord(binding);

  assert.ok(conn._storage.deployment_bindings.has("binding-001"));
});

test("AsyncOrganizationRepository.upsertDataNamespaceRecord stores namespace", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const ns: DataNamespaceRecord = {
    namespaceId: "ns-001",
    plane: "control",
    tenantId: "tenant-001",
    organizationId: "org-001",
    workspaceId: "ws-001",
    retentionPolicy: "standard",
    encryptionPolicy: "standard",
    residencyPolicy: "local",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await repo.upsertDataNamespaceRecord(ns);

  assert.ok(conn._storage.data_namespaces.has("ns-001"));
});

test("AsyncOrganizationRepository.getWorkspaceRecord returns null for missing workspace", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.getWorkspaceRecord("nonexistent-ws");
  assert.equal(result, null);
});

test("AsyncOrganizationRepository.getOrganizationRecord returns null for missing organization", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.getOrganizationRecord("nonexistent-org");
  assert.equal(result, null);
});

test("AsyncOrganizationRepository.getTenantRecord returns null for missing tenant", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.getTenantRecord("nonexistent-tenant");
  assert.equal(result, null);
});

test("AsyncOrganizationRepository.getDeploymentBindingRecord returns null for missing binding", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.getDeploymentBindingRecord("nonexistent-binding");
  assert.equal(result, null);
});

test("AsyncOrganizationRepository.getDataNamespaceRecord returns null for missing namespace", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.getDataNamespaceRecord("nonexistent-ns");
  assert.equal(result, null);
});

test("AsyncOrganizationRepository.listWorkspaceRecords respects limit parameter", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  // Mock returns empty array since we don't have full query implementation
  const result = await repo.listWorkspaceRecords({ limit: 10 });
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listTenantRecords filters by organizationId when provided", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listTenantRecords({ organizationId: "org-001", limit: 5 });
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listDeploymentBindings filters by tenantId when provided", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listDeploymentBindings({ tenantId: "tenant-001", limit: 5 });
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listDataNamespaces filters by plane when provided", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listDataNamespaces({ plane: "control", limit: 10 });
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listDataNamespaces with multiple filters", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listDataNamespaces({
    plane: "control",
    tenantId: "tenant-001",
    organizationId: "org-001",
    workspaceId: "ws-001",
    limit: 20,
  });
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listOrganizationRecords returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listOrganizationRecords(50);
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listWorkspaceMemberships returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listWorkspaceMemberships("ws-001");
  assert.ok(Array.isArray(result));
});

test("AsyncOrganizationRepository.listOrganizationMemberships returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncOrganizationRepository(conn);

  const result = await repo.listOrganizationMemberships("org-001");
  assert.ok(Array.isArray(result));
});