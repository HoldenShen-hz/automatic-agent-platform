import test from "node:test";
import assert from "node:assert/strict";
import { IdentitySyncService } from "../../../../src/org-governance/sso-scim/identity-sync-service.js";
import { ScimProvisioningEventSchema } from "../../../../src/org-governance/sso-scim/scim-sync/index.js";

test("IdentitySyncService bootstrap() builds snapshot with OIDC URL, SAML audience, and SCIM events", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };
  const events: Array<{ eventId: string; action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated"; subjectId: string; occurredAt: string }> = [
    { eventId: "evt-1", action: "user_created", subjectId: "user-1", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-2", action: "user_disabled", subjectId: "user-2", occurredAt: "2024-01-15T00:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(oidcConfig, samlConfig, events);

  assert.ok(snapshot.oidcAuthorizationUrl.includes("https://idp.example.com/authorize"));
  assert.ok(snapshot.oidcAuthorizationUrl.includes("client_id"));
  assert.strictEqual(snapshot.samlAudience, "https://app.example.com:saml-1");
  assert.strictEqual(snapshot.appliedScimEvents.length, 2);
  assert.strictEqual(snapshot.appliedScimEvents[0]!.terminal, false);
  assert.strictEqual(snapshot.appliedScimEvents[1]!.terminal, true);
});

test("IdentitySyncService bootstrap() tracks active subjects based on terminal SCIM actions", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };
  const events: Array<{ eventId: string; action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated"; subjectId: string; occurredAt: string }> = [
    { eventId: "evt-1", action: "user_created", subjectId: "user-active", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-2", action: "user_disabled", subjectId: "user-inactive", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-3", action: "user_deleted", subjectId: "user-deleted", occurredAt: "2024-01-15T00:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(oidcConfig, samlConfig, events);

  assert.deepStrictEqual(snapshot.activeSubjects, ["user-active"]);
});

test("ScimProvisioningEventSchema parses valid SCIM provisioning event", () => {
  const valid = {
    eventId: "evt-001",
    action: "user_created",
    subjectId: "user-123",
    occurredAt: "2024-01-15T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.parse(valid);

  assert.strictEqual(result.eventId, "evt-001");
  assert.strictEqual(result.action, "user_created");
  assert.strictEqual(result.subjectId, "user-123");
});

test("ScimProvisioningEventSchema accepts all valid SCIM actions", () => {
  const actions = ["user_created", "user_updated", "user_disabled", "user_deleted", "group_updated"] as const;
  for (const action of actions) {
    const result = ScimProvisioningEventSchema.parse({
      eventId: "evt-001",
      action,
      subjectId: "user-123",
      occurredAt: "2024-01-15T10:00:00.000Z",
    });
    assert.strictEqual(result.action, action);
  }
});

test("ScimProvisioningEventSchema throws on invalid action", () => {
  assert.throws(() => {
    ScimProvisioningEventSchema.parse({
      eventId: "evt-001",
      action: "invalid_action",
      subjectId: "user-123",
      occurredAt: "2024-01-15T10:00:00.000Z",
    });
  });
});
