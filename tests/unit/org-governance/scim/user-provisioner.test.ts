import assert from "node:assert/strict";
import test from "node:test";

import {
  ScimProvisionService,
  createScimProvisionService,
  type ScimUser,
  type ScimPatchOperation,
} from "../../../../../src/org-governance/sso-scim/scim-sync/scim-service.js";

function createTestUser(overrides: Partial<Omit<ScimUser, "id" | "meta">> = {}): Omit<ScimUser, "id" | "meta"> {
  return {
    userName: "testuser",
    displayName: "Test User",
    emails: [{ value: "test@example.com", primary: true }],
    active: true,
    groups: [],
    name: {
      formatted: "Test User",
      familyName: "User",
      givenName: "Test",
    },
    ...overrides,
  };
}

test("UserProvisioner creates user with all required fields", () => {
  const service = new ScimProvisionService();

  const user = service.createUser(createTestUser(), "tenant-1");

  assert.ok(user.id.startsWith("scim_user:"));
  assert.equal(user.userName, "testuser");
  assert.equal(user.displayName, "Test User");
  assert.equal(user.name.formatted, "Test User");
  assert.equal(user.name.familyName, "User");
  assert.equal(user.name.givenName, "Test");
  assert.equal(user.emails[0]!.value, "test@example.com");
  assert.equal(user.emails[0]!.primary, true);
  assert.equal(user.active, true);
  assert.deepEqual(user.groups, []);
  assert.equal(user.meta.resourceType, "User");
  assert.ok(user.meta.created);
  assert.ok(user.meta.lastModified);
});

test("UserProvisioner creates user with multiple emails", () => {
  const service = new ScimProvisionService();

  const user = service.createUser(createTestUser({
    emails: [
      { value: "primary@example.com", primary: true },
      { value: "secondary@example.com", primary: false },
    ],
  }), "tenant-1");

  assert.equal(user.emails.length, 2);
  assert.equal(user.emails[0]!.value, "primary@example.com");
  assert.equal(user.emails[0]!.primary, true);
  assert.equal(user.emails[1]!.value, "secondary@example.com");
  assert.equal(user.emails[1]!.primary, false);
});

test("UserProvisioner creates user with groups", () => {
  const service = new ScimProvisionService();

  const user = service.createUser(createTestUser({
    groups: [{ value: "group-1", display: "Admins" }],
  }), "tenant-1");

  assert.equal(user.groups.length, 1);
  assert.equal(user.groups[0]!.value, "group-1");
  assert.equal(user.groups[0]!.display, "Admins");
});

test("UserProvisioner records user_created event", () => {
  const service = new ScimProvisionService();

  service.createUser(createTestUser(), "tenant-1");

  const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");

  assert.equal(events.length, 1);
  assert.equal(events[0]!.action, "user_created");
  assert.equal(events[0]!.tenantId, "tenant-1");
});

test("UserProvisioner retrieves user by ID", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const retrieved = service.getUser(created.id);

  assert.ok(retrieved);
  assert.equal(retrieved!.id, created.id);
  assert.equal(retrieved!.userName, "testuser");
});

test("UserProvisioner returns null for non-existent user ID", () => {
  const service = new ScimProvisionService();

  const retrieved = service.getUser("non-existent-id");

  assert.equal(retrieved, null);
});

test("UserProvisioner retrieves user by username", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "john.doe" }), "tenant-1");

  const retrieved = service.getUserByUsername("john.doe");

  assert.ok(retrieved);
  assert.equal(retrieved!.userName, "john.doe");
});

test("UserProvisioner retrieves user by username case-insensitively", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "JohnDoe" }), "tenant-1");

  const retrieved = service.getUserByUsername("johndoe");

  assert.ok(retrieved);
  assert.equal(retrieved!.userName, "JohnDoe");
});

test("UserProvisioner returns null for non-existent username", () => {
  const service = new ScimProvisionService();

  const retrieved = service.getUserByUsername("non-existent");

  assert.equal(retrieved, null);
});

test("UserProvisioner retrieves user by email", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ emails: [{ value: "john@example.com", primary: true }] }), "tenant-1");

  const retrieved = service.getUserByEmail("john@example.com");

  assert.ok(retrieved);
  assert.equal(retrieved!.emails[0]!.value, "john@example.com");
});

test("UserProvisioner retrieves user by email case-insensitively", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ emails: [{ value: "John@Example.COM", primary: true }] }), "tenant-1");

  const retrieved = service.getUserByEmail("john@example.com");

  assert.ok(retrieved);
  assert.equal(retrieved!.emails[0]!.value, "John@Example.COM");
});

test("UserProvisioner updates user displayName", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const updated = service.updateUser(created.id, { displayName: "Updated Name" }, "tenant-1");

  assert.ok(updated);
  assert.equal(updated!.displayName, "Updated Name");
  assert.equal(updated!.id, created.id);
});

test("UserProvisioner updates user email", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const updated = service.updateUser(created.id, {
    emails: [{ value: "newemail@example.com", primary: true }],
  }, "tenant-1");

  assert.ok(updated);
  assert.equal(updated!.emails[0]!.value, "newemail@example.com");
});

test("UserProvisioner updates user username and re-indexes", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser({ userName: "oldname" }), "tenant-1");

  service.updateUser(created.id, { userName: "newname" }, "tenant-1");

  assert.equal(service.getUserByUsername("oldname"), null);
  assert.ok(service.getUserByUsername("newname"));
});

test("UserProvisioner records user_updated event", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  service.updateUser(created.id, { displayName: "Updated" }, "tenant-1");

  const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");

  assert.equal(events.length, 2);
  assert.equal(events[0]!.action, "user_created");
  assert.equal(events[1]!.action, "user_updated");
});

test("UserProvisioner disables user (soft delete)", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const disabled = service.disableUser(created.id, "tenant-1");

  assert.ok(disabled);
  assert.equal(disabled!.active, false);
});

test("UserProvisioner records user_disabled event", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  service.disableUser(created.id, "tenant-1");

  const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");

  assert.equal(events.length, 2);
  assert.equal(events[1]!.action, "user_disabled");
});

test("UserProvisioner permanently deletes user", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const deleted = service.deleteUser(created.id, "tenant-1");

  assert.equal(deleted, true);
  assert.equal(service.getUser(created.id), null);
  assert.equal(service.getUserByUsername("testuser"), null);
});

test("UserProvisioner records user_deleted event", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  service.deleteUser(created.id, "tenant-1");

  const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");

  assert.equal(events.length, 2);
  assert.equal(events[1]!.action, "user_deleted");
});

test("UserProvisioner deletes user and removes from groups", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");
  const group = service.createGroup({ displayName: "Test Group" }, "tenant-1");
  service.addMemberToGroup(group.id, user.id, "tenant-1");

  service.deleteUser(user.id, "tenant-1");

  const updatedGroup = service.getGroup(group.id);
  assert.ok(!updatedGroup!.members.some((m) => m.value === user.id));
});

test("UserProvisioner patches user with replace operation", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  service.patchUser(created.id, [
    { op: "replace", path: "displayName", value: "Patched Name" },
  ], "tenant-1");

  const patched = service.getUser(created.id);
  assert.equal(patched!.displayName, "Patched Name");
});

test("UserProvisioner patches user active status", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  service.patchUser(created.id, [
    { op: "replace", path: "active", value: false },
  ], "tenant-1");

  const patched = service.getUser(created.id);
  assert.equal(patched!.active, false);
});

test("UserProvisioner patches user groups to empty", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser({
    groups: [{ value: "group-1", display: "Group 1" }],
  }), "tenant-1");

  service.patchUser(created.id, [
    { op: "remove", path: "groups" },
  ], "tenant-1");

  const patched = service.getUser(created.id);
  assert.deepEqual(patched!.groups, []);
});

test("UserProvisioner lists users with pagination", () => {
  const service = new ScimProvisionService();
  for (let i = 0; i < 15; i++) {
    service.createUser(createTestUser({ userName: `user${i}` }), "tenant-1");
  }

  const page1 = service.listUsers({ startIndex: 1, count: 10 });
  const page2 = service.listUsers({ startIndex: 11, count: 10 });

  assert.equal(page1.totalResults, 15);
  assert.equal(page1.Resources.length, 10);
  assert.equal(page2.Resources.length, 5);
  assert.equal(page1.startIndex, 1);
  assert.equal(page2.startIndex, 11);
});

test("UserProvisioner lists users with filter (equals)", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "alice" }), "tenant-1");
  service.createUser(createTestUser({ userName: "bob" }), "tenant-1");
  service.createUser(createTestUser({ userName: "charlie" }), "tenant-1");

  const result = service.listUsers({ filter: 'userName eq "alice"' });

  assert.equal(result.totalResults, 1);
  assert.equal(result.Resources[0]!.userName, "alice");
});

test("UserProvisioner lists users with filter (contains)", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "alice.smith" }), "tenant-1");
  service.createUser(createTestUser({ userName: "bob.jones" }), "tenant-1");
  service.createUser(createTestUser({ userName: "charlie" }), "tenant-1");

  const result = service.listUsers({ filter: 'userName co "smith"' });

  assert.equal(result.totalResults, 1);
  assert.equal(result.Resources[0]!.userName, "alice.smith");
});

test("UserProvisioner lists users with filter (starts with)", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "alice" }), "tenant-1");
  service.createUser(createTestUser({ userName: "alex" }), "tenant-1");
  service.createUser(createTestUser({ userName: "bob" }), "tenant-1");

  const result = service.listUsers({ filter: 'userName sw "al"' });

  assert.equal(result.totalResults, 2);
});

test("UserProvisioner returns empty list for non-matching filter", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "alice" }), "tenant-1");

  const result = service.listUsers({ filter: 'userName eq "nonexistent"' });

  assert.equal(result.totalResults, 0);
  assert.equal(result.Resources.length, 0);
});

test("UserProvisioner gets user count", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser(), "tenant-1");
  service.createUser(createTestUser({ userName: "user2" }), "tenant-1");
  service.createUser(createTestUser({ userName: "user3" }), "tenant-1");

  assert.equal(service.getUserCount(), 3);
});

test("UserProvisioner filters events by tenant", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser(), "tenant-1");
  service.createUser(createTestUser({ userName: "user2" }), "tenant-2");

  const eventsTenant1 = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");
  const eventsTenant2 = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-2");

  assert.equal(eventsTenant1.length, 1);
  assert.equal(eventsTenant1[0]!.tenantId, "tenant-1");
  assert.equal(eventsTenant2.length, 1);
  assert.equal(eventsTenant2[0]!.tenantId, "tenant-2");
});

test("UserProvisioner filters events by timestamp", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");

  const beforeUpdate = nowIso();
  service.updateUser(user.id, { displayName: "Updated" }, "tenant-1");
  const afterUpdate = nowIso();

  const oldEvents = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");
  const newEvents = service.getProvisionEvents(afterUpdate, "tenant-1");

  assert.ok(oldEvents.length >= 2);
  assert.ok(newEvents.length <= 1);
});

test("createScimProvisionService factory creates working service", () => {
  const service = createScimProvisionService();

  const user = service.createUser(createTestUser(), "tenant-1");

  assert.ok(user);
  assert.ok(user.id);
  assert.equal(service.getUserCount(), 1);
});

// Helper function
function nowIso(): string {
  return new Date().toISOString();
}
