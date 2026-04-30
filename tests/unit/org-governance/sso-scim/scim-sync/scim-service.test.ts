/**
 * Unit tests for SCIM Provision Service
 * Tests tenant isolation and SCIM filter
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  ScimProvisionService,
  createScimProvisionService,
  type ScimUser,
  type ScimGroup,
  type ScimListResponse,
  type ScimBulkRequest,
  type ScimPatchOperation,
} from "../../../../../../src/org-governance/sso-scim/scim-sync/scim-service.js";

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
// ScimProvisionService - Basic User Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - User Operations", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  describe("createUser", () => {
    it("should create user with generated id", () => {
      const userData = createTestUser({ userName: "john.doe" });
      const user = service.createUser(userData, "tenant-1");

      assert.ok(user.id.length > 0);
      assert.strictEqual(user.userName, "john.doe");
      assert.strictEqual(user.displayName, "Test User");
      assert.strictEqual(user.active, true);
      assert.ok(user.meta.created.length > 0);
      assert.ok(user.meta.lastModified.length > 0);
    });

    it("should track user by username", () => {
      const userData = createTestUser({ userName: "jane.doe" });
      service.createUser(userData, "tenant-1");

      const found = service.getUserByUsername("jane.doe");
      assert.ok(found !== null);
      assert.strictEqual(found!.userName, "jane.doe");
    });

    it("should track user by email", () => {
      const userData = createTestUser({
        userName: "email.user",
        emails: [{ value: "email.test@example.com", primary: true }],
      });
      service.createUser(userData, "tenant-1");

      const found = service.getUserByEmail("email.test@example.com");
      assert.ok(found !== null);
      assert.strictEqual(found!.emails[0].value, "email.test@example.com");
    });

    it("should be case-insensitive for email lookup", () => {
      const userData = createTestUser({
        userName: "case.user",
        emails: [{ value: "Case.User@Example.COM", primary: true }],
      });
      service.createUser(userData, "tenant-1");

      const found = service.getUserByEmail("case.user@example.com");
      assert.ok(found !== null);
    });

    it("should record provision event", () => {
      const userData = createTestUser({ userName: "event.user" });
      service.createUser(userData, "tenant-event");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-event");
      assert.ok(events.some(e => e.action === "user_created" && e.subjectId.length > 0));
    });
  });

  describe("getUser", () => {
    it("should return user by id", () => {
      const userData = createTestUser({ userName: "get.user" });
      const created = service.createUser(userData, "tenant-1");

      const found = service.getUser(created.id);
      assert.ok(found !== null);
      assert.strictEqual(found!.id, created.id);
    });

    it("should return null for non-existent id", () => {
      const found = service.getUser("non-existent-id");
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
      assert.strictEqual(updated!.meta.lastModified, created.meta.lastModified);
    });

    it("should return null for non-existent user", () => {
      const updated = service.updateUser("non-existent-id", { displayName: "New" }, "tenant-1");
      assert.strictEqual(updated, null);
    });

    it("should update username index on username change", () => {
      const userData = createTestUser({ userName: "old.username" });
      const created = service.createUser(userData, "tenant-1");

      service.updateUser(created.id, { userName: "new.username" }, "tenant-1");

      assert.strictEqual(service.getUserByUsername("old.username"), null);
      assert.ok(service.getUserByUsername("new.username") !== null);
    });

    it("should update email index on email change", () => {
      const userData = createTestUser({
        userName: "email.update",
        emails: [{ value: "old.email@example.com", primary: true }],
      });
      const created = service.createUser(userData, "tenant-1");

      service.updateUser(created.id, {
        emails: [{ value: "new.email@example.com", primary: true }],
      }, "tenant-1");

      assert.strictEqual(service.getUserByEmail("old.email@example.com"), null);
      assert.ok(service.getUserByEmail("new.email@example.com") !== null);
    });

    it("should record user_updated event", () => {
      const userData = createTestUser({ userName: "updated.user" });
      const created = service.createUser(userData, "tenant-update");

      service.updateUser(created.id, { displayName: "Updated" }, "tenant-update");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-update");
      assert.ok(events.some(e => e.action === "user_updated"));
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
  });

  describe("deleteUser", () => {
    it("should remove user from storage", () => {
      const userData = createTestUser({ userName: "delete.user" });
      const created = service.createUser(userData, "tenant-1");

      const deleted = service.deleteUser(created.id, "tenant-1");

      assert.strictEqual(deleted, true);
      assert.strictEqual(service.getUser(created.id), null);
      assert.strictEqual(service.getUserByUsername("delete.user"), null);
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

      const updatedGroup = service.getGroup(group.id);
      assert.ok(!updatedGroup!.members.some(m => m.value === created.id));
    });

    it("should record user_deleted event", () => {
      const userData = createTestUser({ userName: "deleted.user" });
      const created = service.createUser(userData, "tenant-delete");

      service.deleteUser(created.id, "tenant-delete");

      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-delete");
      assert.ok(events.some(e => e.action === "user_deleted"));
    });
  });

  describe("getUserCount", () => {
    it("should return correct count", () => {
      assert.strictEqual(service.getUserCount(), 0);

      service.createUser(createTestUser({ userName: "count.user1" }), "tenant-1");
      service.createUser(createTestUser({ userName: "count.user2" }), "tenant-1");

      assert.strictEqual(service.getUserCount(), 2);
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

  describe("getProvisionEvents", () => {
    it("should only return events for specified tenant", () => {
      const user1 = service.createUser(createTestUser({ userName: "tenant1.user" }), "tenant-1");
      const user2 = service.createUser(createTestUser({ userName: "tenant2.user" }), "tenant-2");
      const user3 = service.createUser(createTestUser({ userName: "tenant1.user2" }), "tenant-1");

      service.deleteUser(user2.id, "tenant-2");

      const tenant1Events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");
      const tenant2Events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-2");

      // Tenant 1 should have 2 user_created events
      assert.strictEqual(tenant1Events.filter(e => e.action === "user_created").length, 2);
      // Tenant 2 should have 1 user_created + 1 user_deleted event
      assert.strictEqual(tenant2Events.filter(e => e.action === "user_created").length, 1);
      assert.strictEqual(tenant2Events.filter(e => e.action === "user_deleted").length, 1);
    });

    it("should filter events by timestamp", () => {
      const before = new Date().toISOString();
      const user = service.createUser(createTestUser({ userName: "time.user" }), "tenant-time");
      const after = new Date().toISOString();

      const beforeEvents = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-time");
      const afterEvents = service.getProvisionEvents(after, "tenant-time");

      assert.ok(beforeEvents.length > afterEvents.length);
    });

    it("should return empty array when no events for tenant", () => {
      const events = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "non-existent-tenant");
      assert.strictEqual(events.length, 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - SCIM Filter
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - SCIM Filter", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();

    // Create test users
    service.createUser(createTestUser({ userName: "alice.smith" }), "tenant-1");
    service.createUser(createTestUser({ userName: "bob.jones" }), "tenant-1");
    service.createUser(createTestUser({ userName: "charlie.brown" }), "tenant-1");
    service.createUser(createTestUser({ userName: "alice.wonderland" }), "tenant-1");
  });

  describe("listUsers with filter", () => {
    it("should filter by userName eq", () => {
      const result = service.listUsers({ filter: 'userName eq "alice.smith"' });

      assert.strictEqual(result.totalResults, 1);
      assert.strictEqual(result.Resources[0].userName, "alice.smith");
    });

    it("should filter by userName ne", () => {
      const result = service.listUsers({ filter: 'userName ne "alice.smith"' });

      assert.strictEqual(result.totalResults, 3);
      assert.ok(result.Resources.every(u => u.userName !== "alice.smith"));
    });

    it("should filter by userName co (contains)", () => {
      const result = service.listUsers({ filter: 'userName co "alice"' });

      assert.strictEqual(result.totalResults, 2);
      assert.ok(result.Resources.every(u => u.userName.includes("alice")));
    });

    it("should filter by userName sw (starts with)", () => {
      const result = service.listUsers({ filter: 'userName sw "bob"' });

      assert.strictEqual(result.totalResults, 1);
      assert.strictEqual(result.Resources[0].userName, "bob.jones");
    });

    it("should be case-insensitive", () => {
      const result = service.listUsers({ filter: 'userName eq "ALICE.SMITH"' });

      assert.strictEqual(result.totalResults, 1);
      assert.strictEqual(result.Resources[0].userName, "alice.smith");
    });

    it("should return all users for unrecognized filter", () => {
      const result = service.listUsers({ filter: 'unknown eq "value"' });

      assert.strictEqual(result.totalResults, 4);
    });

    it("should return all users when no filter provided", () => {
      const result = service.listUsers({});

      assert.strictEqual(result.totalResults, 4);
    });
  });

  describe("pagination", () => {
    it("should paginate results", () => {
      const page1 = service.listUsers({ startIndex: 1, count: 2 });
      const page2 = service.listUsers({ startIndex: 3, count: 2 });

      assert.strictEqual(page1.totalResults, 4);
      assert.strictEqual(page1.Resources.length, 2);
      assert.strictEqual(page1.startIndex, 1);
      assert.strictEqual(page1.itemsPerPage, 2);

      assert.strictEqual(page2.startIndex, 3);
      assert.strictEqual(page2.Resources.length, 2);
    });

    it("should handle startIndex beyond results", () => {
      const result = service.listUsers({ startIndex: 100, count: 10 });

      assert.strictEqual(result.Resources.length, 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Group Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - Group Operations", () => {
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
    });

    it("should track group by displayName", () => {
      service.createGroup({ displayName: "Marketing" }, "tenant-1");

      const found = service.getGroupByName("marketing");
      assert.ok(found !== null);
      assert.strictEqual(found!.displayName, "Marketing");
    });
  });

  describe("addMemberToGroup", () => {
    it("should add member to group", () => {
      const user = service.createUser(createTestUser({ userName: "member.user" }), "tenant-1");
      const group = service.createGroup({ displayName: "Team" }, "tenant-1");

      const updated = service.addMemberToGroup(group.id, user.id, "tenant-1");

      assert.ok(updated !== null);
      assert.ok(updated.members.some(m => m.value === user.id));
    });

    it("should not add duplicate member", () => {
      const user = service.createUser(createTestUser({ userName: "dup.user" }), "tenant-1");
      const group = service.createGroup({ displayName: "DupGroup" }, "tenant-1");

      service.addMemberToGroup(group.id, user.id, "tenant-1");
      service.addMemberToGroup(group.id, user.id, "tenant-1");

      const found = service.getGroup(group.id);
      const count = found!.members.filter(m => m.value === user.id).length;
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

      const updated = service.removeMemberFromGroup(group.id, user.id);

      assert.ok(updated !== null);
      assert.ok(!updated.members.some(m => m.value === user.id));
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
  });

  describe("deleteGroup", () => {
    it("should remove group", () => {
      const group = service.createGroup({ displayName: "Delete Me" }, "tenant-1");

      const deleted = service.deleteGroup(group.id, "tenant-1");

      assert.strictEqual(deleted, true);
      assert.strictEqual(service.getGroup(group.id), null);
    });

    it("should update user group references", () => {
      const user = service.createUser(createTestUser({
        userName: "orphan.user",
        groups: [{ value: "old-group", display: "Old Group" }],
      }), "tenant-1");
      const group = service.createGroup({ displayName: "Orphan Group" }, "tenant-1");

      // Manually add user to group index
      service.addMemberToGroup(group.id, user.id, "tenant-1");
      service.deleteGroup(group.id, "tenant-1");

      // User's groups should be updated
      const updatedUser = service.getUser(user.id);
      assert.ok(!updatedUser!.groups.some(g => g.value === group.id));
    });
  });

  describe("listGroups with filter", () => {
    it("should filter groups by displayName", () => {
      service.createGroup({ displayName: "Alpha Team" }, "tenant-1");
      service.createGroup({ displayName: "Beta Team" }, "tenant-1");
      service.createGroup({ displayName: "Alpha Division" }, "tenant-1");

      const result = service.listGroups({ filter: 'displayName co "Alpha"' });

      assert.strictEqual(result.totalResults, 2);
      assert.ok(result.Resources.every(g => g.displayName.includes("Alpha")));
    });
  });

  describe("getGroupCount", () => {
    it("should return correct count", () => {
      assert.strictEqual(service.getGroupCount(), 0);

      service.createGroup({ displayName: "Group 1" }, "tenant-1");
      service.createGroup({ displayName: "Group 2" }, "tenant-1");

      assert.strictEqual(service.getGroupCount(), 2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimProvisionService - Bulk Operations
// ─────────────────────────────────────────────────────────────────────────────

describe("ScimProvisionService - Bulk Operations", () => {
  let service: ScimProvisionService;

  beforeEach(() => {
    service = new ScimProvisionService();
  });

  describe("processBulkRequest", () => {
    it("should create users via bulk POST", () => {
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

      // Both should succeed
      assert.strictEqual(response.Operations[0].status, "201");
      assert.strictEqual(response.Operations[1].status, "201");
    });

    it("should skip operations after failOnErrors threshold", () => {
      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        failOnErrors: 1,
        Operations: [
          {
            method: "POST",
            path: "/Users/invalid-id",
            data: {},
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

      // Second operation should be skipped due to failOnErrors
      assert.strictEqual(response.Operations[1].status, "424");
    });

    it("should handle DELETE operations", () => {
      const user = service.createUser(createTestUser({ userName: "delete.bulk" }), "tenant-bulk");

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
      assert.strictEqual(service.getUser(user.id), null);
    });

    it("should handle PATCH operations on groups", () => {
      const group = service.createGroup({ displayName: "Patch Group" }, "tenant-bulk");
      const user = service.createUser(createTestUser({ userName: "patch.user" }), "tenant-bulk");

      const request: ScimBulkRequest = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
        Operations: [
          {
            method: "PATCH",
            path: `/Groups/${group.id}`,
            data: [
              { op: "add", path: "members", value: [{ value: user.id }] },
            ],
          },
        ],
      };

      const response = service.processBulkRequest(request, "tenant-bulk");

      assert.strictEqual(response.Operations[0].status, "200");

      const updated = service.getGroup(group.id);
      assert.ok(updated!.members.some(m => m.value === user.id));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

describe("createScimProvisionService", () => {
  it("should create service instance", () => {
    const service = createScimProvisionService();
    assert.ok(service instanceof ScimProvisionService);
  });
});
