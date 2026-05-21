/**
 * Unit tests for tenant-platform index utilities
 *
 * @see src/scale-ecosystem/tenant-platform/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  assertIdentifier,
  assertNonEmpty,
  toTenantStatus,
  fromTenantStatus,
  VALID_LIFECYCLE_TRANSITIONS,
} from "../../../../src/scale-ecosystem/tenant-platform/index.js";
import type {
  CreateWorkspaceInput,
  AddWorkspaceMembershipInput,
  CreateOrganizationInput,
  AddOrganizationMembershipInput,
  CreateTenantInput,
  CreateDeploymentBindingInput,
  CreateDataNamespaceInput,
  TenantTopologySummary,
  DedicatedPoolIsolationRecord,
  TenantLifecycleStage,
  TenantLifecycleInput,
} from "../../../../src/scale-ecosystem/tenant-platform/index.js";

// ---------------------------------------------------------------------------
// assertIdentifier tests
// ---------------------------------------------------------------------------

test("assertIdentifier accepts valid alphanumeric identifier", () => {
  const result = assertIdentifier("workspace_001", "ERR_INVALID_ID");
  assert.equal(result, "workspace_001");
});

test("assertIdentifier accepts identifiers with dots, underscores, colons, hyphens", () => {
  assert.equal(assertIdentifier("my.workspace:001", "ERR"), "my.workspace:001");
  assert.equal(assertIdentifier("org_abc-123", "ERR"), "org_abc-123");
  assert.equal(assertIdentifier("a:b.c-d", "ERR"), "a:b.c-d");
});

test("assertIdentifier accepts minimum length (2 chars)", () => {
  const result = assertIdentifier("ab", "ERR");
  assert.equal(result, "ab");
});

test("assertIdentifier accepts maximum length (128 chars)", () => {
  const result = assertIdentifier("a".repeat(128), "ERR");
  assert.equal(result, "a".repeat(128));
});

test("assertIdentifier rejects identifiers shorter than 2 characters", () => {
  assert.throws(
    () => assertIdentifier("a", "ERR_TOO_SHORT"),
    (err: any) => err.code === "ERR_TOO_SHORT" && err.details?.category === "tenant"
  );
});

test("assertIdentifier rejects identifiers longer than 128 characters", () => {
  assert.throws(
    () => assertIdentifier("a".repeat(129), "ERR_TOO_LONG"),
    (err: any) => err.code === "ERR_TOO_LONG" && err.details?.category === "tenant"
  );
});

test("assertIdentifier rejects identifiers with invalid characters", () => {
  assert.throws(
    () => assertIdentifier("workspace@001", "ERR_INVALID"),
    (err: any) => err.code === "ERR_INVALID" && err.details?.category === "tenant"
  );
  assert.throws(
    () => assertIdentifier("workspace 001", "ERR_SPACE"),
    (err: any) => err.code === "ERR_SPACE" && err.details?.category === "tenant"
  );
  assert.throws(
    () => assertIdentifier("workspace!001", "ERR_BANG"),
    (err: any) => err.code === "ERR_BANG" && err.details?.category === "tenant"
  );
});

test("assertIdentifier rejects empty string", () => {
  assert.throws(
    () => assertIdentifier("", "ERR_EMPTY"),
    (err: any) => err.code === "ERR_EMPTY" && err.details?.category === "tenant"
  );
});

test("assertIdentifier passes through value in error details", () => {
  try {
    assertIdentifier("invalid@id", "ERR_BAD");
    assert.fail("Should have thrown");
  } catch (err: any) {
    assert.equal(err.details?.value, "invalid@id");
  }
});

// ---------------------------------------------------------------------------
// assertNonEmpty tests
// ---------------------------------------------------------------------------

test("assertNonEmpty accepts non-empty string", () => {
  const result = assertNonEmpty("hello world", "ERR_EMPTY");
  assert.equal(result, "hello world");
});

test("assertNonEmpty trims whitespace", () => {
  const result = assertNonEmpty("  trimmed  ", "ERR_EMPTY");
  assert.equal(result, "trimmed");
});

test("assertNonEmpty rejects empty string", () => {
  assert.throws(
    () => assertNonEmpty("", "ERR_EMPTY"),
    (err: any) => err.code === "ERR_EMPTY" && err.details?.category === "tenant"
  );
});

test("assertNonEmpty rejects whitespace-only string", () => {
  assert.throws(
    () => assertNonEmpty("   ", "ERR_WHITESPACE"),
    (err: any) => err.code === "ERR_WHITESPACE" && err.details?.category === "tenant"
  );
});

test("assertNonEmpty rejects tab-only string", () => {
  assert.throws(
    () => assertNonEmpty("\t", "ERR_TAB"),
    (err: any) => err.code === "ERR_TAB" && err.details?.category === "tenant"
  );
});

test("assertNonEmpty rejects newline-only string", () => {
  assert.throws(
    () => assertNonEmpty("\n", "ERR_NEWLINE"),
    (err: any) => err.code === "ERR_NEWLINE" && err.details?.category === "tenant"
  );
});

// ---------------------------------------------------------------------------
// toTenantStatus tests
// ---------------------------------------------------------------------------

test("toTenantStatus maps provisioning to active", () => {
  assert.equal(toTenantStatus("provisioning"), "active");
});

test("toTenantStatus maps active to active", () => {
  assert.equal(toTenantStatus("active"), "active");
});

test("toTenantStatus maps deactivated to active", () => {
  assert.equal(toTenantStatus("deactivated"), "active");
});

test("toTenantStatus maps suspended to suspended", () => {
  assert.equal(toTenantStatus("suspended"), "suspended");
});

test("toTenantStatus maps decommissioned to terminated", () => {
  assert.equal(toTenantStatus("decommissioned"), "terminated");
});

// ---------------------------------------------------------------------------
// fromTenantStatus tests
// ---------------------------------------------------------------------------

test("fromTenantStatus maps active to active", () => {
  assert.equal(fromTenantStatus("active"), "active");
});

test("fromTenantStatus maps suspended to suspended", () => {
  assert.equal(fromTenantStatus("suspended"), "suspended");
});

test("fromTenantStatus maps terminated to decommissioned", () => {
  assert.equal(fromTenantStatus("terminated"), "decommissioned");
});

test("fromTenantStatus maps undefined to active (default)", () => {
  assert.equal(fromTenantStatus(undefined), "active");
});

// ---------------------------------------------------------------------------
// VALID_LIFECYCLE_TRANSITIONS tests
// ---------------------------------------------------------------------------

test("VALID_LIFECYCLE_TRANSITIONS defines provisioning transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS["provisioning"];
  assert.ok(Array.isArray(transitions));
  assert.ok(transitions.includes("active"));
  assert.ok(transitions.includes("decommissioned"));
  assert.equal(transitions.length, 2);
});

test("VALID_LIFECYCLE_TRANSITIONS defines active transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS["active"];
  assert.ok(Array.isArray(transitions));
  assert.ok(transitions.includes("suspended"));
  assert.ok(transitions.includes("deactivated"));
  assert.ok(transitions.includes("decommissioned"));
  assert.equal(transitions.length, 3);
});

test("VALID_LIFECYCLE_TRANSITIONS defines suspended transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS["suspended"];
  assert.ok(Array.isArray(transitions));
  assert.ok(transitions.includes("active"));
  assert.ok(transitions.includes("deactivated"));
  assert.ok(transitions.includes("decommissioned"));
  assert.equal(transitions.length, 3);
});

test("VALID_LIFECYCLE_TRANSITIONS defines deactivated transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS["deactivated"];
  assert.ok(Array.isArray(transitions));
  assert.ok(transitions.includes("active"));
  assert.ok(transitions.includes("decommissioned"));
  assert.equal(transitions.length, 2);
});

test("VALID_LIFECYCLE_TRANSITIONS defines decommissioned transitions (none)", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS["decommissioned"];
  assert.ok(Array.isArray(transitions));
  assert.equal(transitions.length, 0);
});

test("VALID_LIFECYCLE_TRANSITIONS covers all lifecycle stages as keys", () => {
  const stages: TenantLifecycleStage[] = [
    "provisioning",
    "active",
    "suspended",
    "deactivated",
    "decommissioned",
  ];
  for (const stage of stages) {
    assert.ok(
      stage in VALID_LIFECYCLE_TRANSITIONS,
      `Missing transitions for stage: ${stage}`
    );
  }
});

// ---------------------------------------------------------------------------
// Interface/type shape verification tests
// ---------------------------------------------------------------------------

test("CreateWorkspaceInput interface structure", () => {
  const input: CreateWorkspaceInput = {
    ownerId: "owner_001",
    displayName: "Test Workspace",
    planId: "plan_basic",
    organizationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(input.ownerId, "owner_001");
  assert.equal(input.displayName, "Test Workspace");
});

test("AddWorkspaceMembershipInput interface structure", () => {
  const input: AddWorkspaceMembershipInput = {
    workspaceId: "ws_001",
    userId: "user_001",
    role: "admin",
    joinedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(input.workspaceId, "ws_001");
  assert.equal(input.userId, "user_001");
  assert.equal(input.role, "admin");
});

test("CreateOrganizationInput interface structure", () => {
  const input: CreateOrganizationInput = {
    displayName: "Test Org",
    billingAccountId: "bill_001",
    defaultTenantId: "tenant_001",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(input.displayName, "Test Org");
  assert.equal(input.billingAccountId, "bill_001");
});

test("AddOrganizationMembershipInput interface structure", () => {
  const input: AddOrganizationMembershipInput = {
    organizationId: "org_001",
    userId: "user_001",
    role: "member",
    joinedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(input.organizationId, "org_001");
  assert.equal(input.userId, "user_001");
});

test("CreateTenantInput interface structure with encryption config", () => {
  const input: CreateTenantInput = {
    tenantId: "tenant_001",
    organizationId: "org_001",
    storageScope: "regional",
    identityScope: "global",
    policyScope: "regional",
    artifactScope: "global",
    isolationMode: "dedicated",
    deploymentMode: "multi-tenant",
    setAsOrganizationDefault: true,
    encryptionConfig: {
      algorithm: "AES-256-GCM",
      keyRotationPeriodDays: 90,
      enforceHardwareSecurityModule: true,
    },
  };
  assert.equal(input.encryptionConfig?.algorithm, "AES-256-GCM");
  assert.equal(input.encryptionConfig?.keyRotationPeriodDays, 90);
  assert.equal(input.encryptionConfig?.enforceHardwareSecurityModule, true);
});

test("CreateDeploymentBindingInput interface structure", () => {
  const input: CreateDeploymentBindingInput = {
    bindingId: "binding_001",
    tenantId: "tenant_001",
    environmentId: "env_001",
    deploymentMode: "single-tenant",
    region: "us-east-1",
    networkBoundary: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(input.deploymentMode, "single-tenant");
  assert.equal(input.region, "us-east-1");
});

test("CreateDataNamespaceInput interface structure", () => {
  const input: CreateDataNamespaceInput = {
    namespaceId: "ns_001",
    plane: "control-plane",
    tenantId: "tenant_001",
    organizationId: "org_001",
    workspaceId: "ws_001",
    retentionPolicy: "90-days",
    encryptionPolicy: "standard",
    residencyPolicy: "us-east",
  };
  assert.equal(input.plane, "control-plane");
  assert.equal(input.retentionPolicy, "90-days");
});

test("TenantLifecycleInput interface structure", () => {
  const input: TenantLifecycleInput = {
    tenantId: "tenant_001",
    actor: "admin_001",
    reason: "Scheduled maintenance",
  };
  assert.equal(input.tenantId, "tenant_001");
  assert.equal(input.actor, "admin_001");
});

test("DedicatedPoolIsolationRecord interface structure", () => {
  const record: DedicatedPoolIsolationRecord = {
    tenantId: "tenant_001",
    organizationId: "org_001",
    resourcePool: { poolId: "pool_001", capacity: 100 } as any,
    routingPolicy: "dedicated_pool_only",
    executionIsolation: "tenant_scoped_worker_pool",
    provisionedAt: "2026-01-01T00:00:00.000Z",
    quotaScopeId: "quota_001",
  };
  assert.equal(record.routingPolicy, "dedicated_pool_only");
  assert.equal(record.executionIsolation, "tenant_scoped_worker_pool");
});

test("TenantLifecycleStage type accepts all valid values", () => {
  const stages: TenantLifecycleStage[] = [
    "provisioning",
    "active",
    "suspended",
    "deactivated",
    "decommissioned",
  ];
  for (const stage of stages) {
    const result = toTenantStatus(stage);
    assert.ok(typeof result === "string", `Invalid stage: ${stage}`);
  }
});

test("TenantTopologySummary interface structure", () => {
  const summary: TenantTopologySummary = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    counts: {
      workspaces: 5,
      workspaceMemberships: 10,
      organizations: 2,
      organizationMemberships: 8,
      tenants: 3,
      deploymentBindings: 6,
      dataNamespaces: 9,
    },
    workspaces: [],
    organizations: [],
    tenants: [],
    deploymentBindings: [],
    dataNamespaces: [],
  };
  assert.equal(summary.counts.workspaces, 5);
  assert.equal(summary.counts.tenants, 3);
});