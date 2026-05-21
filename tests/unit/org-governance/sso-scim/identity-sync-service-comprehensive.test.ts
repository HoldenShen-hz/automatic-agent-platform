/**
 * Comprehensive Tests: Identity Sync Service
 *
 * Tests bootstrap, DLQ processing, daily reconciliation,
 * and edge cases for the IdentitySyncService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { IdentitySyncService } from "../../../../src/org-governance/sso-scim/identity-sync-service.js";
import { ScimProvisioningEventSchema } from "../../../../src/org-governance/sso-scim/scim-sync/index.js";
import type { ScimProvisioningEvent } from "../../../../src/org-governance/sso-scim/scim-sync/index.js";

function createOidcConfig() {
  return {
    providerId: "oidc-1",
    issuer: "https://idp.example.com",
    clientId: "client-1",
    clientSecret: "secret-1",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", "profile"],
  };
}

function createSamlConfig() {
  return {
    providerId: "saml-1",
    entryPoint: "https://idp.example.com/sso",
    issuer: "https://app.example.com",
    certificateFingerprint: "AA:BB:CC",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// processDlqWithRetry Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentitySyncService.processDlqWithRetry moves records under retry limit to retryQueue", () => {
  const service = new IdentitySyncService();
  const nowIso = new Date().toISOString();

  const records = [
    { dlqId: "dlq-1", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 0, nextRetryAt: null, lastRetryAt: null },
    { dlqId: "dlq-2", eventType: "user_updated", failureCode: "event_id_conflict" as const, failureDetail: "conflict", retryCount: 1, nextRetryAt: null, lastRetryAt: null },
    { dlqId: "dlq-3", eventType: "user_disabled", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 2, nextRetryAt: null, lastRetryAt: null },
  ];

  const result = service.processDlqWithRetry(records, nowIso);

  // All records have retryCount < 3, so all go to retryQueue
  assert.equal(result.retryQueue.length, 3);
  assert.equal(result.processedRecords.length, 0);
});

test("IdentitySyncService.processDlqWithRetry moves records at max retries to processedRecords", () => {
  const service = new IdentitySyncService();
  const nowIso = new Date().toISOString();

  const records = [
    { dlqId: "dlq-exhausted", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 3, nextRetryAt: null, lastRetryAt: null },
  ];

  const result = service.processDlqWithRetry(records, nowIso);

  assert.equal(result.processedRecords.length, 1);
  assert.equal(result.processedRecords[0]!.retryCount, 3);
  assert.equal(result.processedRecords[0]!.nextRetryAt, null);
  assert.equal(result.retryQueue.length, 0);
});

test("IdentitySyncService.processDlqWithRetry sets nextRetryAt for retried records", () => {
  const service = new IdentitySyncService();
  const nowIso = "2026-05-01T12:00:00.000Z";

  const records = [
    { dlqId: "dlq-retry", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 0, nextRetryAt: null, lastRetryAt: null },
  ];

  const result = service.processDlqWithRetry(records, nowIso);

  assert.equal(result.retryQueue.length, 1);
  assert.equal(result.retryQueue[0]!.retryCount, 1);
  assert.ok(result.retryQueue[0]!.nextRetryAt !== null);
  assert.equal(result.retryQueue[0]!.lastRetryAt, nowIso);
});

test("IdentitySyncService.processDlqWithRetry handles mixed retry and exhausted records", () => {
  const service = new IdentitySyncService();
  const nowIso = new Date().toISOString();

  const records = [
    { dlqId: "dlq-retry", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 1, nextRetryAt: null, lastRetryAt: null },
    { dlqId: "dlq-exhausted", eventType: "user_deleted", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 3, nextRetryAt: null, lastRetryAt: null },
  ];

  const result = service.processDlqWithRetry(records, nowIso);

  assert.equal(result.retryQueue.length, 1);
  assert.equal(result.retryQueue[0]!.dlqId, "dlq-retry");
  assert.equal(result.processedRecords.length, 1);
  assert.equal(result.processedRecords[0]!.dlqId, "dlq-exhausted");
});

test("IdentitySyncService.processDlqWithRetry handles empty records array", () => {
  const service = new IdentitySyncService();
  const nowIso = new Date().toISOString();

  const result = service.processDlqWithRetry([], nowIso);

  assert.equal(result.retryQueue.length, 0);
  assert.equal(result.processedRecords.length, 0);
});

test("IdentitySyncService.processDlqWithRetry preserves record metadata when processing", () => {
  const service = new IdentitySyncService();
  const nowIso = new Date().toISOString();

  const records = [
    { dlqId: "dlq-preserve", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "important detail", retryCount: 2, nextRetryAt: null, lastRetryAt: null },
  ];

  const result = service.processDlqWithRetry(records, nowIso);

  assert.equal(result.retryQueue[0]!.dlqId, "dlq-preserve");
  assert.equal(result.retryQueue[0]!.eventType, "user_created");
  assert.equal(result.retryQueue[0]!.failureDetail, "important detail");
});

// ─────────────────────────────────────────────────────────────────────────────
// generateDailyReconciliation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentitySyncService.generateDailyReconciliation computes correct statistics", () => {
  const service = new IdentitySyncService();

  const records = [
    { dlqId: "dlq-1", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 1, nextRetryAt: null, lastRetryAt: null },
    { dlqId: "dlq-2", eventType: "user_updated", failureCode: "event_id_conflict" as const, failureDetail: "conflict", retryCount: 0, nextRetryAt: null, lastRetryAt: null },
    { dlqId: "dlq-3", eventType: "user_disabled", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 3, nextRetryAt: null, lastRetryAt: null },
  ];

  const report = service.generateDailyReconciliation(
    records,
    "2026-05-01T00:00:00.000Z",
    "2026-05-01T23:59:59.999Z",
  );

  assert.equal(report.totalDlqRecords, 3);
  assert.equal(report.retryAttempted, 2); // records with retryCount > 0
  assert.equal(report.exhaustedRecords, 1); // record at retryCount >= 3
  assert.equal(report.pendingRetryRecords, 2); // total - exhausted
});

test("IdentitySyncService.generateDailyReconciliation handles empty records", () => {
  const service = new IdentitySyncService();

  const report = service.generateDailyReconciliation(
    [],
    "2026-05-01T00:00:00.000Z",
    "2026-05-01T23:59:59.999Z",
  );

  assert.equal(report.totalDlqRecords, 0);
  assert.equal(report.retryAttempted, 0);
  assert.equal(report.exhaustedRecords, 0);
  assert.equal(report.pendingRetryRecords, 0);
});

test("IdentitySyncService.generateDailyReconciliation includes correct reportId format", () => {
  const service = new IdentitySyncService();

  const report = service.generateDailyReconciliation(
    [],
    "2026-05-01T00:00:00.000Z",
    "2026-05-01T23:59:59.999Z",
  );

  assert.ok(report.reportId.startsWith("identity_reconciliation_"));
  assert.ok(report.reportId.endsWith("2026-05-01"));
});

test("IdentitySyncService.generateDailyReconciliation preserves window times", () => {
  const service = new IdentitySyncService();

  const report = service.generateDailyReconciliation(
    [],
    "2026-05-15T08:00:00.000Z",
    "2026-05-15T20:00:00.000Z",
  );

  assert.equal(report.windowStartAt, "2026-05-15T08:00:00.000Z");
  assert.equal(report.windowEndAt, "2026-05-15T20:00:00.000Z");
});

test("IdentitySyncService.generateDailyReconciliation calculates pendingRetryRecords correctly", () => {
  const service = new IdentitySyncService();

  const records = [
    { dlqId: "dlq-1", eventType: "user_created", failureCode: "schema_validation_failed" as const, failureDetail: "error", retryCount: 3, nextRetryAt: null, lastRetryAt: null }, // exhausted
    { dlqId: "dlq-2", eventType: "user_updated", failureCode: "event_id_conflict" as const, failureDetail: "conflict", retryCount: 2, nextRetryAt: null, lastRetryAt: null }, // pending
  ];

  const report = service.generateDailyReconciliation(
    records,
    "2026-05-01T00:00:00.000Z",
    "2026-05-01T23:59:59.999Z",
  );

  assert.equal(report.pendingRetryRecords, 1); // 2 total - 1 exhausted
});

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap with Different SCIM Events Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentitySyncService.bootstrap() with no events produces empty snapshot", () => {
  const service = new IdentitySyncService();

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), []);

  assert.equal(snapshot.appliedScimEvents.length, 0);
  assert.equal(snapshot.dlqRecords.length, 0);
  assert.equal(snapshot.conflictReports.length, 0);
  assert.equal(snapshot.sessionRevocationPlans.length, 0);
  assert.equal(snapshot.agentFreezeDirectives.length, 0);
});

test("IdentitySyncService.bootstrap() with only non-terminal events keeps subjects active", () => {
  const service = new IdentitySyncService();

  const events: ScimProvisioningEvent[] = [
    { eventId: "evt-1", action: "user_created", subjectId: "user-active", occurredAt: "2026-05-01T10:00:00.000Z" },
    { eventId: "evt-2", action: "user_updated", subjectId: "user-active", occurredAt: "2026-05-01T11:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.deepStrictEqual(snapshot.activeSubjects, ["user-active"]);
  assert.equal(snapshot.sessionRevocationPlans.length, 0);
});

test("IdentitySyncService.bootstrap() with terminal events generates revocation plans", () => {
  const service = new IdentitySyncService();

  const events: ScimProvisioningEvent[] = [
    { eventId: "evt-1", action: "user_disabled", subjectId: "user-disabled", occurredAt: "2026-05-01T10:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events, {
    oidcSessionsBySubject: { "user-disabled": ["session-1"] },
    samlSessionsBySubject: { "user-disabled": ["saml-session-1"] },
  });

  assert.equal(snapshot.sessionRevocationPlans.length, 1);
  assert.equal(snapshot.sessionRevocationPlans[0]!.subjectId, "user-disabled");
  assert.equal(snapshot.sessionRevocationPlans[0]!.revocationMode, "normal");
  assert.deepEqual(snapshot.sessionRevocationPlans[0]!.oidcSessionIds, ["session-1"]);
  assert.deepEqual(snapshot.sessionRevocationPlans[0]!.samlSessionIds, ["saml-session-1"]);
});

test("IdentitySyncService.bootstrap() with security incident uses security mode", () => {
  const service = new IdentitySyncService();

  const events: ScimProvisioningEvent[] = [
    { eventId: "evt-1", action: "user_deleted", subjectId: "user-security", occurredAt: "2026-05-01T10:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events, {
    securityIncidentSubjectIds: ["user-security"],
    targetSloSecondsByMode: { normal: 300, security: 60 },
  });

  assert.equal(snapshot.sessionRevocationPlans.length, 1);
  assert.equal(snapshot.sessionRevocationPlans[0]!.revocationMode, "security");
  assert.equal(snapshot.sessionRevocationPlans[0]!.targetSloSeconds, 60);
});

test("IdentitySyncService.bootstrap() with agent assignments generates freeze directives", () => {
  const service = new IdentitySyncService();

  const events: ScimProvisioningEvent[] = [
    { eventId: "evt-1", action: "user_disabled", subjectId: "user-with-agents", occurredAt: "2026-05-01T10:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events, {
    agentAssignmentsBySubject: { "user-with-agents": ["agent-a", "agent-b"] },
  });

  assert.equal(snapshot.agentFreezeDirectives.length, 1);
  assert.deepEqual(snapshot.agentFreezeDirectives[0]!.agentIds, ["agent-a", "agent-b"]);
  assert.equal(snapshot.agentFreezeDirectives[0]!.reason, "identity_deconfigured");
});

test("IdentitySyncService.bootstrap() with security incident on user with agents uses security reason", () => {
  const service = new IdentitySyncService();

  const events: ScimProvisioningEvent[] = [
    { eventId: "evt-1", action: "user_deleted", subjectId: "user-security-agents", occurredAt: "2026-05-01T10:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events, {
    securityIncidentSubjectIds: ["user-security-agents"],
    agentAssignmentsBySubject: { "user-security-agents": ["agent-1"] },
  });

  assert.equal(snapshot.agentFreezeDirectives.length, 1);
  assert.equal(snapshot.agentFreezeDirectives[0]!.reason, "security_revocation");
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentitySyncService.bootstrap() detects conflict when same eventId has different action", () => {
  const service = new IdentitySyncService();

  const events = [
    { eventId: "evt-conflict", action: "user_created", subjectId: "user-1", occurredAt: "2026-05-01T10:00:00.000Z" },
    { eventId: "evt-conflict", action: "user_deleted", subjectId: "user-1", occurredAt: "2026-05-01T11:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.equal(snapshot.conflictReports.length, 1);
  assert.equal(snapshot.conflictReports[0]!.conflictType, "event_id_conflict");
  assert.ok(snapshot.conflictReports[0]!.conflictingFields.includes("action"));
});

test("IdentitySyncService.bootstrap() detects conflict when same eventId has different subjectId", () => {
  const service = new IdentitySyncService();

  const events = [
    { eventId: "evt-conflict-subject", action: "user_created", subjectId: "user-a", occurredAt: "2026-05-01T10:00:00.000Z" },
    { eventId: "evt-conflict-subject", action: "user_created", subjectId: "user-b", occurredAt: "2026-05-01T11:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.equal(snapshot.conflictReports.length, 1);
  assert.ok(snapshot.conflictReports[0]!.conflictingFields.includes("subjectId"));
});

test("IdentitySyncService.bootstrap() allows identical duplicate events", () => {
  const service = new IdentitySyncService();

  const events = [
    { eventId: "evt-identical", action: "user_created", subjectId: "user-1", occurredAt: "2026-05-01T10:00:00.000Z" },
    { eventId: "evt-identical", action: "user_created", subjectId: "user-1", occurredAt: "2026-05-01T10:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.equal(snapshot.appliedScimEvents.length, 1);
  assert.equal(snapshot.conflictReports.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// DLQ Routing Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentitySyncService.bootstrap() routes schema validation failures to DLQ", () => {
  const service = new IdentitySyncService();

  const events = [
    { eventId: "evt-valid", action: "user_created", subjectId: "user-1", occurredAt: "2026-05-01T10:00:00.000Z" },
    { eventId: "evt-invalid", action: "invalid_action", subjectId: "user-2", occurredAt: "2026-05-01T10:00:00.000Z" } as unknown as ScimProvisioningEvent,
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.equal(snapshot.dlqRecords.length, 1);
  assert.equal(snapshot.dlqRecords[0]!.failureCode, "schema_validation_failed");
});

test("IdentitySyncService.bootstrap() tracks multiple DLQ records", () => {
  const service = new IdentitySyncService();

  const events = [
    { eventId: "evt-1", action: "user_created", subjectId: "user-1", occurredAt: "2026-05-01T10:00:00.000Z" },
    { eventId: "evt-2", action: "user_created", subjectId: "user-2", occurredAt: "2026-05-01T10:00:00.000Z" },
    "invalid" as unknown as ScimProvisioningEvent,
    123 as unknown as ScimProvisioningEvent,
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.equal(snapshot.appliedScimEvents.length, 2);
  assert.equal(snapshot.dlqRecords.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Default SLO Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentitySyncService.bootstrap() uses default SLO when not specified", () => {
  const service = new IdentitySyncService();

  const events: ScimProvisioningEvent[] = [
    { eventId: "evt-1", action: "user_disabled", subjectId: "user-no-slo", occurredAt: "2026-05-01T10:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(createOidcConfig(), createSamlConfig(), events);

  assert.equal(snapshot.sessionRevocationPlans.length, 1);
  assert.equal(snapshot.sessionRevocationPlans[0]!.targetSloSeconds, 300); // default normal SLO
});