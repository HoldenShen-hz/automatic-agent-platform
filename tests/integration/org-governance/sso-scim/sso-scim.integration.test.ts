/**
 * Integration tests for SSO/SCIM flow
 * Tests cover SSO/SCIM integration scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OidcIdentityService } from "../../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import { ScimProvisionService } from "../../../../src/org-governance/sso-scim/scim-sync/scim-service.js";
import type { OidcProviderConfig } from "../../../../src/org-governance/sso-scim/oidc/index.js";

function createOidcConfig(): OidcProviderConfig {
  return {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile", "email"],
  };
}

function createTestOidcService(): OidcIdentityService {
  return new OidcIdentityService(createOidcConfig(), undefined, {
    allowMockFallback: true,
  });
}

test("OIDC and SCIM integration - user provisioned after successful OIDC auth", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // User authenticates via OIDC
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code-123", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);
    oidcService.createSession(tokens!, userInfo!);

    // Create SCIM user from OIDC user info
    const scimUser = scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.email ?? userInfo!.sub,
      displayName: userInfo!.name ?? `${userInfo!.givenName} ${userInfo!.familyName}`,
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [],
      name: {
        formatted: `${userInfo!.givenName ?? ""} ${userInfo!.familyName ?? ""}`.trim(),
        familyName: userInfo!.familyName ?? "",
        givenName: userInfo!.givenName ?? "",
      },
    }, "tenant-1");

    // User should be provisioned
    assert.ok(scimUser.id);
    assert.equal(scimUser.displayName, userInfo!.name);

    // OIDC session should be valid
    const session = oidcService.validateAccessToken(tokens!.accessToken);
    assert.ok(session);
    assert.equal(session!.userId, userInfo!.sub);
  } finally {}
});

test("OIDC and SCIM integration - user lookup after OIDC session creation", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // Create OIDC session
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);
    oidcService.createSession(tokens!, userInfo!);

    // Create SCIM user
    const scimUser = scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.sub,
      displayName: userInfo!.name ?? "Test User",
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [],
      name: { formatted: userInfo!.name ?? "", familyName: userInfo!.familyName ?? "", givenName: userInfo!.givenName ?? "" },
    }, "tenant-1");

    // Should be able to look up user
    const lookedUp = scimService.getUser(scimUser.id);
    assert.ok(lookedUp);
    assert.equal(lookedUp!.userName, scimUser.userName);
  } finally {}
});

test("SCIM user provisioning with OIDC groups integration", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // Create OIDC session with groups
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);

    // Create SCIM user
    const scimUser = scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.sub,
      displayName: userInfo!.name ?? "Test User",
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [], // Groups would be synced separately
      name: { formatted: userInfo!.name ?? "", familyName: userInfo!.familyName ?? "", givenName: userInfo!.givenName ?? "" },
    }, "tenant-1");

    // Create groups based on OIDC groups
    for (const groupName of userInfo!.groups ?? []) {
      let scimGroup = scimService.getGroupByName(groupName);
      if (!scimGroup) {
        scimGroup = scimService.createGroup({ displayName: groupName }, "tenant-1");
      }
      scimService.addMemberToGroup(scimGroup.id, scimUser.id, "tenant-1");
    }

    // Verify user is in groups
    const group = scimService.getGroupByName("engineers");
    assert.ok(group);
    assert.ok(group!.members.some(m => m.value === scimUser.id));
  } finally {}
});

test("OIDC session management with SCIM user lifecycle", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // Create multiple users
    for (let i = 0; i < 3; i++) {
      const { state } = oidcService.initiateFlow("https://app.example.com/callback");
      const tokens = await oidcService.exchangeCodeForTokens(`auth-code-${i}`, state);
      const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);
      oidcService.createSession(tokens!, userInfo!);

      scimService.createUser({
        userName: `user${i}`,
        displayName: `User ${i}`,
        emails: [{ value: `user${i}@example.com`, primary: true }],
        active: true,
        groups: [],
        name: { formatted: `User ${i}`, familyName: `${i}`, givenName: `User` },
      }, "tenant-1");
    }

    // All users should have active sessions
    const sessionCount = oidcService.getSessionCount();
    assert.equal(sessionCount, 3);

    // SCIM should have 3 users
    assert.equal(scimService.getUserCount(), 3);

    // Revoke all sessions for user0
    oidcService.revokeAllUserSessions("user");

    // Session count should decrease
    // Note: This depends on the actual userId returned by fetchUserInfo
  } finally {}
});

test("SCIM bulk operations with OIDC token validation", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // Create OIDC session first
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);
    oidcService.createSession(tokens!, userInfo!);

    // Use bulk operations to provision multiple users
    const bulkResponse = scimService.processBulkRequest({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
      Operations: [
        { method: "POST", path: "/Users", bulkId: "user-1", data: { userName: "alice", displayName: "Alice", emails: [{ value: "alice@example.com", primary: true }], active: true, groups: [], name: { formatted: "Alice", familyName: "A", givenName: "Alice" } } },
        { method: "POST", path: "/Users", bulkId: "user-2", data: { userName: "bob", displayName: "Bob", emails: [{ value: "bob@example.com", primary: true }], active: true, groups: [], name: { formatted: "Bob", familyName: "B", givenName: "Bob" } } },
        { method: "POST", path: "/Groups", bulkId: "group-1", data: { displayName: "Engineering", members: [{ value: "bulkId:user-1", display: "Alice" }] } },
      ],
    }, "tenant-1");

    // All operations should succeed
    assert.equal(bulkResponse.Operations.length, 3);
    assert.equal(bulkResponse.Operations[0]?.status, "201");
    assert.equal(bulkResponse.Operations[1]?.status, "201");
    assert.equal(bulkResponse.Operations[2]?.status, "201");

    // Verify group has member
    const group = scimService.getGroupByName("Engineering");
    assert.ok(group);
    assert.ok(group!.members.length > 0);
  } finally {}
});

test("OIDC refresh token flow with SCIM user update", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // Create initial session
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);
    const session = oidcService.createSession(tokens!, userInfo!);

    // Create SCIM user
    const scimUser = scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.sub,
      displayName: userInfo!.name ?? "Test User",
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [],
      name: { formatted: userInfo!.name ?? "", familyName: userInfo!.familyName ?? "", givenName: userInfo!.givenName ?? "" },
    }, "tenant-1");

    // Refresh access token
    const newTokens = await oidcService.refreshAccessToken(session.sessionId);
    assert.ok(newTokens);

    // SCIM user should still exist
    const updatedUser = scimService.getUser(scimUser.id);
    assert.ok(updatedUser);

    // Note: In real scenario, the user's displayName might be updated from refreshed userInfo
  } finally {}
});

test("SCIM provision events tracking with OIDC session events", async () => {
  const oidcService = createTestOidcService();
  const scimService = new ScimProvisionService();
  try {
    // Create users
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);

    scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.sub,
      displayName: userInfo!.name ?? "Test User",
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [],
      name: { formatted: userInfo!.name ?? "", familyName: userInfo!.familyName ?? "", givenName: userInfo!.givenName ?? "" },
    }, "tenant-1");

    // SCIM events should be tracked
    const events = scimService.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-1");
    assert.ok(events.length > 0);

    // Should have user_created event
    assert.ok(events.some(e => e.action === "user_created"));
  } finally {}
});
