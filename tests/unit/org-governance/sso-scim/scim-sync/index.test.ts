import test from "node:test";
import assert from "node:assert/strict";

import {
  ScimProvisioningEventSchema,
  isTerminalScimAction,
  type ScimProvisioningEvent,
} from "../../../../../src/org-governance/sso-scim/scim-sync/index.js";

test("ScimProvisioningEventSchema accepts valid event with user_created", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("ScimProvisioningEventSchema accepts valid event with user_updated", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "user_updated",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("ScimProvisioningEventSchema accepts valid event with user_disabled", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "user_disabled",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("ScimProvisioningEventSchema accepts valid event with user_deleted", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "user_deleted",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("ScimProvisioningEventSchema accepts valid event with group_updated", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "group_updated",
    subjectId: "group_456",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("ScimProvisioningEventSchema rejects invalid action", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "invalid_action",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema requires eventId", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema requires non-empty eventId", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "",
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema requires subjectId", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "user_created",
    occurredAt: "2026-04-20T10:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("ScimProvisioningEventSchema requires occurredAt", () => {
  const result = ScimProvisioningEventSchema.safeParse({
    eventId: "evt_1",
    action: "user_created",
    subjectId: "user_123",
  });
  assert.equal(result.success, false);
});

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

test("ScimProvisioningEvent type correctly inferres action union", () => {
  const event: ScimProvisioningEvent = {
    eventId: "evt_1",
    action: "user_created",
    subjectId: "user_123",
    occurredAt: "2026-04-20T10:00:00.000Z",
  };
  assert.equal(event.action, "user_created");
});
