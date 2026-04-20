import assert from "node:assert/strict";
import test from "node:test";

import { ScimProvisionService, createScimProvisionService } from "../../../../../src/org-governance/sso-scim/scim-sync/scim-service.js";

function createTestUser(overrides: Partial<{
  userName: string;
  displayName: string;
  emails: { value: string; primary: boolean }[];
  active: boolean;
}> = {}) {
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

function createTestGroup(overrides: Partial<{
  displayName: string;
  members: { value: string; display: string }[];
}> = {}) {
  return {
    displayName: "Test Group",
    members: [],
    ...overrides,
  };
}

test("ScimProvisionService creates user", () => {
  const service = new ScimProvisionService();

  const user = service.createUser(createTestUser(), "tenant-1");

  assert.ok(user.id);
  assert.equal(user.userName, "testuser");
  assert.equal(user.displayName, "Test User");
  assert.equal(user.meta.resourceType, "User");
});

test("ScimProvisionService creates user and records event", () => {
  const service = new ScimProvisionService();

  service.createUser(createTestUser(), "tenant-1");

  const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");

  assert.equal(events.length, 1);
  assert.equal(events[0].action, "user_created");
});

test("ScimProvisionService gets user by id", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const retrieved = service.getUser(created.id);

  assert.ok(retrieved);
  assert.equal(retrieved!.id, created.id);
  assert.equal(retrieved!.userName, "testuser");
});

test("ScimProvisionService gets user by username", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser(), "tenant-1");

  const retrieved = service.getUserByUsername("testuser");

  assert.ok(retrieved);
  assert.equal(retrieved!.userName, "testuser");
});

test("ScimProvisionService gets user by email", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser(), "tenant-1");

  const retrieved = service.getUserByEmail("test@example.com");

  assert.ok(retrieved);
  assert.equal(retrieved!.emails[0].value, "test@example.com");
});

test("ScimProvisionService returns null for non-existent user", () => {
  const service = new ScimProvisionService();

  const retrieved = service.getUser("non-existent");

  assert.equal(retrieved, null);
});

test("ScimProvisionService updates user", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const updated = service.updateUser(created.id, { displayName: "Updated Name" }, "tenant-1");

  assert.ok(updated);
  assert.equal(updated!.displayName, "Updated Name");
  // Verify timestamp is updated (may be same millisecond but should be valid ISO string)
  assert.ok(updated!.meta.lastModified);
});

test("ScimProvisionService disables user", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const disabled = service.disableUser(created.id, "tenant-1");

  assert.ok(disabled);
  assert.equal(disabled!.active, false);
});

test("ScimProvisionService deletes user", () => {
  const service = new ScimProvisionService();
  const created = service.createUser(createTestUser(), "tenant-1");

  const deleted = service.deleteUser(created.id, "tenant-1");

  assert.equal(deleted, true);
  assert.equal(service.getUser(created.id), null);
});

test("ScimProvisionService deletes user and removes from groups", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");
  const group = service.createGroup(createTestGroup(), "tenant-1");
  service.addMemberToGroup(group.id, user.id, "tenant-1");

  service.deleteUser(user.id, "tenant-1");

  const updatedGroup = service.getGroup(group.id);
  assert.ok(!updatedGroup!.members.some((m) => m.value === user.id));
});

test("ScimProvisionService lists users", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "user1" }), "tenant-1");
  service.createUser(createTestUser({ userName: "user2" }), "tenant-1");

  const result = service.listUsers({});

  assert.equal(result.totalResults, 2);
  assert.equal(result.Resources.length, 2);
});

test("ScimProvisionService lists users with pagination", () => {
  const service = new ScimProvisionService();
  for (let i = 0; i < 10; i++) {
    service.createUser(createTestUser({ userName: `user${i}` }), "tenant-1");
  }

  const result = service.listUsers({ startIndex: 1, count: 5 });

  assert.equal(result.totalResults, 10);
  assert.equal(result.Resources.length, 5);
  assert.equal(result.startIndex, 1);
  assert.equal(result.itemsPerPage, 5);
});

test("ScimProvisionService creates group", () => {
  const service = new ScimProvisionService();

  const group = service.createGroup(createTestGroup(), "tenant-1");

  assert.ok(group.id);
  assert.equal(group.displayName, "Test Group");
  assert.equal(group.meta.resourceType, "Group");
});

test("ScimProvisionService gets group by id", () => {
  const service = new ScimProvisionService();
  const created = service.createGroup(createTestGroup(), "tenant-1");

  const retrieved = service.getGroup(created.id);

  assert.ok(retrieved);
  assert.equal(retrieved!.id, created.id);
});

test("ScimProvisionService gets group by name", () => {
  const service = new ScimProvisionService();
  service.createGroup(createTestGroup({ displayName: "Engineering" }), "tenant-1");

  const retrieved = service.getGroupByName("Engineering");

  assert.ok(retrieved);
  assert.equal(retrieved!.displayName, "Engineering");
});

test("ScimProvisionService updates group", () => {
  const service = new ScimProvisionService();
  const created = service.createGroup(createTestGroup(), "tenant-1");

  const updated = service.updateGroup(created.id, { displayName: "Updated Group" }, "tenant-1");

  assert.ok(updated);
  assert.equal(updated!.displayName, "Updated Group");
});

test("ScimProvisionService adds member to group", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");
  const group = service.createGroup(createTestGroup(), "tenant-1");

  const updated = service.addMemberToGroup(group.id, user.id, "tenant-1");

  assert.ok(updated);
  assert.ok(updated!.members.some((m) => m.value === user.id));
});

test("ScimProvisionService removes member from group", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");
  const group = service.createGroup(createTestGroup(), "tenant-1");
  service.addMemberToGroup(group.id, user.id, "tenant-1");

  const updated = service.removeMemberFromGroup(group.id, user.id);

  assert.ok(updated);
  assert.ok(!updated!.members.some((m) => m.value === user.id));
});

test("ScimProvisionService patch group adds members", () => {
  const service = new ScimProvisionService();
  const user1 = service.createUser(createTestUser({ userName: "user1" }), "tenant-1");
  const user2 = service.createUser(createTestUser({ userName: "user2" }), "tenant-1");
  const group = service.createGroup(createTestGroup(), "tenant-1");

  const updated = service.patchGroup(group.id, [
    { op: "add", path: "members", value: [{ value: user1.id }, { value: user2.id }] },
  ], "tenant-1");

  assert.ok(updated);
  assert.equal(updated!.members.length, 2);
});

test("ScimProvisionService patch group removes members", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");
  const group = service.createGroup(createTestGroup(), "tenant-1");
  service.addMemberToGroup(group.id, user.id, "tenant-1");

  const updated = service.patchGroup(group.id, [
    { op: "remove", path: "members" },
  ], "tenant-1");

  assert.ok(updated);
  assert.equal(updated!.members.length, 0);
});

test("ScimProvisionService lists groups", () => {
  const service = new ScimProvisionService();
  service.createGroup(createTestGroup({ displayName: "Group1" }), "tenant-1");
  service.createGroup(createTestGroup({ displayName: "Group2" }), "tenant-1");

  const result = service.listGroups({});

  assert.equal(result.totalResults, 2);
  assert.equal(result.Resources.length, 2);
});

test("ScimProvisionService deletes group", () => {
  const service = new ScimProvisionService();
  const created = service.createGroup(createTestGroup(), "tenant-1");

  const deleted = service.deleteGroup(created.id, "tenant-1");

  assert.equal(deleted, true);
  assert.equal(service.getGroup(created.id), null);
});

test("ScimProvisionService gets provision events", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(createTestUser(), "tenant-1");
  service.updateUser(user.id, { displayName: "Updated" }, "tenant-1");

  const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");

  assert.equal(events.length, 2);
  assert.equal(events[0].action, "user_created");
  assert.equal(events[1].action, "user_updated");
});

test("ScimProvisionService filters provision events by tenant", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser(), "tenant-1");
  service.createUser(createTestUser({ userName: "user2" }), "tenant-2");

  const eventsTenant1 = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");
  const eventsTenant2 = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-2");

  assert.equal(eventsTenant1.length, 1);
  assert.equal(eventsTenant2.length, 1);
});

test("ScimProvisionService getUserCount and getGroupCount", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser(), "tenant-1");
  service.createUser(createTestUser({ userName: "user2" }), "tenant-1");
  service.createGroup(createTestGroup(), "tenant-1");

  assert.equal(service.getUserCount(), 2);
  assert.equal(service.getGroupCount(), 1);
});

test("ScimProvisionService filters users by username", () => {
  const service = new ScimProvisionService();
  service.createUser(createTestUser({ userName: "john.doe" }), "tenant-1");
  service.createUser(createTestUser({ userName: "jane.doe" }), "tenant-1");
  service.createUser(createTestUser({ userName: "bob.smith" }), "tenant-1");

  const result = service.listUsers({ filter: "userName co \"doe\"" });

  assert.equal(result.totalResults, 2);
});

test("ScimProvisionService filters groups by displayName", () => {
  const service = new ScimProvisionService();
  service.createGroup(createTestGroup({ displayName: "Engineering" }), "tenant-1");
  service.createGroup(createTestGroup({ displayName: "Sales" }), "tenant-1");
  service.createGroup(createTestGroup({ displayName: "HR" }), "tenant-1");

  const result = service.listGroups({ filter: "displayName sw \"E\"" });

  assert.equal(result.totalResults, 1);
});

test("createScimProvisionService factory works", () => {
  const service = createScimProvisionService();

  const user = service.createUser(createTestUser(), "tenant-1");

  assert.ok(user);
  assert.ok(user.id);
});
