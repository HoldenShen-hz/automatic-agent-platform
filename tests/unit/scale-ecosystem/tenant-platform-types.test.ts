/**
 * TenantPlatformTypes Unit Tests
 *
 * Tests for tenant-platform/tenant-platform-types.ts - Tenant platform type definitions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  assertIdentifier,
  assertNonEmpty,
  toTenantStatus,
  fromTenantStatus,
  VALID_LIFECYCLE_TRANSITIONS,
  type CreateWorkspaceInput,
  type AddWorkspaceMembershipInput,
  type CreateOrganizationInput,
  type AddOrganizationMembershipInput,
  type CreateTenantInput,
  type TenantLifecycleStage,
} from "../../../src/scale-ecosystem/tenant-platform/tenant-platform-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Assertion Functions Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: assertIdentifier accepts valid identifiers", () => {
  const validIds = ["abc", "abc123", "a.b.c", "a:b:c", "a_b_c", "a-b-c"];
  for (const id of validIds) {
    const result = assertIdentifier(id, "TEST_ERROR");
    assert.equal(result, id);
  }
});

test("tenant-platform-types: assertIdentifier rejects invalid identifiers", () => {
  const invalidIds = ["", "a", "a!", "a b", "a@b"];
  for (const id of invalidIds) {
    assert.throws(
      () => assertIdentifier(id, "TEST_ERROR"),
      (err: unknown) => (err as Error).message.includes("TEST_ERROR")
    );
  }
});

test("tenant-platform-types: assertIdentifier rejects identifiers shorter than 2 chars", () => {
  assert.throws(
    () => assertIdentifier("a", "TOO_SHORT"),
    (err: unknown) => (err as Error).message.includes("TOO_SHORT")
  );
});

test("tenant-platform-types: assertIdentifier rejects identifiers longer than 128 chars", () => {
  const longId = "a".repeat(129);
  assert.throws(
    () => assertIdentifier(longId, "TOO_LONG"),
    (err: unknown) => (err as Error).message.includes("TOO_LONG")
  );
});

test("tenant-platform-types: assertNonEmpty accepts non-empty strings", () => {
  const result = assertNonEmpty("hello", "EMPTY_ERROR");
  assert.equal(result, "hello");
});

test("tenant-platform-types: assertNonEmpty trims whitespace", () => {
  const result = assertNonEmpty("  hello  ", "EMPTY_ERROR");
  assert.equal(result, "hello");
});

test("tenant-platform-types: assertNonEmpty rejects empty strings", () => {
  assert.throws(
    () => assertNonEmpty("", "EMPTY_ERROR"),
    (err: unknown) => (err as Error).message.includes("EMPTY_ERROR")
  );
});

test("tenant-platform-types: assertNonEmpty rejects whitespace-only strings", () => {
  assert.throws(
    () => assertNonEmpty("   ", "EMPTY_ERROR"),
    (err: unknown) => (err as Error).message.includes("EMPTY_ERROR")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Stage Conversion Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: toTenantStatus converts provisioning to active", () => {
  assert.equal(toTenantStatus("provisioning"), "active");
});

test("tenant-platform-types: toTenantStatus converts active to active", () => {
  assert.equal(toTenantStatus("active"), "active");
});

test("tenant-platform-types: toTenantStatus converts suspended to suspended", () => {
  assert.equal(toTenantStatus("suspended"), "suspended");
});

test("tenant-platform-types: toTenantStatus converts deactivated to active", () => {
  assert.equal(toTenantStatus("deactivated"), "active");
});

test("tenant-platform-types: toTenantStatus converts decommissioned to terminated", () => {
  assert.equal(toTenantStatus("decommissioned"), "terminated");
});

test("tenant-platform-types: fromTenantStatus converts suspended", () => {
  assert.equal(fromTenantStatus("suspended"), "suspended");
});

test("tenant-platform-types: fromTenantStatus converts terminated to decommissioned", () => {
  assert.equal(fromTenantStatus("terminated"), "decommissioned");
});

test("tenant-platform-types: fromTenantStatus converts active to active", () => {
  assert.equal(fromTenantStatus("active"), "active");
});

test("tenant-platform-types: fromTenantStatus converts undefined to active", () => {
  assert.equal(fromTenantStatus(undefined), "active");
});

// ─────────────────────────────────────────────────────────────────────────────
// Valid Lifecycle Transitions Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS provisioning allows active", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.provisioning.includes("active"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS provisioning allows decommissioned", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.provisioning.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS active allows suspended", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.active.includes("suspended"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS active allows deactivated", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.active.includes("deactivated"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS active allows decommissioned", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.active.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS suspended allows active", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.suspended.includes("active"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS suspended allows deactivated", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.suspended.includes("deactivated"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS suspended allows decommissioned", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.suspended.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS deactivated allows active", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.deactivated.includes("active"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS deactivated allows decommissioned", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.deactivated.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS decommissioned has no transitions", () => {
  assert.equal(VALID_LIFECYCLE_TRANSITIONS.decommissioned.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Interfaces Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: CreateWorkspaceInput accepts valid input", () => {
  const input: CreateWorkspaceInput = {
    ownerId: "user-1",
    displayName: "Test Workspace",
    planId: "plan-1",
  };

  assert.equal(input.ownerId, "user-1");
  assert.equal(input.displayName, "Test Workspace");
  assert.equal(input.planId, "plan-1");
  assert.equal(input.organizationId, undefined);
});

test("tenant-platform-types: CreateWorkspaceInput allows optional organizationId", () => {
  const input: CreateWorkspaceInput = {
    ownerId: "user-1",
    displayName: "Test Workspace",
    planId: "plan-1",
    organizationId: "org-1",
  };

  assert.equal(input.organizationId, "org-1");
});

test("tenant-platform-types: AddWorkspaceMembershipInput accepts valid input", () => {
  const input: AddWorkspaceMembershipInput = {
    workspaceId: "ws-1",
    userId: "user-1",
    role: "member",
  };

  assert.equal(input.workspaceId, "ws-1");
  assert.equal(input.userId, "user-1");
  assert.equal(input.role, "member");
});

test("tenant-platform-types: CreateOrganizationInput accepts valid input", () => {
  const input: CreateOrganizationInput = {
    displayName: "Test Org",
    billingAccountId: "billing-1",
  };

  assert.equal(input.displayName, "Test Org");
  assert.equal(input.billingAccountId, "billing-1");
});

test("tenant-platform-types: AddOrganizationMembershipInput accepts valid input", () => {
  const input: AddOrganizationMembershipInput = {
    organizationId: "org-1",
    userId: "user-1",
    role: "admin",
  };

  assert.equal(input.organizationId, "org-1");
  assert.equal(input.userId, "user-1");
  assert.equal(input.role, "admin");
});

test("tenant-platform-types: CreateTenantInput accepts all fields", () => {
  const input: CreateTenantInput = {
    tenantId: "tenant-1",
    organizationId: "org-1",
    storageScope: "region-us",
    identityScope: "region-us",
    policyScope: "region-us",
    artifactScope: "region-us",
    isolationMode: "dedicated",
    deploymentMode: "single-tenant",
  };

  assert.equal(input.tenantId, "tenant-1");
  assert.equal(input.isolationMode, "dedicated");
  assert.equal(input.deploymentMode, "single-tenant");
});

test("tenant-platform-types: CreateTenantInput allows optional encryption config", () => {
  const input: CreateTenantInput = {
    organizationId: "org-1",
    storageScope: "region-us",
    identityScope: "region-us",
    policyScope: "region-us",
    artifactScope: "region-us",
    encryptionConfig: {
      algorithm: "aes-256-gcm",
      keyRotationPeriodDays: 90,
      enforceHardwareSecurityModule: true,
    },
  };

  assert.ok(input.encryptionConfig != null);
  assert.equal(input.encryptionConfig?.algorithm, "aes-256-gcm");
  assert.equal(input.encryptionConfig?.keyRotationPeriodDays, 90);
  assert.equal(input.encryptionConfig?.enforceHardwareSecurityModule, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TenantLifecycleStage Type Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: TenantLifecycleStage has all expected values", () => {
  const stages: TenantLifecycleStage[] = ["provisioning", "active", "suspended", "deactivated", "decommissioned"];
  for (const stage of stages) {
    assert.ok(VALID_LIFECYCLE_TRANSITIONS[stage] !== undefined);
  }
});