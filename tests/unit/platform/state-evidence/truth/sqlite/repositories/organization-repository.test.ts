import assert from "node:assert/strict";
import test from "node:test";

import { OrganizationRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.js";
import { createMockAuthoritativeSqlDatabase } from "./test-helpers.js";

test("OrganizationRepository has all required methods", () => {
  const { db } = createMockAuthoritativeSqlDatabase();
  const repo = new OrganizationRepository(db);

  assert.equal(typeof repo.upsertWorkspaceRecord, "function");
  assert.equal(typeof repo.getWorkspaceRecord, "function");
  assert.equal(typeof repo.listWorkspaceRecords, "function");
  assert.equal(typeof repo.upsertWorkspaceMembershipRecord, "function");
  assert.equal(typeof repo.listWorkspaceMemberships, "function");
  assert.equal(typeof repo.upsertOrganizationRecord, "function");
  assert.equal(typeof repo.getOrganizationRecord, "function");
  assert.equal(typeof repo.listOrganizationRecords, "function");
  assert.equal(typeof repo.upsertOrganizationMembershipRecord, "function");
  assert.equal(typeof repo.listOrganizationMemberships, "function");
  assert.equal(typeof repo.upsertTenantRecord, "function");
  assert.equal(typeof repo.getTenantRecord, "function");
  assert.equal(typeof repo.listTenantRecords, "function");
  assert.equal(typeof repo.upsertDeploymentBindingRecord, "function");
  assert.equal(typeof repo.getDeploymentBindingRecord, "function");
  assert.equal(typeof repo.listDeploymentBindings, "function");
  assert.equal(typeof repo.upsertDataNamespaceRecord, "function");
  assert.equal(typeof repo.getDataNamespaceRecord, "function");
  assert.equal(typeof repo.listDataNamespaces, "function");
});

test("OrganizationRepository upserts workspace and organization records", () => {
  const { db, runCalls } = createMockAuthoritativeSqlDatabase();
  const repo = new OrganizationRepository(db);
  const now = "2026-04-21T10:00:00.000Z";

  repo.upsertWorkspaceRecord({
    workspaceId: "ws_1",
    ownerId: "user_1",
    displayName: "Test Workspace",
    planId: "plan_pro",
    defaultPolicySet: "default",
    organizationId: "org_1",
    createdAt: now,
    updatedAt: now,
  });
  repo.upsertOrganizationRecord({
    organizationId: "org_1",
    displayName: "Test Organization",
    billingAccountId: "billing_1",
    defaultTenantId: "tenant_1",
    createdAt: now,
    updatedAt: now,
  });
  repo.upsertWorkspaceMembershipRecord({
    workspaceId: "ws_1",
    userId: "user_1",
    role: "admin",
    joinedAt: now,
  });
  repo.upsertOrganizationMembershipRecord({
    organizationId: "org_1",
    userId: "user_1",
    role: "owner",
    joinedAt: now,
  });

  assert.equal(runCalls.length, 4);
  assert.ok(runCalls[0]?.includes("ws_1"));
  assert.ok(runCalls[1]?.includes("org_1"));
});

test("OrganizationRepository upserts tenant, binding, and namespace records", () => {
  const { db, runCalls } = createMockAuthoritativeSqlDatabase();
  const repo = new OrganizationRepository(db);
  const now = "2026-04-21T10:00:00.000Z";

  repo.upsertTenantRecord({
    tenantId: "tenant_1",
    organizationId: "org_1",
    displayName: "Test Tenant",
    storageScope: "tenant_1:storage",
    identityScope: "tenant_1:identity",
    policyScope: "tenant_1:policy",
    artifactScope: "tenant_1:artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "private_cloud",
    quotas: {},
    createdAt: now,
    updatedAt: now,
  });
  repo.upsertDeploymentBindingRecord({
    bindingId: "binding_1",
    tenantId: "tenant_1",
    environmentId: "prod",
    deploymentMode: "private_cloud",
    region: "us-west-2",
    networkBoundary: "corp-vpc",
    createdAt: now,
    updatedAt: now,
  });
  repo.upsertDataNamespaceRecord({
    namespaceId: "namespace_1",
    plane: "transactional",
    tenantId: "tenant_1",
    organizationId: "org_1",
    workspaceId: "ws_1",
    retentionPolicy: "90d",
    encryptionPolicy: "kms-default",
    residencyPolicy: "us",
    createdAt: now,
    updatedAt: now,
  });

  assert.equal(runCalls.length, 3);
  assert.ok(runCalls[0]?.includes("tenant_1"));
  assert.ok(runCalls[1]?.includes("binding_1"));
  assert.ok(runCalls[2]?.includes("namespace_1"));
});

test("OrganizationRepository read methods return null for missing entities", () => {
  const { db } = createMockAuthoritativeSqlDatabase({ getResult: null });
  const repo = new OrganizationRepository(db);

  assert.equal(repo.getWorkspaceRecord("missing"), null);
  assert.equal(repo.getOrganizationRecord("missing"), null);
  assert.equal(repo.getTenantRecord("missing"), null);
  assert.equal(repo.getDeploymentBindingRecord("missing"), null);
  assert.equal(repo.getDataNamespaceRecord("missing"), null);
});

test("OrganizationRepository list methods tolerate empty results", () => {
  const { db } = createMockAuthoritativeSqlDatabase();
  const repo = new OrganizationRepository(db);

  assert.ok(Array.isArray(repo.listWorkspaceRecords()));
  assert.ok(Array.isArray(repo.listWorkspaceRecords({ organizationId: "org_1" })));
  assert.ok(Array.isArray(repo.listWorkspaceMemberships("ws_1")));
  assert.ok(Array.isArray(repo.listOrganizationRecords()));
  assert.ok(Array.isArray(repo.listOrganizationMemberships("org_1")));
  assert.ok(Array.isArray(repo.listTenantRecords()));
  assert.ok(Array.isArray(repo.listDeploymentBindings()));
  assert.ok(Array.isArray(repo.listDataNamespaces()));
});
