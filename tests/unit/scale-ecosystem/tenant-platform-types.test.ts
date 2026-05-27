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

test("tenant-platform-types: assertIdentifier accepts valid identifiers [tenant-platform-types]", () => {
  const validIds = ["abc", "abc123", "a.b.c", "a:b:c", "a_b_c", "a-b-c"];
  for (const id of validIds) {
    const result = assertIdentifier(id, "TEST_ERROR");
    assert.equal(result, id);
  }
});

test("tenant-platform-types: assertIdentifier rejects invalid identifiers [tenant-platform-types]", () => {
  const invalidIds = ["", "a", "a!", "a b", "a@b"];
  for (const id of invalidIds) {
    assert.throws(
      () => assertIdentifier(id, "TEST_ERROR"),
      (err: unknown) => (err as Error).message.includes("TEST_ERROR")
    );
  }
});

test("tenant-platform-types: assertIdentifier rejects identifiers shorter than 2 chars [tenant-platform-types]", () => {
  assert.throws(
    () => assertIdentifier("a", "TOO_SHORT"),
    (err: unknown) => (err as Error).message.includes("TOO_SHORT")
  );
});

test("tenant-platform-types: assertIdentifier rejects identifiers longer than 128 chars [tenant-platform-types]", () => {
  const longId = "a".repeat(129);
  assert.throws(
    () => assertIdentifier(longId, "TOO_LONG"),
    (err: unknown) => (err as Error).message.includes("TOO_LONG")
  );
});

test("tenant-platform-types: assertNonEmpty accepts non-empty strings [tenant-platform-types]", () => {
  const result = assertNonEmpty("hello", "EMPTY_ERROR");
  assert.equal(result, "hello");
});

test("tenant-platform-types: assertNonEmpty trims whitespace [tenant-platform-types]", () => {
  const result = assertNonEmpty("  hello  ", "EMPTY_ERROR");
  assert.equal(result, "hello");
});

test("tenant-platform-types: assertNonEmpty rejects empty strings [tenant-platform-types]", () => {
  assert.throws(
    () => assertNonEmpty("", "EMPTY_ERROR"),
    (err: unknown) => (err as Error).message.includes("EMPTY_ERROR")
  );
});

test("tenant-platform-types: assertNonEmpty rejects whitespace-only strings [tenant-platform-types]", () => {
  assert.throws(
    () => assertNonEmpty("   ", "EMPTY_ERROR"),
    (err: unknown) => (err as Error).message.includes("EMPTY_ERROR")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Stage Conversion Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: toTenantStatus converts provisioning to active [tenant-platform-types]", () => {
  assert.equal(toTenantStatus("provisioning"), "active");
});

test("tenant-platform-types: toTenantStatus converts active to active [tenant-platform-types]", () => {
  assert.equal(toTenantStatus("active"), "active");
});

test("tenant-platform-types: toTenantStatus converts suspended to suspended [tenant-platform-types]", () => {
  assert.equal(toTenantStatus("suspended"), "suspended");
});

test("tenant-platform-types: toTenantStatus converts deactivated to active [tenant-platform-types]", () => {
  assert.equal(toTenantStatus("deactivated"), "active");
});

test("tenant-platform-types: toTenantStatus converts decommissioned to terminated [tenant-platform-types]", () => {
  assert.equal(toTenantStatus("decommissioned"), "terminated");
});

test("tenant-platform-types: fromTenantStatus converts suspended [tenant-platform-types]", () => {
  assert.equal(fromTenantStatus("suspended"), "suspended");
});

test("tenant-platform-types: fromTenantStatus converts terminated to decommissioned [tenant-platform-types]", () => {
  assert.equal(fromTenantStatus("terminated"), "decommissioned");
});

test("tenant-platform-types: fromTenantStatus converts active to active [tenant-platform-types]", () => {
  assert.equal(fromTenantStatus("active"), "active");
});

test("tenant-platform-types: fromTenantStatus converts undefined to active [tenant-platform-types]", () => {
  assert.equal(fromTenantStatus(undefined), "active");
});

// ─────────────────────────────────────────────────────────────────────────────
// Valid Lifecycle Transitions Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS provisioning allows active [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.provisioning.includes("active"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS provisioning allows decommissioned [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.provisioning.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS active allows suspended [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.active.includes("suspended"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS active allows deactivated [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.active.includes("deactivated"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS active allows decommissioned [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.active.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS suspended allows active [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.suspended.includes("active"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS suspended allows deactivated [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.suspended.includes("deactivated"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS suspended allows decommissioned [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.suspended.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS deactivated allows active [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.deactivated.includes("active"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS deactivated allows decommissioned [tenant-platform-types]", () => {
  assert.ok(VALID_LIFECYCLE_TRANSITIONS.deactivated.includes("decommissioned"));
});

test("tenant-platform-types: VALID_LIFECYCLE_TRANSITIONS decommissioned has no transitions [tenant-platform-types]", () => {
  assert.equal(VALID_LIFECYCLE_TRANSITIONS.decommissioned.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Interfaces Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tenant-platform-types: CreateWorkspaceInput accepts valid input [tenant-platform-types]", () => {
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

test("tenant-platform-types: CreateWorkspaceInput allows optional organizationId [tenant-platform-types]", () => {
  const input: CreateWorkspaceInput = {
    ownerId: "user-1",
    displayName: "Test Workspace",
    planId: "plan-1",
    organizationId: "org-1",
  };

  assert.equal(input.organizationId, "org-1");
});

test("tenant-platform-types: AddWorkspaceMembershipInput accepts valid input [tenant-platform-types]", () => {
  const input: AddWorkspaceMembershipInput = {
    workspaceId: "ws-1",
    userId: "user-1",
    role: "member",
  };

  assert.equal(input.workspaceId, "ws-1");
  assert.equal(input.userId, "user-1");
  assert.equal(input.role, "member");
});

test("tenant-platform-types: CreateOrganizationInput accepts valid input [tenant-platform-types]", () => {
  const input: CreateOrganizationInput = {
    displayName: "Test Org",
    billingAccountId: "billing-1",
  };

  assert.equal(input.displayName, "Test Org");
  assert.equal(input.billingAccountId, "billing-1");
});

test("tenant-platform-types: AddOrganizationMembershipInput accepts valid input [tenant-platform-types]", () => {
  const input: AddOrganizationMembershipInput = {
    organizationId: "org-1",
    userId: "user-1",
    role: "admin",
  };

  assert.equal(input.organizationId, "org-1");
  assert.equal(input.userId, "user-1");
  assert.equal(input.role, "admin");
});

test("tenant-platform-types: CreateTenantInput accepts all fields [tenant-platform-types]", () => {
  const input: CreateTenantInput = {
    tenantId: "tenant-1",
    organizationId: "org-1",
    storageScope: "region-us",
    identityScope: "region-us",
    policyScope: "region-us",
    artifactScope: "region-us",
    isolationMode: "dedicated_environment",
    deploymentMode: "private_cloud",
  };

  assert.equal(input.tenantId, "tenant-1");
  assert.equal(input.isolationMode, "dedicated_environment");
  assert.equal(input.deploymentMode, "private_cloud");
});

test("tenant-platform-types: CreateTenantInput allows optional encryption config [tenant-platform-types]", () => {
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

test("tenant-platform-types: TenantLifecycleStage has all expected values [tenant-platform-types]", () => {
  const stages: TenantLifecycleStage[] = ["provisioning", "active", "suspended", "deactivated", "decommissioned"];
  for (const stage of stages) {
    assert.ok(VALID_LIFECYCLE_TRANSITIONS[stage] !== undefined);
  }
});
