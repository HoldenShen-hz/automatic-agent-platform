import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import {
  ComplianceExceptionWorkflowEngine,
  type ComplianceExceptionRequest,
} from "../../../src/org-governance/compliance-engine/compliance-exception-workflow.js";
import { GroupRoleMappingService } from "../../../src/org-governance/sso-scim/group-role-mapping-service.js";
import { ApiKeyService } from "../../../src/org-governance/sso-scim/api-key-service.js";
import { SamlService } from "../../../src/org-governance/sso-scim/saml/index.js";
import { OidcIdentityService } from "../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import type { OidcProviderConfig } from "../../../src/org-governance/sso-scim/oidc/index.js";
import { ScimProvisionService } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";
import { IdentitySyncService } from "../../../src/org-governance/sso-scim/identity-sync-service.js";
import { ComplianceFrameworkSchema, DEFAULT_COMPLIANCE_FRAMEWORKS } from "../../../src/org-governance/compliance-engine/framework-catalog.js";

function createOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId ?? "dept-1",
    nodeType: overrides.nodeType ?? "department",
    displayName: overrides.displayName ?? "Dept 1",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? ["director-1"],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "cc-1",
    metadata: overrides.metadata ?? {},
  };
}

function createExceptionRequest(): ComplianceExceptionRequest {
  return {
    exceptionId: "exception-1",
    frameworkId: "soc2",
    controlId: "cc1",
    requesterId: "user-1",
    justification: "temporary exception",
    riskImpact: "medium",
    proposedMitigation: "manual control",
    compensatingControls: ["control-a"],
    requestedApprovalDuration: "P1MT2H",
    submittedAt: "2026-05-20T00:00:00.000Z",
    status: "pending_review",
  };
}

function createOidcConfig(): OidcProviderConfig {
  return {
    providerId: "corp-oidc",
    issuer: "https://idp.example.com",
    clientId: "client-1",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid"],
  };
}

test("approval routing uses configured FX snapshot and configurable route TTL", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [createOrgNode()],
    routeSnapshotTtlMs: 2 * 60 * 60 * 1000,
    fxRatesToCny: {
      USD: {
        rate: 7.01,
        asOf: "2026-05-20T00:00:00.000Z",
        source: "fx.snapshot.test",
      },
      CNY: { rate: 1, source: "fx.identity.cny" },
    },
  });

  const result = service.route(
    {
      requesterId: "user-1",
      orgNodeId: "dept-1",
      riskLevel: "medium",
      amountUsd: 10,
    },
    "2026-05-20T08:00:00.000Z",
    "2026-05-20T08:00:00.000Z",
  );

  assert.equal(result.routeSnapshot.amount.amountCny, 70.1);
  assert.equal(result.routeSnapshot.amount.fxSnapshot?.source, "fx.snapshot.test");
  assert.equal(result.routeSnapshot.expiresAt, "2026-05-20T10:00:00.000Z");
});

test("approval routing fails closed when SoD removes the last approver", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [createOrgNode({ ownerUserIds: ["platform_admin"] })],
  });

  assert.throws(
    () => service.route(
      {
        requesterId: "platform_admin",
        orgNodeId: "dept-1",
        riskLevel: "low",
        amountUsd: 1,
      },
      "2026-05-20T00:00:00.000Z",
      "2026-05-20T00:00:00.000Z",
    ),
    /approval_route\.empty_approver_chain/,
  );
});

test("compliance exception workflow supports month durations, withdraw, revoke, terminal guard, and background expiration", () => {
  const engine = new ComplianceExceptionWorkflowEngine();
  const workflow = engine.initiateWorkflow(createExceptionRequest(), ["approver-1"]);

  assert.ok(workflow.expiresAt != null);
  assert.equal(
    new Date(workflow.expiresAt!).getTime() > new Date(workflow.createdAt).getTime(),
    true,
  );

  const withdrawn = engine.withdrawWorkflow(workflow.workflowId, "user-1");
  assert.equal(withdrawn?.status, "withdrawn");
  assert.throws(
    () => engine.recordDecision(workflow.workflowId, "approver-1", "approved", "late approve"),
    /compliance_exception\.terminal_workflow/,
  );

  const approvedWorkflow = engine.initiateWorkflow({
    ...createExceptionRequest(),
    exceptionId: "exception-2",
    requestedApprovalDuration: "P1D",
  }, ["approver-1"]);
  engine.recordDecision(approvedWorkflow.workflowId, "approver-1", "approved", "ok");
  const revoked = engine.revokeWorkflow(approvedWorkflow.workflowId, "security-1");
  assert.equal(revoked?.status, "revoked");

  const expiringWorkflow = engine.initiateWorkflow({
    ...createExceptionRequest(),
    exceptionId: "exception-3",
    requestedApprovalDuration: "PT30M",
  }, ["approver-1"]);
  const expiredIds = engine.expireDueWorkflows("2030-01-01T00:00:00.000Z");
  assert.ok(expiredIds.includes(expiringWorkflow.workflowId));
});

test("group role mapping is tenant isolated, audited, and rejects duplicate rules", () => {
  const service = new GroupRoleMappingService();
  service.register({ tenantId: "tenant-a", groupName: "admins", roleIds: ["admin"] });
  service.register({ tenantId: "tenant-b", groupName: "admins", roleIds: ["viewer"] });

  assert.deepEqual(service.resolve(["admins"], "tenant-a"), ["admin"]);
  assert.deepEqual(service.resolve(["admins"], "tenant-b"), ["viewer"]);
  assert.throws(
    () => service.register({ tenantId: "tenant-a", groupName: "admins", roleIds: ["ops"] }),
    /group_role_mapping\.duplicate_rule/,
  );
  assert.equal(service.listAuditLog().length, 2);
});

test("api key validation requires tenant context when the same key hash is registered in multiple tenants", () => {
  const service = new ApiKeyService({ keyPrefixLength: 12 });
  const created = service.generateApiKey({
    tenantId: "tenant-a",
    name: "shared",
    ownerId: "owner-a",
    createdBy: "admin",
  });

  assert.equal(created.record.keyPrefix.length, 12);

  const duplicateRecord = {
    ...created.record,
    keyId: "apikey_duplicate",
    tenantId: "tenant-b",
  };
  const keys = service as unknown as {
    keys: Map<string, unknown>;
    keyHashIndex: Map<string, Set<string>>;
  };
  keys.keys.set(duplicateRecord.keyId, duplicateRecord);
  keys.keyHashIndex.get(created.record.keyHash)?.add(duplicateRecord.keyId);

  const withoutTenant = service.validateApiKey(created.rawKey);
  const withTenant = service.validateApiKey(created.rawKey, "tenant-a");

  assert.equal(withoutTenant.valid, false);
  assert.equal(withoutTenant.reason, "tenant_context_required");
  assert.equal(withTenant.valid, true);
  assert.equal(withTenant.tenantId, "tenant-a");
});

test("saml service emits XML requests, requires explicit unsafe opt-in, and validates inResponseTo", async () => {
  const service = new SamlService({ assertionReplayTtlMs: 1 });
  assert.throws(
    () => service.registerProvider({
      providerId: "idp-1",
      entryPoint: "https://idp.example.com/login",
      issuer: "https://idp.example.com",
      certificateFingerprint: "AA",
      allowUnsignedAssertions: true,
    }),
    /saml\.unsafe_allow_unsigned_assertions_reason_required/,
  );

  service.registerProvider({
    providerId: "idp-1",
    entryPoint: "https://idp.example.com/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA",
    allowUnsignedAssertions: true,
    unsafeAllowUnsignedAssertionsReason: "legacy test provider",
  });
  const request = service.buildLoginRequest("idp-1", { requestId: "req-1" });
  const redirect = new URL(request.redirectUrl);
  const xml = Buffer.from(redirect.searchParams.get("SAMLRequest")!, "base64").toString("utf8");
  assert.ok(xml.includes("<samlp:AuthnRequest"));

  assert.throws(
    () => service.consumeAssertion("idp-1", {
      issuer: "https://idp.example.com",
      audience: "https://idp.example.com:idp-1",
      nameId: "user@example.com",
      fingerprint: "AA",
    }),
    /saml\.in_response_to_required/,
  );

  const session = service.consumeAssertion("idp-1", {
    issuer: "https://idp.example.com",
    audience: "https://idp.example.com:idp-1",
    nameId: "user@example.com",
    fingerprint: "AA",
    inResponseTo: "req-1",
    assertionId: "assertion-1",
  });
  assert.equal(session.providerId, "idp-1");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const login2 = service.buildLoginRequest("idp-1", { requestId: "req-2" });
  assert.ok(login2.requestId === "req-2");
  const replayAfterTtl = service.consumeAssertion("idp-1", {
    issuer: "https://idp.example.com",
    audience: "https://idp.example.com:idp-1",
    nameId: "user@example.com",
    fingerprint: "AA",
    inResponseTo: "req-2",
    assertionId: "assertion-1",
  });
  assert.equal(replayAfterTtl.providerId, "idp-1");
});

test("oidc refresh keeps the old session intact when production refresh fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  globalThis.fetch = (async () => {
    throw new Error("network-down");
  }) as typeof fetch;

  try {
    const service = new OidcIdentityService(createOidcConfig(), undefined, {
      allowMockFallback: false,
      stateTtlMs: 1,
    });
    const session = service.createSession({
      accessToken: "live_access_token",
      idToken: "live_id_token",
      refreshToken: "live_refresh_token",
      expiresIn: 3600,
      tokenType: "Bearer",
      expiresAt: "2026-05-20T02:00:00.000Z",
    }, { sub: "user-1" });

    await assert.rejects(() => service.refreshAccessToken(session.sessionId), /network-down/);
    const activeSession = service.getUserSessions("user-1")[0];
    assert.equal(activeSession?.accessToken, "live_access_token");

    const stateStore = new OidcIdentityService(createOidcConfig(), undefined, { stateTtlMs: 1 });
    const flow = stateStore.initiateFlow("https://app.example.com/callback");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const tokens = await stateStore.exchangeCodeForTokens("auth-code", flow.state);
    assert.equal(tokens, null);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("scim service requires tenant context for multi-tenant listing, validates patch/filter syntax, and persists events", () => {
  const dir = mkdtempSync(join(tmpdir(), "scim-events-"));
  const eventStorePath = join(dir, "events.json");
  const service = new ScimProvisionService({ eventStorePath });

  const alice = service.createUser({
    userName: "alice",
    displayName: "Alice",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
    name: { formatted: "Alice", familyName: "A", givenName: "Alice" },
  }, "tenant-a");
  service.createUser({
    userName: "bob",
    displayName: "Bob",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
    name: { formatted: "Bob", familyName: "B", givenName: "Bob" },
  }, "tenant-b");

  assert.throws(() => service.listUsers({}), /scim\.tenant_required:list_users/);
  assert.throws(
    () => service.processBulkRequest({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
      Operations: new Array(101).fill({ method: "DELETE", path: "/Users/x" }),
    }, "tenant-a"),
    /scim\.bulk_too_large/,
  );
  assert.throws(
    () => service.listUsers({ tenantId: "tenant-a", filter: "userName eq \"alice\" and invalid" }),
    /scim\.filter\.unsupported/,
  );
  assert.throws(
    () => (service as unknown as { patchUser: (...args: unknown[]) => unknown }).patchUser(alice.id, [{
      op: "replace",
      path: "externalId",
      value: "x",
    }], "tenant-a"),
    /scim\.patch\.unsupported_path/,
  );

  const reloaded = new ScimProvisionService({ eventStorePath });
  const persistedEvents = reloaded.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-a");
  assert.equal(persistedEvents.length, 1);
});

test("identity sync and framework catalog use configurable SLOs and structured audit requirements", () => {
  const identitySync = new IdentitySyncService();
  const snapshot = identitySync.bootstrap(
    createOidcConfig(),
    {
      providerId: "idp-1",
      entryPoint: "https://idp.example.com/login",
      issuer: "https://idp.example.com",
      certificateFingerprint: "AA",
    },
    [{
      eventId: "evt-1",
      action: "user_deleted",
      subjectId: "user-1",
      occurredAt: "2026-05-20T00:00:00.000Z",
      tenantId: "tenant-a",
    }],
    {
      targetSloSecondsByMode: {
        normal: 180,
        security: 45,
      },
      oidcSessionsBySubject: { "user-1": ["oidc-1"] },
      samlSessionsBySubject: { "user-1": ["saml-1"] },
      securityIncidentSubjectIds: ["user-1"],
    },
  );
  assert.equal(snapshot.sessionRevocationPlans[0]?.targetSloSeconds, 45);

  const parsed = ComplianceFrameworkSchema.parse({
    frameworkId: "custom",
    type: "soc2",
    displayName: "Custom",
    controlIds: ["ctrl-1"],
    auditRequirements: ["attestation"],
    reportTemplate: "template",
  });
  assert.equal(parsed.auditRequirements[0]?.requirementId, "attestation");
  assert.equal(DEFAULT_COMPLIANCE_FRAMEWORKS[0]?.auditRequirements[0]?.frequency != null, true);
});
