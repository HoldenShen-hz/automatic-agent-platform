import test from "node:test";
import assert from "node:assert/strict";

import { IdentitySyncService } from "../../../src/org-governance/sso-scim/identity-sync-service.js";
import { ApiKeyService } from "../../../src/org-governance/sso-scim/api-key-service.js";
import { ScimDlqReconciliationService } from "../../../src/org-governance/sso-scim/scim-dlq-reconciliation.js";

const validOidcConfig = {
  providerId: "oidc-provider",
  issuer: "https://issuer.example.com",
  clientId: "oidc-client",
  redirectUri: "https://app.example.com/callback",
  scopes: ["openid", "profile", "email"],
};

const validSamlConfig = {
  providerId: "saml-provider",
  entryPoint: "https://saml.example.com/sso",
  issuer: "https://saml.example.com",
  certificateFingerprint: "fingerpint",
};

test("IdentitySyncService.bootstrap processes valid SCIM events and sets active subjects", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    validOidcConfig,
    validSamlConfig,
    [
      { eventId: "evt-1", action: "user_created", subjectId: "user-1", occurredAt: new Date().toISOString() },
      { eventId: "evt-2", action: "user_updated", subjectId: "user-1", occurredAt: new Date().toISOString() },
      { eventId: "evt-3", action: "user_created", subjectId: "user-2", occurredAt: new Date().toISOString() },
    ],
  );
  assert.ok(snapshot.activeSubjects.includes("user-1"));
  assert.ok(snapshot.activeSubjects.includes("user-2"));
  assert.equal(snapshot.appliedScimEvents.length, 3);
});

test("IdentitySyncService.bootstrap moves subjects to DLQ on schema validation failure", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    validOidcConfig,
    validSamlConfig,
    [
      { eventId: "evt-invalid", action: "user_created", subjectId: "user-1" },
      { eventId: "evt-valid", action: "user_created", subjectId: "user-2", occurredAt: new Date().toISOString() },
    ],
  );
  assert.ok(snapshot.dlqRecords.length > 0);
  assert.equal(snapshot.dlqRecords[0]?.failureCode, "schema_validation_failed");
});

test("IdentitySyncService.bootstrap detects event ID conflicts", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    validOidcConfig,
    validSamlConfig,
    [
      { eventId: "evt-conflict", action: "user_created", subjectId: "user-1", occurredAt: new Date().toISOString() },
      { eventId: "evt-conflict", action: "user_deleted", subjectId: "user-1", occurredAt: new Date().toISOString() },
    ],
  );
  assert.ok(snapshot.conflictReports.length > 0);
  assert.equal(snapshot.conflictReports[0]?.conflictType, "event_id_conflict");
  assert.ok(snapshot.conflictReports[0]?.conflictingFields.includes("action"));
});

test("IdentitySyncService.bootstrap generates session revocation plans for terminal events", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    validOidcConfig,
    validSamlConfig,
    [
      { eventId: "evt-1", action: "user_deleted", subjectId: "user-1", occurredAt: new Date().toISOString() },
    ],
    {
      oidcSessionsBySubject: { "user-1": ["oidc-session-1", "oidc-session-2"] },
      samlSessionsBySubject: { "user-1": ["saml-session-1"] },
    },
  );
  assert.ok(snapshot.sessionRevocationPlans.length > 0);
  assert.equal(snapshot.sessionRevocationPlans[0]?.subjectId, "user-1");
  assert.equal(snapshot.sessionRevocationPlans[0]?.oidcSessionIds.length, 2);
  assert.equal(snapshot.sessionRevocationPlans[0]?.samlSessionIds.length, 1);
});

test("IdentitySyncService.bootstrap applies security revocation mode for security incidents", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    validOidcConfig,
    validSamlConfig,
    [
      { eventId: "evt-1", action: "user_deleted", subjectId: "user-1", occurredAt: new Date().toISOString() },
    ],
    {
      securityIncidentSubjectIds: ["user-1"],
      oidcSessionsBySubject: { "user-1": ["oidc-session-1"] },
    },
  );
  assert.equal(snapshot.sessionRevocationPlans[0]?.revocationMode, "security");
  assert.equal(snapshot.sessionRevocationPlans[0]?.targetSloSeconds, 60);
});

test("IdentitySyncService.bootstrap generates agent freeze directives for deconfigured subjects", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    validOidcConfig,
    validSamlConfig,
    [
      { eventId: "evt-1", action: "user_deactivated", subjectId: "user-1", occurredAt: new Date().toISOString() },
    ],
    {
      agentAssignmentsBySubject: { "user-1": ["agent-1", "agent-2"] },
      deconfiguredSubjectIds: ["user-1"],
    },
  );
  assert.ok(snapshot.agentFreezeDirectives.length > 0);
  assert.equal(snapshot.agentFreezeDirectives[0]?.subjectId, "user-1");
  assert.deepEqual(snapshot.agentFreezeDirectives[0]?.agentIds, ["agent-1", "agent-2"]);
  assert.equal(snapshot.agentFreezeDirectives[0]?.reason, "identity_deconfigured");
});

test("IdentitySyncService.processDlqWithRetry retries records with backoff", () => {
  const service = new IdentitySyncService();
  const dlqRecord = {
    dlqId: "dlq-1",
    eventType: "user_created",
    failureCode: "schema_validation_failed" as const,
    failureDetail: "Missing field",
    retryCount: 0,
    nextRetryAt: null,
    lastRetryAt: null,
  };
  const nowIso = new Date().toISOString();
  const { processedRecords, retryQueue } = service.processDlqWithRetry([dlqRecord], nowIso);
  assert.equal(retryQueue.length, 1);
  assert.equal(retryQueue[0]?.retryCount, 1);
  assert.ok(retryQueue[0]?.nextRetryAt != null);
});

test("IdentitySyncService.processDlqWithRetry moves exhausted records to processed without retry", () => {
  const service = new IdentitySyncService();
  const dlqRecord = {
    dlqId: "dlq-exhausted",
    eventType: "user_created",
    failureCode: "schema_validation_failed" as const,
    failureDetail: "Missing field",
    retryCount: 3,
    nextRetryAt: null,
    lastRetryAt: null,
  };
  const nowIso = new Date().toISOString();
  const { processedRecords, retryQueue } = service.processDlqWithRetry([dlqRecord], nowIso);
  assert.equal(retryQueue.length, 0);
  assert.equal(processedRecords[0]?.nextRetryAt, null);
});

test("IdentitySyncService.generateDailyReconciliation produces reconciliation metrics", () => {
  const service = new IdentitySyncService();
  const dlqRecords = [
    {
      dlqId: "dlq-1",
      eventType: "user_created",
      failureCode: "schema_validation_failed" as const,
      failureDetail: "Missing field",
      retryCount: 1,
      nextRetryAt: new Date().toISOString(),
      lastRetryAt: new Date().toISOString(),
    },
  ];
  const report = service.generateDailyReconciliation(
    dlqRecords,
    new Date(Date.now() - 86400000).toISOString(),
    new Date().toISOString(),
  );
  assert.ok(report.reportId.startsWith("identity_reconciliation_"));
  assert.equal(report.totalDlqRecords, 1);
  assert.ok(report.retryAttempted >= 0);
});

test("ApiKeyService.generateApiKey creates key with correct structure", () => {
  const service = new ApiKeyService();
  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    scopes: ["read", "write"],
    createdBy: "admin",
  });
  assert.ok(record.keyId.startsWith("apikey_"));
  assert.ok(rawKey.startsWith("aa_"));
  assert.equal(record.status, "active");
  assert.equal(record.ownerId, "user-1");
  assert.deepEqual(record.scopes, ["read", "write"]);
});

test("ApiKeyService.validateApiKey returns valid for active key", () => {
  const service = new ApiKeyService();
  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin",
  });
  const result = service.validateApiKey(rawKey);
  assert.equal(result.valid, true);
  assert.equal(result.ownerId, "user-1");
  assert.ok(result.scopes.length >= 0);
});

test("ApiKeyService.validateApiKey returns invalid for unknown key", () => {
  const service = new ApiKeyService();
  const result = service.validateApiKey("aa_unknown_key");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_key");
});

test("ApiKeyService.validateApiKey returns invalid for revoked key", () => {
  const service = new ApiKeyService();
  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin",
  });
  service.revokeApiKey(record.keyId, "admin");
  const result = service.validateApiKey(rawKey);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "key_revoked");
});

test("ApiKeyService.validateApiKey returns invalid for expired key", () => {
  const service = new ApiKeyService();
  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    expiresAt: "2020-01-01T00:00:00.000Z",
    createdBy: "admin",
  });
  const result = service.validateApiKey(rawKey);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "key_expired");
});

test("ApiKeyService.revokeApiKey marks key as revoked", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin",
  });
  const revoked = service.revokeApiKey(record.keyId, "admin");
  assert.equal(revoked, true);
  const retrieved = service.getApiKey(record.keyId);
  assert.equal(retrieved?.status, "revoked");
});

test("ApiKeyService.rotateApiKey revokes old key and generates new key", () => {
  const service = new ApiKeyService();
  const { record: oldRecord } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin",
  });
  const rotated = service.rotateApiKey(oldRecord.keyId, "admin");
  assert.ok(rotated !== null);
  assert.notEqual(rotated.rawKey, oldRecord.keyId);
  const oldKey = service.getApiKey(oldRecord.keyId);
  assert.equal(oldKey?.status, "revoked");
});

test("ApiKeyService.listApiKeysForOwner returns all keys for owner", () => {
  const service = new ApiKeyService();
  service.generateApiKey({ name: "Key 1", ownerId: "user-1", createdBy: "admin" });
  service.generateApiKey({ name: "Key 2", ownerId: "user-1", createdBy: "admin" });
  service.generateApiKey({ name: "Key 3", ownerId: "user-2", createdBy: "admin" });
  const user1Keys = service.listApiKeysForOwner("user-1");
  const user2Keys = service.listApiKeysForOwner("user-2");
  assert.equal(user1Keys.length, 2);
  assert.equal(user2Keys.length, 1);
});

test("ScimDlqReconciliationService.reconcile categorizes records by retry status", () => {
  const service = new ScimDlqReconciliationService();
  const records = [
    { recordId: "dlq-1", identityId: "user-1", retryCount: 1, maxRetries: 3, lastError: "error 1" },
    { recordId: "dlq-2", identityId: "user-2", retryCount: 3, maxRetries: 3, lastError: "error 2" },
    { recordId: "dlq-3", identityId: "user-3", retryCount: 5, maxRetries: 3, lastError: "error 3" },
  ];
  const report = service.reconcile("report-1", records);
  assert.equal(report.retryRecordIds.length, 1);
  assert.ok(report.retryRecordIds.includes("dlq-1"));
  assert.equal(report.exhaustedRecordIds.length, 2);
  assert.ok(report.exhaustedRecordIds.includes("dlq-2"));
  assert.ok(report.exhaustedRecordIds.includes("dlq-3"));
  assert.equal(report.unresolvedIdentityIds.length, 2);
});

test("ScimDlqReconciliationService.reconcile identifies unresolved identities", () => {
  const service = new ScimDlqReconciliationService();
  const records = [
    { recordId: "dlq-1", identityId: "user-exhausted", retryCount: 3, maxRetries: 3, lastError: "persistent error" },
  ];
  const report = service.reconcile("report-1", records);
  assert.ok(report.unresolvedIdentityIds.includes("user-exhausted"));
});
