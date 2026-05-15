/**
 * Knowledge Audit Logger Tests
 *
 * Tests for knowledge access audit logging:
 * - Access decision logging with correct levels
 * - Cross-domain vs same-domain decision handling
 * - Recent entries retrieval
 * - Integration with StructuredLogger
 *
 * Architecture: §50 Knowledge Domain Isolation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../../../../../../src/platform/shared/observability/structured-logger.js";
import { KnowledgeAuditLogger } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/governance/knowledge-audit-logger.js";
import type { KnowledgeAccessDecision } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/governance/access-control.js";

function createDecision(overrides: Partial<KnowledgeAccessDecision> = {}): KnowledgeAccessDecision {
  return {
    allowed: true,
    action: "read",
    principalId: "user_123",
    principalDomainId: "ops",
    namespace: "ops/incident",
    ownerDomainId: "ops",
    crossDomain: false,
    reasonCode: "knowledge.access.public",
    ...overrides,
  };
}

test("KnowledgeAuditLogger logs allowed same-domain access at info level", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    allowed: true,
    crossDomain: false,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry) {
    assert.equal(entry.level, "info");
    assert.equal(entry.message, "knowledge.audit.access");
  }
});

test("KnowledgeAuditLogger logs allowed cross-domain access at warn level", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    allowed: true,
    crossDomain: true,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry) {
    assert.equal(entry.level, "warn");
  }
});

test("KnowledgeAuditLogger logs denied access at error level", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    allowed: false,
    crossDomain: false,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry) {
    assert.equal(entry.level, "error");
  }
});

test("KnowledgeAuditLogger logs denied cross-domain access at error level", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    allowed: false,
    crossDomain: true,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry) {
    assert.equal(entry.level, "error");
  }
});

test("KnowledgeAuditLogger includes decision data in log entry", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    principalId: "user_special",
    principalDomainId: "billing",
    namespace: "ops/security",
    ownerDomainId: "ops",
    crossDomain: true,
    action: "read",
    allowed: false,
    reasonCode: "knowledge.access.cross_domain_denied",
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry && entry.data) {
    assert.equal(entry.data.principalId, "user_special");
    assert.equal(entry.data.principalDomainId, "billing");
    assert.equal(entry.data.namespace, "ops/security");
    assert.equal(entry.data.ownerDomainId, "ops");
    assert.equal(entry.data.action, "read");
    assert.equal(entry.data.allowed, false);
    assert.equal(entry.data.crossDomain, true);
    assert.equal(entry.data.reasonCode, "knowledge.access.cross_domain_denied");
  }
});

test("KnowledgeAuditLogger uses principalId as correlationId", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    principalId: "corr_principal",
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry) {
    assert.equal(entry.correlationId, "corr_principal");
  }
});

test("KnowledgeAuditLogger uses namespace as correlationId when principalId is null", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    principalId: null,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry) {
    assert.equal(entry.correlationId, "ops/incident");
  }
});

test("KnowledgeAuditLogger recent returns limited entries", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 50 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  for (let i = 0; i < 10; i++) {
    auditLogger.logAccess(createDecision({ principalId: `user_${i}` }));
  }

  const entries = auditLogger.recent(5);
  assert.equal(entries.length, 5);
});

test("KnowledgeAuditLogger recent returns all entries when limit exceeds count", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 50 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  auditLogger.logAccess(createDecision({ principalId: "user_1" }));
  auditLogger.logAccess(createDecision({ principalId: "user_2" }));

  const entries = auditLogger.recent(100);
  assert.equal(entries.length, 2);
});

test("KnowledgeAuditLogger uses default StructuredLogger when none provided", () => {
  const auditLogger = new KnowledgeAuditLogger();
  const decision = createDecision();

  // Should not throw
  auditLogger.logAccess(decision);

  const entries = auditLogger.recent(1);
  assert.ok(entries.length >= 1);
});

test("KnowledgeAuditLogger handles write action", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    action: "write",
    allowed: true,
    crossDomain: false,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry && entry.data) {
    assert.equal(entry.data.action, "write");
  }
});

test("KnowledgeAuditLogger handles admin action", () => {
  const structuredLogger = new StructuredLogger({ retentionLimit: 20 });
  const auditLogger = new KnowledgeAuditLogger(structuredLogger);

  const decision = createDecision({
    action: "admin",
    allowed: true,
    crossDomain: false,
  });

  auditLogger.logAccess(decision);

  const entries = structuredLogger.recent(1);
  assert.ok(entries.length > 0);
  const entry = entries[0];
  if (entry && entry.data) {
    assert.equal(entry.data.action, "admin");
  }
});