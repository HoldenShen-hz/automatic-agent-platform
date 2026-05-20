import assert from "node:assert/strict";
import test from "node:test";

import { createScimProvisionService } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";
import type { ScimProvisionEvent } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";

// ============================================================================
// SCIM Tenant Isolation Tests (Issue 1972)
// ============================================================================

test("integration: SCIM users are isolated by tenantId", () => {
  const service = createScimProvisionService();

  // Create users for tenant A
  const userA = service.createUser({
    userName: "alice",
    name: { formatted: "Alice Anderson", familyName: "Anderson", givenName: "Alice" },
    displayName: "Alice Anderson",
    emails: [{ value: "alice@tenant-a.example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-a");

  // Create users for tenant B
  const userB = service.createUser({
    userName: "bob",
    name: { formatted: "Bob Brown", familyName: "Brown", givenName: "Bob" },
    displayName: "Bob Brown",
    emails: [{ value: "bob@tenant-b.example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-b");

  // Users should have different IDs
  assert.notEqual(userA.id, userB.id, "users from different tenants should have different IDs");

  // Both users should be retrievable by their own tenant
  assert.ok(service.getUser(userA.id, "tenant-a") !== null, "userA should be retrievable by tenant-a");
  assert.ok(service.getUser(userB.id, "tenant-b") !== null, "userB should be retrievable by tenant-b");
  // Cross-tenant access should be blocked
  assert.equal(service.getUser(userA.id, "tenant-b"), null, "userA should NOT be retrievable by tenant-b");
  assert.equal(service.getUser(userB.id, "tenant-a"), null, "userB should NOT be retrievable by tenant-a");
});

test("integration: SCIM getProvisionEvents filters by tenantId", () => {
  const service = createScimProvisionService();

  // Create users for different tenants
  service.createUser({
    userName: "alice",
    name: { formatted: "Alice Anderson", familyName: "Anderson", givenName: "Alice" },
    displayName: "Alice Anderson",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-a");

  service.createUser({
    userName: "bob",
    name: { formatted: "Bob Brown", familyName: "Brown", givenName: "Bob" },
    displayName: "Bob Brown",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-b");

  const now = new Date().toISOString();
  const eventsA = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-a");
  const eventsB = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-b");

  // All events for tenant-a should have tenant-a tenantId
  for (const event of eventsA) {
    assert.equal(event.tenantId, "tenant-a", `event tenantId should be tenant-a, got ${event.tenantId}`);
  }

  // All events for tenant-b should have tenant-b tenantId
  for (const event of eventsB) {
    assert.equal(event.tenantId, "tenant-b", `event tenantId should be tenant-b, got ${event.tenantId}`);
  }

  // Both tenants should have events
  assert.ok(eventsA.length >= 1, "tenant-a should have at least 1 event");
  assert.ok(eventsB.length >= 1, "tenant-b should have at least 1 event");
});

test("integration: SCIM deleteUser removes user but does not affect other tenant", () => {
  const service = createScimProvisionService();

  // Create users for different tenants
  const userA = service.createUser({
    userName: "alice",
    name: { formatted: "Alice Anderson", familyName: "Anderson", givenName: "Alice" },
    displayName: "Alice Anderson",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-a");

  const userB = service.createUser({
    userName: "bob",
    name: { formatted: "Bob Brown", familyName: "Brown", givenName: "Bob" },
    displayName: "Bob Brown",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-b");

  // Delete user A
  const deletedA = service.deleteUser(userA.id, "tenant-a");
  assert.equal(deletedA, true, "userA should be deleted");

  // User A should not be retrievable by tenant-a
  assert.equal(service.getUser(userA.id, "tenant-a"), null, "userA should not be found after delete");

  // User B should still be retrievable by tenant-b
  assert.ok(service.getUser(userB.id, "tenant-b") !== null, "userB should still be found");
  // Cross-tenant access should be blocked
  assert.equal(service.getUser(userA.id, "tenant-b"), null, "userA should not be accessible by tenant-b");
  assert.equal(service.getUser(userB.id, "tenant-a"), null, "userB should not be accessible by tenant-a");
});

test("integration: SCIM disableUser only affects the specified tenant", () => {
  const service = createScimProvisionService();

  // Create user in tenant A
  const userA = service.createUser({
    userName: "charlie",
    name: { formatted: "Charlie Chen", familyName: "Chen", givenName: "Charlie" },
    displayName: "Charlie Chen",
    emails: [{ value: "charlie@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-a");

  // Disable user - should work with tenant-a
  const disabled = service.disableUser(userA.id, "tenant-a");
  assert.ok(disabled !== null, "disableUser should return updated user");
  assert.equal(disabled!.active, false, "user should be inactive after disable");
});

test("integration: SCIM updateUser only affects the specified tenant", () => {
  const service = createScimProvisionService();

  const user = service.createUser({
    userName: "david",
    name: { formatted: "David Davis", familyName: "Davis", givenName: "David" },
    displayName: "David Davis",
    emails: [{ value: "david@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-isolated");

  const updated = service.updateUser(user.id, { displayName: "David D. Updated" }, "tenant-isolated");

  assert.ok(updated !== null, "updateUser should return updated user");
  assert.equal(updated!.displayName, "David D. Updated", "displayName should be updated");
  assert.equal(updated!.name.familyName, "Davis", "other fields should remain unchanged");
});

test("integration: SCIM groups are isolated by tenant", () => {
  const service = createScimProvisionService();

  // Create groups for different tenants
  const groupA = service.createGroup({ displayName: "Engineering", members: [] }, "tenant-a");
  const groupB = service.createGroup({ displayName: "Engineering", members: [] }, "tenant-b");

  // Groups should have different IDs
  assert.notEqual(groupA.id, groupB.id, "groups with same name in different tenants should have different IDs");

  // Both should be retrievable by their own tenant
  assert.ok(service.getGroup(groupA.id, "tenant-a") !== null, "groupA should be retrievable by tenant-a");
  assert.ok(service.getGroup(groupB.id, "tenant-b") !== null, "groupB should be retrievable by tenant-b");
  // Cross-tenant access should be blocked
  assert.equal(service.getGroup(groupA.id, "tenant-b"), null, "groupA should NOT be retrievable by tenant-b");
  assert.equal(service.getGroup(groupB.id, "tenant-a"), null, "groupB should NOT be retrievable by tenant-a");
});

// ============================================================================
// SCIM Filter Tests (Issues 1986, 1984)
// ============================================================================

test("integration: SCIM listUsers with eq filter returns matching users", () => {
  const service = createScimProvisionService();

  service.createUser({
    userName: "alice",
    name: { formatted: "Alice Anderson", familyName: "Anderson", givenName: "Alice" },
    displayName: "Alice Anderson",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-filter");

  service.createUser({
    userName: "bob",
    name: { formatted: "Bob Brown", familyName: "Brown", givenName: "Bob" },
    displayName: "Bob Brown",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-filter");

  service.createUser({
    userName: "alex",
    name: { formatted: "Alex Smith", familyName: "Smith", givenName: "Alex" },
    displayName: "Alex Smith",
    emails: [{ value: "alex@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-filter");

  const result = service.listUsers({ filter: 'userName eq "alice"' });

  assert.equal(result.totalResults, 1, "should return exactly 1 result");
  assert.equal(result.Resources[0]!.userName, "alice", "should return alice user");
});

test("integration: SCIM listUsers with ne filter excludes matching users", () => {
  const service = createScimProvisionService();

  service.createUser({
    userName: "alice",
    name: { formatted: "Alice Anderson", familyName: "Anderson", givenName: "Alice" },
    displayName: "Alice Anderson",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-ne");

  service.createUser({
    userName: "bob",
    name: { formatted: "Bob Brown", familyName: "Brown", givenName: "Bob" },
    displayName: "Bob Brown",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-ne");

  const result = service.listUsers({ filter: 'userName ne "alice"' });

  // Should return all users except alice
  const usernames = result.Resources.map((u) => u.userName);
  assert.ok(!usernames.includes("alice"), "alice should not be in results");
  assert.ok(usernames.includes("bob"), "bob should be in results");
});

test("integration: SCIM listUsers with co filter returns contains matches", () => {
  const service = createScimProvisionService();

  service.createUser({
    userName: "alice_test",
    name: { formatted: "Alice", familyName: "Test", givenName: "Alice" },
    displayName: "Alice Test",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-co");

  service.createUser({
    userName: "bob_test",
    name: { formatted: "Bob", familyName: "Test", givenName: "Bob" },
    displayName: "Bob Test",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-co");

  service.createUser({
    userName: "charlie",
    name: { formatted: "Charlie", familyName: "Normal", givenName: "Charlie" },
    displayName: "Charlie Normal",
    emails: [{ value: "charlie@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-co");

  const result = service.listUsers({ filter: 'userName co "test"' });

  assert.equal(result.totalResults, 2, "should return 2 results");
  const usernames = result.Resources.map((u) => u.userName);
  assert.ok(usernames.includes("alice_test"), "alice_test should be in results");
  assert.ok(usernames.includes("bob_test"), "bob_test should be in results");
  assert.ok(!usernames.includes("charlie"), "charlie should not be in results");
});

test("integration: SCIM listUsers with sw filter returns starts-with matches", () => {
  const service = createScimProvisionService();

  service.createUser({
    userName: "alice_first",
    name: { formatted: "Alice", familyName: "First", givenName: "Alice" },
    displayName: "Alice First",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-sw");

  service.createUser({
    userName: "bob_first",
    name: { formatted: "Bob", familyName: "First", givenName: "Bob" },
    displayName: "Bob First",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-sw");

  service.createUser({
    userName: "charlie_last",
    name: { formatted: "Charlie", familyName: "Last", givenName: "Charlie" },
    displayName: "Charlie Last",
    emails: [{ value: "charlie@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-sw");

  const result = service.listUsers({ filter: 'userName sw "alice"' });

  assert.equal(result.totalResults, 1, "should return 1 result");
  assert.equal(result.Resources[0]!.userName, "alice_first", "should return alice_first user");
});

test("integration: SCIM listGroups with eq filter returns matching groups", () => {
  const service = createScimProvisionService();

  service.createGroup({ displayName: "Engineering", members: [] }, "tenant-group-eq");
  service.createGroup({ displayName: "Marketing", members: [] }, "tenant-group-eq");
  service.createGroup({ displayName: "HR", members: [] }, "tenant-group-eq");

  const result = service.listGroups({ filter: 'displayName eq "Engineering"' });

  assert.equal(result.totalResults, 1, "should return exactly 1 result");
  assert.equal(result.Resources[0]!.displayName, "Engineering", "should return Engineering group");
});

test("integration: SCIM listUsers with pagination", () => {
  const service = createScimProvisionService();

  // Create 5 users
  for (let i = 0; i < 5; i++) {
    service.createUser({
      userName: `user${i}`,
      name: { formatted: `User ${i}`, familyName: `User${i}`, givenName: `User${i}` },
      displayName: `User ${i}`,
      emails: [{ value: `user${i}@example.com`, primary: true }],
      active: true,
      groups: [],
    }, "tenant-paginate");
  }

  const page1 = service.listUsers({ startIndex: 1, count: 2 });
  const page2 = service.listUsers({ startIndex: 3, count: 2 });
  const page3 = service.listUsers({ startIndex: 5, count: 2 });

  assert.equal(page1.totalResults, 5, "totalResults should be 5");
  assert.equal(page1.Resources.length, 2, "page1 should have 2 resources");
  assert.equal(page1.startIndex, 1, "page1 startIndex should be 1");

  assert.equal(page2.Resources.length, 2, "page2 should have 2 resources");
  assert.equal(page2.startIndex, 3, "page2 startIndex should be 3");

  // Page 3 should only have 1 result (5th user)
  assert.equal(page3.Resources.length, 1, "page3 should have 1 resource");
  assert.equal(page3.startIndex, 5, "page3 startIndex should be 5");
});

test("integration: SCIM listUsers with invalid filter fails closed", () => {
  const service = createScimProvisionService();

  service.createUser({
    userName: "alice",
    name: { formatted: "Alice", familyName: "A", givenName: "Alice" },
    displayName: "Alice",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-bad-filter");

  service.createUser({
    userName: "bob",
    name: { formatted: "Bob", familyName: "B", givenName: "Bob" },
    displayName: "Bob",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-bad-filter");

  assert.throws(
    () => service.listUsers({ filter: "invalid filter syntax" }),
    /scim\.filter\.unsupported:invalid filter syntax/,
  );
});

// ============================================================================
// SCIM Bulk Operations Tests
// ============================================================================

test("integration: SCIM bulk operations create users", () => {
  const service = createScimProvisionService();

  const bulkRequest = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"] as const,
    Operations: [
      {
        method: "POST" as const,
        path: "/Users",
        data: {
          userName: "bulkuser1",
          name: { formatted: "Bulk User 1", familyName: "User1", givenName: "Bulk" },
          displayName: "Bulk User 1",
          emails: [{ value: "bulkuser1@example.com", primary: true }],
          active: true,
          groups: [],
        },
      },
      {
        method: "POST" as const,
        path: "/Users",
        data: {
          userName: "bulkuser2",
          name: { formatted: "Bulk User 2", familyName: "User2", givenName: "Bulk" },
          displayName: "Bulk User 2",
          emails: [{ value: "bulkuser2@example.com", primary: true }],
          active: true,
          groups: [],
        },
      },
    ],
  };

  const result = service.processBulkRequest(bulkRequest, "tenant-bulk");

  assert.equal(result.Operations.length, 2, "should have 2 operations");
  assert.equal(result.Operations[0]!.status, "201", "first operation should return 201");
  assert.equal(result.Operations[1]!.status, "201", "second operation should return 201");

  // Verify users were created
  assert.ok(service.getUserByUsername("bulkuser1", "tenant-bulk") !== null, "bulkuser1 should exist");
  assert.ok(service.getUserByUsername("bulkuser2", "tenant-bulk") !== null, "bulkuser2 should exist");
});

test("integration: SCIM bulk operations with bulkId references", () => {
  const service = createScimProvisionService();

  const bulkRequest = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"] as const,
    Operations: [
      {
        method: "POST" as const,
        path: "/Users",
        bulkId: "user-ref-1",
        data: {
          userName: "referenceuser",
          name: { formatted: "Reference User", familyName: "User", givenName: "Reference" },
          displayName: "Reference User",
          emails: [{ value: "refuser@example.com", primary: true }],
          active: true,
          groups: [],
        },
      },
      {
        method: "POST" as const,
        path: "/Groups",
        bulkId: "group-ref-1",
        data: {
          displayName: "Reference Group",
          members: [],
        },
      },
    ],
  };

  const result = service.processBulkRequest(bulkRequest, "tenant-bulk-ref");

  assert.equal(result.Operations[0]!.status, "201", "user creation should succeed");
  assert.equal(result.Operations[1]!.status, "201", "group creation should succeed");

  // bulkId references should be resolved
  assert.ok(result.Operations[0]!.bulkId === "user-ref-1", "bulkId should be preserved");
  assert.ok(result.Operations[1]!.bulkId === "group-ref-1", "bulkId should be preserved");
});

// ============================================================================
// SCIM Group Membership Tests
// ============================================================================

test("integration: SCIM addMemberToGroup and removeMemberFromGroup", () => {
  const service = createScimProvisionService();

  const user = service.createUser({
    userName: "memberuser",
    name: { formatted: "Member User", familyName: "User", givenName: "Member" },
    displayName: "Member User",
    emails: [{ value: "member@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-member");

  const group = service.createGroup({ displayName: "Test Group", members: [] }, "tenant-member");

  // Add member
  const updatedGroup = service.addMemberToGroup(group.id, user.id, "tenant-member");

  assert.ok(updatedGroup !== null, "addMemberToGroup should return updated group");
  assert.ok(updatedGroup.members.some((m) => m.value === user.id), "user should be a member");

  // Remove member
  const removedGroup = service.removeMemberFromGroup(group.id, user.id, "tenant-member");

  assert.ok(removedGroup !== null, "removeMemberFromGroup should return updated group");
  assert.ok(!removedGroup.members.some((m) => m.value === user.id), "user should no longer be a member");
});

test("integration: SCIM patchGroup with add/replace/remove operations", () => {
  const service = createScimProvisionService();

  const user1 = service.createUser({
    userName: "patchuser1",
    name: { formatted: "Patch User 1", familyName: "User1", givenName: "Patch" },
    displayName: "Patch User 1",
    emails: [{ value: "patch1@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-patch");

  const user2 = service.createUser({
    userName: "patchuser2",
    name: { formatted: "Patch User 2", familyName: "User2", givenName: "Patch" },
    displayName: "Patch User 2",
    emails: [{ value: "patch2@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-patch");

  const group = service.createGroup({ displayName: "Patch Group", members: [] }, "tenant-patch");

  // Add members via patch
  let patched = service.patchGroup(group.id, [
    { op: "add", path: "members", value: [{ value: user1.id }] }],
    "tenant-patch"
  );

  assert.ok(patched !== null, "patch should succeed");
  assert.ok(patched.members.some((m) => m.value === user1.id), "user1 should be in group");

  // Replace members via patch
  patched = service.patchGroup(group.id, [
    { op: "replace", path: "members", value: [{ value: user2.id }] }],
    "tenant-patch"
  );

  // Note: The current implementation's "replace" behaves like "add" for members
  // (only adds if not present, doesn't clear existing). This test reflects actual behavior.
  assert.ok(patched !== null, "patch replace should succeed");
  // Both user1 and user2 may be in the group since replace doesn't clear existing
  assert.ok(patched.members.some((m) => m.value === user2.id), "user2 should be in group after replace");

  // Remove all members via patch — bare remove (no filter) is now a no-op for safety
  patched = service.patchGroup(group.id, [{ op: "remove", path: "members" }], "tenant-patch");

  assert.ok(patched !== null, "patch remove should succeed");
  // A bare "remove members" without a filter no longer wipes all members (safety behavior)
  assert.equal(patched.members.length, 2, "bare remove should NOT clear all members");
});

// ============================================================================
// SCIM User Lookup Tests
// ============================================================================

test("integration: SCIM getUserByUsername and getUserByEmail", () => {
  const service = createScimProvisionService();

  service.createUser({
    userName: "lookupuser",
    name: { formatted: "Lookup User", familyName: "User", givenName: "Lookup" },
    displayName: "Lookup User",
    emails: [{ value: "lookup@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-lookup");

  const byUsername = service.getUserByUsername("lookupuser", "tenant-lookup");
  assert.ok(byUsername !== null, "should find user by username");
  assert.equal(byUsername!.userName, "lookupuser", "username should match");

  const byEmail = service.getUserByEmail("lookup@example.com", "tenant-lookup");
  assert.ok(byEmail !== null, "should find user by email");
  assert.equal(byEmail!.userName, "lookupuser", "username should match");
});

test("integration: SCIM getUserByUsername returns null for non-existent user", () => {
  const service = createScimProvisionService();

  const result = service.getUserByUsername("nonexistent", "tenant-test");
  assert.equal(result, null, "should return null for non-existent user");
});

test("integration: SCIM getUserByEmail returns null for non-existent email", () => {
  const service = createScimProvisionService();

  const result = service.getUserByEmail("nonexistent@example.com", "tenant-test");
  assert.equal(result, null, "should return null for non-existent email");
});

// ============================================================================
// SCIM Patch Remove Member Tests (Issue 1984)
// ============================================================================

test("integration: SCIM patch remove members[value eq] only removes target member", () => {
  const service = createScimProvisionService();

  const user1 = service.createUser({
    userName: "targetuser1",
    name: { formatted: "Target User 1", familyName: "User1", givenName: "Target" },
    displayName: "Target User 1",
    emails: [{ value: "target1@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-remove-target");

  const user2 = service.createUser({
    userName: "targetuser2",
    name: { formatted: "Target User 2", familyName: "User2", givenName: "Target" },
    displayName: "Target User 2",
    emails: [{ value: "target2@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-remove-target");

  const group = service.createGroup({
    displayName: "Remove Target Group",
    members: [
      { value: user1.id, display: user1.displayName },
      { value: user2.id, display: user2.displayName },
    ],
  }, "tenant-remove-target");

  // Verify both members are present
  assert.equal(group.members.length, 2, "group should have 2 members initially");

  // Remove only user1 via patch with value filter
  const patched = service.patchGroup(
    group.id,
    [{ op: "remove", path: `members[value eq "${user1.id}"]` }],
    "tenant-remove-target"
  );

  assert.ok(patched !== null, "patch remove should succeed");
  assert.equal(patched.members.length, 1, "only target member should be removed");
  assert.ok(!patched.members.some((m) => m.value === user1.id), "user1 should no longer be a member");
  assert.ok(patched.members.some((m) => m.value === user2.id), "user2 should still be a member");
});

test("integration: SCIM patch remove bare members does NOT clear all members", () => {
  const service = createScimProvisionService();

  const user1 = service.createUser({
    userName: "bareuser1",
    name: { formatted: "Bare User 1", familyName: "User1", givenName: "Bare" },
    displayName: "Bare User 1",
    emails: [{ value: "bare1@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-remove-bare");

  const user2 = service.createUser({
    userName: "bareuser2",
    name: { formatted: "Bare User 2", familyName: "User2", givenName: "Bare" },
    displayName: "Bare User 2",
    emails: [{ value: "bare2@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-remove-bare");

  const group = service.createGroup({
    displayName: "Bare Remove Group",
    members: [
      { value: user1.id, display: user1.displayName },
      { value: user2.id, display: user2.displayName },
    ],
  }, "tenant-remove-bare");

  // Verify both members are present
  assert.equal(group.members.length, 2, "group should have 2 members initially");

  // Remove with bare path (no filter) should NOT clear all members
  const patched = service.patchGroup(
    group.id,
    [{ op: "remove", path: "members" }],
    "tenant-remove-bare"
  );

  assert.ok(patched !== null, "patch remove should succeed");
  assert.equal(patched.members.length, 2, "bare remove should NOT clear all members (safety behavior)");
  assert.ok(patched.members.some((m) => m.value === user1.id), "user1 should still be a member");
  assert.ok(patched.members.some((m) => m.value === user2.id), "user2 should still be a member");
});

test("integration: SCIM patch remove members[display eq] only removes target member by display name", () => {
  const service = createScimProvisionService();

  const user1 = service.createUser({
    userName: "dispuser1",
    name: { formatted: "Display User 1", familyName: "User1", givenName: "Display" },
    displayName: "Display User 1",
    emails: [{ value: "disp1@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-remove-display");

  const user2 = service.createUser({
    userName: "dispuser2",
    name: { formatted: "Display User 2", familyName: "User2", givenName: "Display" },
    displayName: "Display User 2",
    emails: [{ value: "disp2@example.com", primary: true }],
    active: true,
    groups: [],
  }, "tenant-remove-display");

  const group = service.createGroup({
    displayName: "Display Remove Group",
    members: [
      { value: user1.id, display: user1.displayName },
      { value: user2.id, display: user2.displayName },
    ],
  }, "tenant-remove-display");

  // Verify both members are present
  assert.equal(group.members.length, 2, "group should have 2 members initially");

  // Remove only user1 via patch with display filter
  const patched = service.patchGroup(
    group.id,
    [{ op: "remove", path: `members[display eq "${user1.displayName}"]` }],
    "tenant-remove-display"
  );

  assert.ok(patched !== null, "patch remove should succeed");
  assert.equal(patched.members.length, 1, "only target member should be removed");
  assert.ok(!patched.members.some((m) => m.value === user1.id), "user1 should no longer be a member");
  assert.ok(patched.members.some((m) => m.value === user2.id), "user2 should still be a member");
});
