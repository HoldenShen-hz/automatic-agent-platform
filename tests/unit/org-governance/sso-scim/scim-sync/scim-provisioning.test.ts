/**
 * Comprehensive Tests: SCIM Sync Module
 *
 * Tests ScimProvisioningEventSchema, isTerminalScimAction,
 * and all exported types from the scim-sync module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ScimProvisioningEventSchema,
  isTerminalScimAction,
  ScimUserSchema,
  ScimGroupSchema,
} from "../../../../src/org-governance/sso-scim/scim-sync/index.js";

import type { ScimUser, ScimGroup, ScimProvisioningEvent } from "../../../../src/org-governance/sso-scim/scim-sync/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisioningEventSchema Full Coverage Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScimProvisioningEventSchema parses user_created event", () => {
  const event = {
    eventId: "evt_abc123",
    action: "user_created",
    subjectId: "user_xyz",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.eventId, "evt_abc123");
    assert.equal(result.data.action, "user_created");
    assert.equal(result.data.subjectId, "user_xyz");
  }
});

test("ScimProvisioningEventSchema parses user_updated event", () => {
  const event = {
    eventId: "evt_update",
    action: "user_updated",
    subjectId: "user_456",
    occurredAt: "2026-05-01T11:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, true);
  assert.equal(result.data?.action, "user_updated");
});

test("ScimProvisioningEventSchema parses user_disabled event", () => {
  const event = {
    eventId: "evt_disable",
    action: "user_disabled",
    subjectId: "user_disabled_123",
    occurredAt: "2026-05-01T12:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, true);
  assert.equal(result.data?.action, "user_disabled");
});

test("ScimProvisioningEventSchema parses user_deleted event", () => {
  const event = {
    eventId: "evt_delete",
    action: "user_deleted",
    subjectId: "user_deleted_456",
    occurredAt: "2026-05-01T13:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, true);
  assert.equal(result.data?.action, "user_deleted");
});

test("ScimProvisioningEventSchema parses group_updated event", () => {
  const event = {
    eventId: "evt_group",
    action: "group_updated",
    subjectId: "group_789",
    occurredAt: "2026-05-01T14:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, true);
  assert.equal(result.data?.action, "group_updated");
});

test("ScimProvisioningEventSchema rejects unknown action", () => {
  const event = {
    eventId: "evt_unknown",
    action: "user_renamed",
    subjectId: "user_123",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema rejects missing eventId", () => {
  const event = {
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema rejects empty eventId", () => {
  const event = {
    eventId: "",
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema rejects missing subjectId", () => {
  const event = {
    eventId: "evt_123",
    action: "user_created",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema rejects empty subjectId", () => {
  const event = {
    eventId: "evt_123",
    action: "user_created",
    subjectId: "",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema rejects missing occurredAt", () => {
  const event = {
    eventId: "evt_123",
    action: "user_created",
    subjectId: "user_123",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema rejects empty occurredAt", () => {
  const event = {
    eventId: "evt_123",
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// isTerminalScimAction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isTerminalScimAction returns true for user_disabled", () => {
  assert.equal(isTerminalScimAction("user_disabled"), true);
});

test("isTerminalScimAction returns true for user_deleted", () => {
  assert.equal(isTerminalScimAction("user_deleted"), true);
});

test("isTerminalScimAction returns false for user_created", () => {
  assert.equal(isTerminalScimAction("user_created"), false);
});

test("isTerminalScimAction returns false for user_updated", () => {
  assert.equal(isTerminalScimAction("user_updated"), false);
});

test("isTerminalScimAction returns false for group_updated", () => {
  assert.equal(isTerminalScimAction("group_updated"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimUserSchema and ScimGroupSchema Constants
// ─────────────────────────────────────────────────────────────────────────────

test("ScimUserSchema has correct schema identifier", () => {
  assert.ok(ScimUserSchema.schemas.includes("urn:ietf:params:scim:schemas:core:2.0:User"));
});

test("ScimUserSchema has correct resourceType", () => {
  assert.equal(ScimUserSchema.meta.resourceType, "User");
});

test("ScimGroupSchema has correct schema identifier", () => {
  assert.ok(ScimGroupSchema.schemas.includes("urn:ietf:params:scim:schemas:core:2.0:Group"));
});

test("ScimGroupSchema has correct resourceType", () => {
  assert.equal(ScimGroupSchema.meta.resourceType, "Group");
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Inference Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScimProvisioningEvent type allows all valid actions", () => {
  const actions: ScimProvisioningEvent["action"][] = [
    "user_created",
    "user_updated",
    "user_disabled",
    "user_deleted",
    "group_updated",
  ];

  for (const action of actions) {
    const event: ScimProvisioningEvent = {
      eventId: "test",
      action,
      subjectId: "subject",
      occurredAt: "2026-05-01T00:00:00.000Z",
    };
    assert.equal(event.action, action);
  }
});

test("ScimUser type can be constructed with required fields", () => {
  const user: ScimUser = {
    id: "user_123",
    userName: "testuser",
    displayName: "Test User",
    name: {
      formatted: "Test User",
      familyName: "User",
      givenName: "Test",
    },
    emails: [{ value: "test@example.com", primary: true }],
    active: true,
    groups: [],
    meta: {
      resourceType: "User",
      created: "2026-05-01T00:00:00.000Z",
      lastModified: "2026-05-01T00:00:00.000Z",
    },
  };

  assert.equal(user.id, "user_123");
  assert.equal(user.userName, "testuser");
  assert.ok(user.name.formatted.includes("Test"));
});

test("ScimGroup type can be constructed with required fields", () => {
  const group: ScimGroup = {
    id: "group_456",
    displayName: "Test Group",
    members: [{ value: "user_1", display: "User One" }],
    meta: {
      resourceType: "Group",
      created: "2026-05-01T00:00:00.000Z",
      lastModified: "2026-05-01T00:00:00.000Z",
    },
  };

  assert.equal(group.id, "group_456");
  assert.equal(group.displayName, "Test Group");
  assert.equal(group.members.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ScimProvisioningEventSchema accepts event with all fields", () => {
  const event = {
    eventId: "evt_complete",
    action: "user_created" as const,
    subjectId: "user_complete",
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.safeParse(event);

  assert.equal(result.success, true);
});

test("ScimProvisioningEventSchema type inference preserves literal types", () => {
  const parsed = ScimProvisioningEventSchema.parse({
    eventId: "evt_literal",
    action: "user_created",
    subjectId: "user_literal",
    occurredAt: "2026-05-01T10:00:00.000Z",
  });

  // The action should be the literal type, not a wider string type
  type ActionType = typeof parsed.action;
  const _typeCheck: ActionType = "user_created" as const;
  assert.equal(parsed.action, "user_created");
});