/**
 * Unit tests for SCIM Provision Service
 * Tests tenant isolation, SCIM CRUD operations, filtering, and bulk operations
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  ScimProvisionService,
  createScimProvisionService,
  isTerminalScimAction,
  type ScimUser,
  type ScimGroup,
  type ScimListResponse,
  type ScimBulkRequest,
  type ScimPatchOperation,
  type ScimProvisionEvent,
} from "../../../../../src/org-governance/sso-scim/scim-sync/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestUser(overrides?: Partial<Omit<ScimUser, "id" | "meta">>): Omit<ScimUser, "id" | "meta"> {
  return {
    userName: "testuser",
    name: { formatted: "Test User", familyName: "User", givenName: "Test" },
    displayName: "Test User",
    emails: [{ value: "test@example.com", primary: true }],
    active: true,
    groups: [],
    ...overrides,
  };
}

function createTestGroup(overrides?: Partial<{ displayName: string; members?: readonly { value: string; display: string }[] }>): { displayName: string; members?: readonly { value: string; display: string }[] } {
  return {
    displayName: "Test Group",
    members: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// isTerminalScimAction Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("isTerminalScimAction", () => {
  it("should return true for user_disabled", () => {
    assert.strictEqual(isTerminalScimAction("user_disabled"), true);
  });

  it("should return true for user_deleted", () => {
    assert.strictEqual(isTerminalScimAction("user_deleted"), true);
  });

  it("should return false for user_created", () => {
    assert.strictEqual(isTerminalScimAction("user_created"), false);
  });

  it("should return false for user_updated", () => {
    assert.strictEqual(isTerminalScimAction("user_updated"), false);
  });

  it("should return false for group_updated", () => {
    assert.strictEqual(isTerminalScimAction("group_updated"), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - User Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - User CRUD", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  describe("createUser", () => {
    it("should create user with generated id and timestamps", () => {
      const userData = createTestUser({ userName: "john.doe" });
      const user = service.createUser(userData, "tenant-1");

      assert.ok(user.id.length > 0);
      assert.strictEqual(user.userName, "john.doe");
      assert.strictEqual(user.displayName, "Test User");
      assert.strictEqual(user.active, true);
      assert.ok(user.meta.created.length > 0);
      assert.ok(user.meta.lastModified.length > 0);
      assert.strictEqual(user.meta.resourceType, "User");
    });

    it("should track user by username (case-insensitive)", () => {
      const userData = createTestUser({ userName: "jane.doe" });
      service.createUser(userData, "tenant-1");

      const found = service.getUserByUsername("jane.doe", "tenant-1");
      assert.ok(found !== null);
      assert.strictEqual(found!.userName, "jane.doe");

      // Case insensitive
      const foundLower = service.getUserByUsername("JANE.DOE", "tenant-1");
      assert.ok(foundLower !== null);
    });

    it("should track user by primary email (case-insensitive)", () => {
      const userData = createTestUser({
        userName: "email.user",
        emails: [{ value: "Email.Test@Example.COM", primary: true }],
      });
      service.createUser(userData, "tenant-1");

      const found = service.getUserByEmail("email.test@example.com", "tenant-1");
      assert.ok(found !== null);
    });

    it("should throw when username already exists", () => {
      const userData = createTestUser({ userName: "duplicate" });
      service.createUser(userData, "tenant-1");

      assert.throws(
        () => service.createUser(userData, "tenant-1"),
        /userName_already_exists/,
      );
    });

    it("should record user_created event", () => {
      service.createUser(createTestUser({ userName: "event.user" }), "tenant-event");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-event");
      assert.ok(events.some((e) => e.action === "user_created"));
    });
  });

  describe("getUser", () => {
    it("should return user by id and tenant", () => {
      const userData = createTestUser({ userName: "get.user" });
      const created = service.createUser(userData, "tenant-1");

      const found = service.getUser(created.id, "tenant-1");
      assert.ok(found !== null);
      assert.strictEqual(found!.id, created.id);
    });

    it("should return null for non-existent id", () => {
      const found = service.getUser("non-existent-id", "tenant-1");
      assert.strictEqual(found, null);
    });

    it("should return null for user in different tenant", () => {
      const userData = createTestUser({ userName: "tenant.user" });
      service.createUser(userData, "tenant-1");

      const found = service.getUser(userData.userName, "tenant-2"); // wrong tenant
      assert.strictEqual(found, null);
    });
  });

  describe("updateUser", () => {
    it("should update user fields", () => {
      const userData = createTestUser({ userName: "update.user", displayName: "Old Name" });
      const created = service.createUser(userData, "tenant-1");

      const updated = service.updateUser(created.id, { displayName: "New Name" }, "tenant-1");

      assert.ok(updated !== null);
      assert.strictEqual(updated!.displayName, "New Name");
    });

    it("should update lastModified timestamp", () => {
      const userData = createTestUser({ userName: "ts.user" });
      const created = service.createUser(userData, "tenant-1");
      const originalLastModified = created.meta.lastModified;

      // Wait a tiny bit to ensure time difference
      const start = Date.now();
      while (Date.now() - start < 5) { /* spin */ }

      const updated = service.updateUser(created.id, { displayName: "Updated" }, "tenant-1");
      assert.ok(updated!.meta.lastModified > originalLastModified);
    });

    it("should return null for non-existent user", () => {
      const updated = service.updateUser("non-existent-id", { displayName: "New" }, "tenant-1");
      assert.strictEqual(updated, null);
    });

    it("should update username index on username change", () => {
      const userData = createTestUser({ userName: "old.username" });
      const created = service.createUser(userData, "tenant-1");

      service.updateUser(created.id, { userName: "new.username" }, "tenant-1");

      assert.strictEqual(service.getUserByUsername("old.username", "tenant-1"), null);
      assert.ok(service.getUserByUsername("new.username", "tenant-1") !== null);
    });

    it("should record user_updated event", () => {
      const userData = createTestUser({ userName: "updated.user" });
      const created = service.createUser(userData, "tenant-update");

      service.updateUser(created.id, { displayName: "Updated" }, "tenant-update");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-update");
      assert.ok(events.some((e) => e.action === "user_updated"));
    });
  });

  describe("disableUser", () => {
    it("should set active to false", () => {
      const userData = createTestUser({ userName: "disable.user" });
      const created = service.createUser(userData, "tenant-1");

      const disabled = service.disableUser(created.id, "tenant-1");

      assert.ok(disabled !== null);
      assert.strictEqual(disabled!.active, false);
    });

    it("should return null for non-existent user", () => {
      const disabled = service.disableUser("non-existent-id", "tenant-1");
      assert.strictEqual(disabled, null);
    });
  });

  describe("deleteUser", () => {
    it("should remove user from storage and indexes", () => {
      const userData = createTestUser({ userName: "delete.user" });
      const created = service.createUser(userData, "tenant-1");

      const deleted = service.deleteUser(created.id, "tenant-1");

      assert.strictEqual(deleted, true);
      assert.strictEqual(service.getUser(created.id, "tenant-1"), null);
      assert.strictEqual(service.getUserByUsername("delete.user", "tenant-1"), null);
    });

    it("should return false for non-existent user", () => {
      const deleted = service.deleteUser("non-existent-id", "tenant-1");
      assert.strictEqual(deleted, false);
    });

    it("should remove user from all groups", () => {
      const userData = createTestUser({ userName: "group.remove.user" });
      const created = service.createUser(userData, "tenant-1");
      const group = service.createGroup({ displayName: "Remove Group" }, "tenant-1");
      service.addMemberToGroup(group.id, created.id, "tenant-1");

      service.deleteUser(created.id, "tenant-1");

      const updatedGroup = service.getGroup(group.id, "tenant-1");
      assert.ok(!updatedGroup!.members.some((m) => m.value === created.id));
    });

    it("should record user_deleted event", () => {
      const userData = createTestUser({ userName: "deleted.user" });
      const created = service.createUser(userData, "tenant-delete");

      service.deleteUser(created.id, "tenant-delete");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-delete");
      assert.ok(events.some((e) => e.action === "user_deleted"));
    });
  });

  describe("getUserCount", () => {
    it("should return correct count across all tenants", () => {
      assert.strictEqual(service.getUserCount(), 0);

      service.createUser(createTestUser({ userName: "count.user1" }), "tenant-1");
      service.createUser(createTestUser({ userName: "count.user2" }), "tenant-1");
      service.createUser(createTestUser({ userName: "count.user3" }), "tenant-2");

      assert.strictEqual(service.getUserCount(), 3);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Tenant Isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - Tenant Isolation", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  it("should isolate users between tenants", () => {
    const user1 = service.createUser(createTestUser({ userName: "tenant1.user" }), "tenant-1");
    service.createUser(createTestUser({ userName: "tenant2.user" }), "tenant-2");

    const foundInTenant1 = service.getUser(user1.id, "tenant-1");
    const foundInTenant2 = service.getUser(user1.id, "tenant-2");

    assert.ok(foundInTenant1 !== null);
    assert.strictEqual(foundInTenant2, null);
  });

  it("should isolate groups between tenants", () => {
    const group1 = service.createGroup({ displayName: "Tenant1 Group" }, "tenant-1");
    service.createGroup({ displayName: "Tenant2 Group" }, "tenant-2");

    const foundInTenant1 = service.getGroup(group1.id, "tenant-1");
    const foundInTenant2 = service.getGroup(group1.id, "tenant-2");

    assert.ok(foundInTenant1 !== null);
    assert.strictEqual(foundInTenant2, null);
  });

  it("should isolate provision events by tenant", () => {
    service.createUser(createTestUser({ userName: "tenant1.user" }), "tenant-1");
    service.createUser(createTestUser({ userName: "tenant2.user" }), "tenant-2");

    const tenant1Events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");
    const tenant2Events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-2");

    assert.strictEqual(tenant1Events.length, 1);
    assert.strictEqual(tenant2Events.length, 1);
    assert.strictEqual(tenant1Events[0].tenantId, "tenant-1");
    assert.strictEqual(tenant2Events[0].tenantId, "tenant-2");
  });

  it("should filter events by timestamp", () => {
    // Get events before creating user
    const beforeEvents = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-time");
    const beforeCount = beforeEvents.length;

    service.createUser(createTestUser({ userName: "time.user" }), "tenant-time");

    // Get events after creating user - should have more
    const afterEvents = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-time");
    assert.ok(afterEvents.length > beforeCount);
  });

  it("should return empty events for non-existent tenant", () => {
    const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "non-existent-tenant");
    assert.strictEqual(events.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Group Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - Group CRUD", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  describe("createGroup", () => {
    it("should create group with generated id", () => {
      const groupData = createTestGroup({ displayName: "Engineering" });
      const group = service.createGroup(groupData, "tenant-1");

      assert.ok(group.id.length > 0);
      assert.strictEqual(group.displayName, "Engineering");
      assert.deepStrictEqual(group.members, []);
      assert.strictEqual(group.meta.resourceType, "Group");
    });

    it("should track group by displayName (case-insensitive)", () => {
      service.createGroup({ displayName: "Marketing" }, "tenant-1");

      const found = service.getGroupByName("MARKETING", "tenant-1");
      assert.ok(found !== null);
      assert.strictEqual(found!.displayName, "Marketing");
    });

    it("should record group_updated event", () => {
      service.createGroup({ displayName: "Event Group" }, "tenant-event");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-event");
      assert.ok(events.some((e) => e.action === "group_updated"));
    });
  });

  describe("getGroup", () => {
    it("should return group by id and tenant", () => {
      const groupData = createTestGroup({ displayName: "Get Group" });
      const created = service.createGroup(groupData, "tenant-1");

      const found = service.getGroup(created.id, "tenant-1");
      assert.ok(found !== null);
      assert.strictEqual(found!.id, created.id);
    });

    it("should return null for non-existent group", () => {
      const found = service.getGroup("non-existent-id", "tenant-1");
      assert.strictEqual(found, null);
    });
  });

  describe("updateGroup", () => {
    it("should update group displayName", () => {
      const group = service.createGroup({ displayName: "Old Name" }, "tenant-1");

      const updated = service.updateGroup(group.id, { displayName: "New Name" }, "tenant-1");

      assert.ok(updated !== null);
      assert.strictEqual(updated!.displayName, "New Name");
    });

    it("should update group members", () => {
      const group = service.createGroup({ displayName: "Members Group" }, "tenant-1");

      const updated = service.updateGroup(group.id, {
        members: [{ value: "user-1", display: "User 1" }],
      }, "tenant-1");

      assert.ok(updated !== null);
      assert.strictEqual(updated!.members.length, 1);
    });

    it("should return null for non-existent group", () => {
      const updated = service.updateGroup("non-existent-id", { displayName: "New" }, "tenant-1");
      assert.strictEqual(updated, null);
    });

    it("should update name index on displayName change", () => {
      const group = service.createGroup({ displayName: "old.name" }, "tenant-1");

      service.updateGroup(group.id, { displayName: "new.name" }, "tenant-1");

      assert.strictEqual(service.getGroupByName("old.name", "tenant-1"), null);
      assert.ok(service.getGroupByName("new.name", "tenant-1") !== null);
    });
  });

  describe("deleteGroup", () => {
    it("should remove group", () => {
      const group = service.createGroup({ displayName: "Delete Me" }, "tenant-1");

      const deleted = service.deleteGroup(group.id, "tenant-1");

      assert.strictEqual(deleted, true);
      assert.strictEqual(service.getGroup(group.id, "tenant-1"), null);
    });

    it("should return false for non-existent group", () => {
      const deleted = service.deleteGroup("non-existent-id", "tenant-1");
      assert.strictEqual(deleted, false);
    });

    it("should update user group references when deleted", () => {
      const user = service.createUser(createTestUser({
        userName: "orphan.user",
        groups: [],
      }), "tenant-1");
      const group = service.createGroup({ displayName: "Orphan Group" }, "tenant-1");

      // Add user to group
      service.addMemberToGroup(group.id, user.id, "tenant-1");
      service.deleteGroup(group.id, "tenant-1");

      // User's groups should be updated (empty since group is gone)
      const updatedUser = service.getUser(user.id, "tenant-1");
      assert.ok(!updatedUser!.groups.some((g) => g.value === group.id));
    });
  });

  describe("addMemberToGroup", () => {
    it("should add member to group", () => {
      const user = service.createUser(createTestUser({ userName: "member.user" }), "tenant-1");
      const group = service.createGroup({ displayName: "Team" }, "tenant-1");

      const updated = service.addMemberToGroup(group.id, user.id, "tenant-1");

      assert.ok(updated !== null);
      assert.ok(updated.members.some((m) => m.value === user.id));
    });

    it("should not add duplicate member", () => {
      const user = service.createUser(createTestUser({ userName: "dup.user" }), "tenant-1");
      const group = service.createGroup({ displayName: "DupGroup" }, "tenant-1");

      service.addMemberToGroup(group.id, user.id, "tenant-1");
      service.addMemberToGroup(group.id, user.id, "tenant-1");

      const found = service.getGroup(group.id, "tenant-1");
      const count = found!.members.filter((m) => m.value === user.id).length;
      assert.strictEqual(count, 1);
    });

    it("should return null for non-existent user", () => {
      const group = service.createGroup({ displayName: "NoUser" }, "tenant-1");

      const result = service.addMemberToGroup(group.id, "non-existent-user", "tenant-1");

      assert.strictEqual(result, null);
    });

    it("should return null for non-existent group", () => {
      const result = service.addMemberToGroup("non-existent-group", "user-id", "tenant-1");

      assert.strictEqual(result, null);
    });
  });

  describe("removeMemberFromGroup", () => {
    it("should remove member from group", () => {
      const user = service.createUser(createTestUser({ userName: "remove.user" }), "tenant-1");
      const group = service.createGroup({ displayName: "RemoveGroup" }, "tenant-1");
      service.addMemberToGroup(group.id, user.id, "tenant-1");

      const updated = service.removeMemberFromGroup(group.id, user.id, "tenant-1");

      assert.ok(updated !== null);
      assert.ok(!updated.members.some((m) => m.value === user.id));
    });

    it("should return null for non-existent group", () => {
      const result = service.removeMemberFromGroup("non-existent-group", "user-id", "tenant-1");
      assert.strictEqual(result, null);
    });
  });

  describe("getGroupCount", () => {
    it("should return correct count across all tenants", () => {
      assert.strictEqual(service.getGroupCount(), 0);

      service.createGroup({ displayName: "Group 1" }, "tenant-1");
      service.createGroup({ displayName: "Group 2" }, "tenant-2");

      assert.strictEqual(service.getGroupCount(), 2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Listing and Filtering
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - listUsers", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
    service.createUser(createTestUser({ userName: "alice.smith" }), "tenant-1");
    service.createUser(createTestUser({ userName: "bob.jones" }), "tenant-1");
    service.createUser(createTestUser({ userName: "charlie.brown" }), "tenant-1");
    service.createUser(createTestUser({ userName: "alice.wonderland" }), "tenant-1");
  });

  it("should list all users with no filter", () => {
    const result = service.listUsers({ tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 4);
    assert.strictEqual(result.Resources.length, 4);
  });

  it("should filter by userName eq", () => {
    const result = service.listUsers({ filter: 'userName eq "alice.smith"', tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 1);
    assert.strictEqual(result.Resources[0].userName, "alice.smith");
  });

  it("should filter by userName ne", () => {
    const result = service.listUsers({ filter: 'userName ne "alice.smith"', tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 3);
    assert.ok(result.Resources.every((u) => u.userName !== "alice.smith"));
  });

  it("should filter by userName co (contains)", () => {
    const result = service.listUsers({ filter: 'userName co "alice"', tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 2);
    assert.ok(result.Resources.every((u) => u.userName.includes("alice")));
  });

  it("should filter by userName sw (starts with)", () => {
    const result = service.listUsers({ filter: 'userName sw "bob"', tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 1);
    assert.strictEqual(result.Resources[0].userName, "bob.jones");
  });

  it("should be case-insensitive", () => {
    const result = service.listUsers({ filter: 'userName eq "ALICE.SMITH"', tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 1);
    assert.strictEqual(result.Resources[0].userName, "alice.smith");
  });

  it("should paginate results", () => {
    const page1 = service.listUsers({ startIndex: 1, count: 2, tenantId: "tenant-1" });
    const page2 = service.listUsers({ startIndex: 3, count: 2, tenantId: "tenant-1" });

    assert.strictEqual(page1.totalResults, 4);
    assert.strictEqual(page1.Resources.length, 2);
    assert.strictEqual(page1.startIndex, 1);
    assert.strictEqual(page1.itemsPerPage, 2);

    assert.strictEqual(page2.startIndex, 3);
    assert.strictEqual(page2.Resources.length, 2);
  });

  it("should handle startIndex beyond results", () => {
    const result = service.listUsers({ startIndex: 100, count: 10, tenantId: "tenant-1" });

    assert.strictEqual(result.Resources.length, 0);
  });
});

describe("ScimProvisionService - listGroups", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
    service.createGroup({ displayName: "Alpha Team" }, "tenant-1");
    service.createGroup({ displayName: "Beta Team" }, "tenant-1");
    service.createGroup({ displayName: "Alpha Division" }, "tenant-1");
  });

  it("should list all groups with no filter", () => {
    const result = service.listGroups({ tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 3);
  });

  it("should filter by displayName", () => {
    const result = service.listGroups({ filter: 'displayName co "Alpha"', tenantId: "tenant-1" });

    assert.strictEqual(result.totalResults, 2);
    assert.ok(result.Resources.every((g) => g.displayName.includes("Alpha")));
  });

  it("should paginate results", () => {
    const page1 = service.listGroups({ startIndex: 1, count: 2, tenantId: "tenant-1" });

    assert.strictEqual(page1.totalResults, 3);
    assert.strictEqual(page1.Resources.length, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Patch Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - patchGroup", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  it("should add members via patch", () => {
    const group = service.createGroup({ displayName: "Patch Group" }, "tenant-1");
    const user = service.createUser(createTestUser({ userName: "patch.user" }), "tenant-1");

    const result = service.patchGroup(group.id, [
      { op: "add", path: "members", value: [{ value: user.id }] },
    ], "tenant-1");

    assert.ok(result !== null);
    assert.ok(result.members.some((m) => m.value === user.id));
  });

  it("should replace members via patch", () => {
    const group = service.createGroup({ displayName: "Replace Group" }, "tenant-1");
    const user2 = service.createUser(createTestUser({ userName: "replace.user2" }), "tenant-1");

    const result = service.patchGroup(group.id, [
      { op: "replace", path: "members", value: [{ value: user2.id }] },
    ], "tenant-1");

    assert.ok(result !== null);
    assert.strictEqual(result.members.length, 1);
    assert.ok(result.members.some((m) => m.value === user2.id));
  });

  it("should remove specific member via patch with filter", () => {
    const group = service.createGroup({ displayName: "Remove Group" }, "tenant-1");
    const user1 = service.createUser(createTestUser({ userName: "remove.user1" }), "tenant-1");
    const user2 = service.createUser(createTestUser({ userName: "remove.user2" }), "tenant-1");

    service.addMemberToGroup(group.id, user1.id, "tenant-1");
    service.addMemberToGroup(group.id, user2.id, "tenant-1");

    const result = service.patchGroup(group.id, [
      { op: "remove", path: `members[value eq "${user1.id}"]` },
    ], "tenant-1");

    assert.ok(result !== null);
    assert.ok(!result.members.some((m) => m.value === user1.id));
    assert.ok(result.members.some((m) => m.value === user2.id));
  });

  it("should return null for non-existent group", () => {
    const result = service.patchGroup("non-existent", [
      { op: "add", path: "members", value: [] },
    ], "tenant-1");

    assert.strictEqual(result, null);
  });
});

describe("ScimProvisionService - patchUser", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  it("should replace active status via patch", () => {
    const user = service.createUser(createTestUser({ userName: "patch.active" }), "tenant-1");

    // Use bulk PATCH via processBulkRequest
    const result = service.processBulkRequest({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
      Operations: [
        {
          method: "PATCH",
          path: `/Users/${user.id}`,
          data: [{ op: "replace", path: "active", value: false }],
        },
      ],
    }, "tenant-1");

    assert.strictEqual(result.Operations[0].status, "200");
    const updated = service.getUser(user.id, "tenant-1");
    assert.strictEqual(updated!.active, false);
  });

  it("should replace displayName via patch", () => {
    const user = service.createUser(createTestUser({ userName: "patch.name", displayName: "Old" }), "tenant-1");

    const result = service.processBulkRequest({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
      Operations: [
        {
          method: "PATCH",
          path: `/Users/${user.id}`,
          data: [{ op: "replace", path: "displayName", value: "New Name" }],
        },
      ],
    }, "tenant-1");

    assert.strictEqual(result.Operations[0].status, "200");
    const updated = service.getUser(user.id, "tenant-1");
    assert.strictEqual(updated!.displayName, "New Name");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Bulk Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - processBulkRequest", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  describe("POST operations", () => {
    it("should create user via bulk POST", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "POST",
            path: "/Users",
            data: {
              userName: "bulk.user1",
              name: { formatted: "Bulk User 1", familyName: "User", givenName: "Bulk" },
              displayName: "Bulk User 1",
              emails: [{ value: "bulk1@example.com", primary: true }],
              active: true,
              groups: [],
            },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations.length, 1);
      assert.strictEqual(response.Operations[0].status, "201");
      assert.ok((response.Operations[0].response as ScimUser).id !== undefined);
    });

    it("should create group via bulk POST", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "POST",
            path: "/Groups",
            data: { displayName: "Bulk Group", members: [] },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "201");
    });

    it("should handle bulkId references", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "POST",
            path: "/Users",
            bulkId: "new-user",
            data: {
              userName: "ref.user",
              name: { formatted: "Ref User", familyName: "User", givenName: "Ref" },
              displayName: "Ref User",
              emails: [{ value: "ref@example.com", primary: true }],
              active: true,
              groups: [],
            },
          },
          {
            method: "POST",
            path: "/Groups",
            bulkId: "new-group",
            data: { displayName: "Ref Group", members: [] },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "201");
      assert.strictEqual(response.Operations[1].status, "201");
    });
  });

  describe("PUT operations", () => {
    it("should update user via bulk PUT", () => {
      const user = service.createUser(createTestUser({ userName: "bulk.put.user" }), "tenant-bulk");

      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "PUT",
            path: `/Users/${user.id}`,
            data: { displayName: "Updated via PUT" },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "200");
      const updated = service.getUser(user.id, "tenant-bulk");
      assert.strictEqual(updated!.displayName, "Updated via PUT");
    });

    it("should return 400 for non-existent user", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "PUT",
            path: "/Users/non-existent-id",
            data: { displayName: "Update" },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "400");
      assert.ok((response.Operations[0].response as { detail: string }).detail.includes("user_not_found"));
    });
  });

  describe("DELETE operations", () => {
    it("should delete user via bulk DELETE", () => {
      const user = service.createUser(createTestUser({ userName: "bulk.delete" }), "tenant-bulk");

      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "DELETE",
            path: `/Users/${user.id}`,
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "204");
      assert.strictEqual(service.getUser(user.id, "tenant-bulk"), null);
    });
  });

  describe("failOnErrors", () => {
    it("should skip operations after failOnErrors threshold", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        failOnErrors: 1,
        Operations: [
          {
            method: "POST",
            path: "/Users",
            data: {}, // Invalid - missing required fields
          },
          {
            method: "POST",
            path: "/Users",
            data: {
              userName: "should-skip",
              name: { formatted: "Skip", familyName: "Skip", givenName: "Skip" },
              displayName: "Skip",
              emails: [{ value: "skip@example.com", primary: true }],
              active: true,
              groups: [],
            },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[1].status, "424");
    });
  });

  describe("bulkId resolution", () => {
    it("should resolve bulkId references in path", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "POST",
            path: "/Users",
            bulkId: "user-ref",
            data: {
              userName: "resolve.user",
              name: { formatted: "Resolve", familyName: "User", givenName: "Resolve" },
              displayName: "Resolve User",
              emails: [{ value: "resolve@example.com", primary: true }],
              active: true,
              groups: [],
            },
          },
          {
            method: "POST",
            path: "/Groups",
            bulkId: "group-ref",
            data: { displayName: "Referenced Group", members: [] },
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "201");
      assert.strictEqual(response.Operations[1].status, "201");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createScimProvisionService Factory Function
// ─────────────────────────────────────────────────────────────────────────────

describe("createScimProvisionService", () => {
  it("should create service instance", () => {
    const service = createScimProvisionService();
    assert.ok(service instanceof ScimProvisionService);
  });
});