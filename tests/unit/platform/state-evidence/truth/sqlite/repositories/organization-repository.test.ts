import assert from "node:assert/strict";
import test from "node:test";
import { OrganizationRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.js";

function createMockDb() {
  const runCalls: unknown[][] = [];
  return {
    db: {
      connection: {
        prepare: () => ({
          run: (...args: unknown[]) => {
            runCalls.push(args);
            return { changes: 1 };
          },
          get: () => undefined,
          all: () => [],
        }),
      },
    },
    runCalls,
  };
}

test("OrganizationRepository has all required methods", () => {
  const { db } = createMockDb();
  const repo = new OrganizationRepository(db);

  // Workspace methods
  assert.equal(typeof repo.upsertWorkspaceRecord, "function");
  assert.equal(typeof repo.getWorkspaceRecord, "function");
  assert.equal(typeof repo.listWorkspaceRecords, "function");
  assert.equal(typeof repo.upsertWorkspaceMembershipRecord, "function");
  assert.equal(typeof repo.listWorkspaceMemberships, "function");
  // Organization methods
  assert.equal(typeof repo.upsertOrganizationRecord, "function");
  assert.equal(typeof repo.getOrganizationRecord, "function");
  assert.equal(typeof repo.listOrganizationRecords, "function");
  assert.equal(typeof repo.upsertOrganizationMembershipRecord, "function");
  assert.equal(typeof repo.listOrganizationMemberships, "function");
  // Tenant methods
  assert.equal(typeof repo.upsertTenantRecord, "function");
  assert.equal(typeof repo.getTenantRecord, "function");
  assert.equal(typeof repo.listTenantRecords, "function");
  // Deployment binding methods
  assert.equal(typeof repo.upsertDeploymentBindingRecord, "function");
  assert.equal(typeof repo.getDeploymentBindingRecord, "function");
  assert.equal(typeof repo.listDeploymentBindings, "function");
  // Data namespace methods
  assert.equal(typeof repo.upsertDataNamespaceRecord, "function");
  assert.equal(typeof repo.getDataNamespaceRecord, "function");
  assert.equal(typeof repo.listDataNamespaces, "function");
});

test("OrganizationRepository upserts workspace record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const workspace = {
    workspaceId: "ws_1",
    ownerId: "user_1",
    displayName: "Test Workspace",
    planId: "plan_pro",
    defaultPolicySet: "default",
    organizationId: "org_1",
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertWorkspaceRecord(workspace), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(workspace.workspaceId));
  assert.ok(runCalls[0]?.includes(workspace.displayName));
});

test("OrganizationRepository gets workspace record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.getWorkspaceRecord("nonexistent");
  assert.equal(result, null);
});

test("OrganizationRepository lists workspace records", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listWorkspaceRecords();
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository lists workspace records by organization", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listWorkspaceRecords({ organizationId: "org_1" });
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository upserts workspace membership record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const membership = {
    workspaceId: "ws_1",
    userId: "user_1",
    role: "admin",
    joinedAt: now,
  };

  assert.equal(repo.upsertWorkspaceMembershipRecord(membership), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(membership.workspaceId));
  assert.ok(runCalls[0]?.includes(membership.userId));
});

test("OrganizationRepository lists workspace memberships", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listWorkspaceMemberships("ws_1");
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository upserts organization record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const org = {
    organizationId: "org_1",
    displayName: "Test Organization",
    billingAccountId: "billing_1",
    defaultTenantId: "tenant_1",
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertOrganizationRecord(org), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(org.organizationId));
  assert.ok(runCalls[0]?.includes(org.displayName));
});

test("OrganizationRepository gets organization record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.getOrganizationRecord("nonexistent");
  assert.equal(result, null);
});

test("OrganizationRepository lists organization records", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listOrganizationRecords();
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository upserts organization membership record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const membership = {
    organizationId: "org_1",
    userId: "user_1",
    role: "owner",
    joinedAt: now,
  };

  assert.equal(repo.upsertOrganizationMembershipRecord(membership), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(membership.organizationId));
  assert.ok(runCalls[0]?.includes(membership.userId));
});

test("OrganizationRepository lists organization memberships", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listOrganizationMemberships("org_1");
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository upserts tenant record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const tenant = {
    tenantId: "tenant_1",
    organizationId: "org_1",
    displayName: "Test Tenant",
    storageScope: "tenant_1:storage",
    identityScope: "tenant_1:identity",
    policyScope: "tenant_1:policy",
    artifactScope: "tenant_1:artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "private_cloud",
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertTenantRecord(tenant), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(tenant.tenantId));
  assert.ok(runCalls[0]?.includes(tenant.displayName));
});

test("OrganizationRepository gets tenant record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.getTenantRecord("nonexistent");
  assert.equal(result, null);
});

test("OrganizationRepository lists tenant records", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listTenantRecords();
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository upserts deployment binding record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const binding = {
    bindingId: "binding_1",
    tenantId: "tenant_1",
    environmentId: "env_1",
    deploymentMode: "private_cloud",
    region: "us-west-1",
    networkBoundary: "private",
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertDeploymentBindingRecord(binding), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(binding.bindingId));
  assert.ok(runCalls[0]?.includes(binding.environmentId));
});

test("OrganizationRepository gets deployment binding record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.getDeploymentBindingRecord("nonexistent");
  assert.equal(result, null);
});

test("OrganizationRepository lists deployment bindings", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listDeploymentBindings();
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository upserts data namespace record", () => {
  const { db, runCalls } = createMockDb();
  const repo = new OrganizationRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const ns = {
    namespaceId: "ns_1",
    plane: "execution",
    tenantId: "tenant_1",
    organizationId: "org_1",
    workspaceId: "ws_1",
    retentionPolicy: "standard",
    encryptionPolicy: "standard",
    residencyPolicy: "us-west",
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertDataNamespaceRecord(ns), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(ns.namespaceId));
  assert.ok(runCalls[0]?.includes(ns.plane));
});

test("OrganizationRepository gets data namespace record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.getDataNamespaceRecord("nonexistent");
  assert.equal(result, null);
});

test("OrganizationRepository lists data namespaces", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listDataNamespaces();
  assert.ok(Array.isArray(result));
});

test("OrganizationRepository lists data namespaces with filters", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new OrganizationRepository(db);

  const result = repo.listDataNamespaces({ plane: "execution", tenantId: "tenant_1" });
  assert.ok(Array.isArray(result));
});
