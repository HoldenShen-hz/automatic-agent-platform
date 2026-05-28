import assert from "node:assert/strict";
import test from "node:test";

import {
  DataClassificationService,
  type DataClassificationLevel,
  type DataHandlingDimension,
  type PiiType,
} from "../../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";

test("DataClassificationService detects email PII", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Contact me at john@example.com");
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0]!.type, "email");
  assert.equal(annotations[0]!.redactedForm, "jo***@example.com");
});

test("DataClassificationService detects phone PII", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Call me at 555-123-4567");
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0]!.type, "phone");
});

test("DataClassificationService detects SSN PII", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("SSN: 123-45-6789");
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0]!.type, "ssn");
  assert.equal(annotations[0]!.redactedForm, "***-**-6789");
});

test("DataClassificationService detects credit card PII", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Card: 1234-5678-9012-3456");
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0]!.type, "credit_card");
  assert.equal(annotations[0]!.redactedForm, "****-****-****-3456");
});

test("DataClassificationService detects IP address PII", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Server IP: 192.168.1.1");
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0]!.type, "ip_address");
  assert.equal(annotations[0]!.redactedForm, "0.0.0.0");
});

test("DataClassificationService detects multiple PII types", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Email: test@example.com, Phone: 555-123-4567");
  assert.equal(annotations.length, 2);
  const types = annotations.map((a) => a.type);
  assert.ok(types.includes("email"));
  assert.ok(types.includes("phone"));
});

test("DataClassificationService detects no PII in normal text", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("This is normal text with no sensitive data");
  assert.equal(annotations.length, 0);
});

test("DataClassificationService classifies public content", () => {
  const service = new DataClassificationService();
  const result = service.classify("This is a public announcement for everyone");
  assert.equal(result.level, "public");
});

test("DataClassificationService classifies internal content", () => {
  const service = new DataClassificationService();
  const result = service.classify("This is internal use only");
  assert.equal(result.level, "internal");
});

test("DataClassificationService classifies confidential content", () => {
  const service = new DataClassificationService();
  const result = service.classify("This is proprietary and trade secret information");
  assert.equal(result.level, "confidential");
});

test("DataClassificationService classifies restricted content", () => {
  const service = new DataClassificationService();
  const result = service.classify("This is top secret classified information");
  assert.equal(result.level, "restricted");
});

test("DataClassificationService detects restricted keyword api key", () => {
  const service = new DataClassificationService();
  const result = service.classify("My api key is sk-1234567890");
  assert.equal(result.level, "restricted");
});

test("DataClassificationService detects restricted keyword password", () => {
  const service = new DataClassificationService();
  const result = service.classify("The password is supersecret");
  assert.equal(result.level, "restricted");
});

test("DataClassificationService upgrades public to confidential when PII detected", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const result = service.classify("Contact john@example.com for details");
  assert.equal(result.level, "confidential");
  assert.equal(result.piiDetected, true);
});

test("DataClassificationService handles multiple PII types", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const result = service.classify("Email: test@test.com, SSN: 123-45-6789");
  assert.ok(result.piiTypes.length >= 1);
});

test("DataClassificationService getHandlingDecision returns allow for public prompt", () => {
  const service = new DataClassificationService();
  const decision = service.getHandlingDecision("public", "prompt");
  assert.equal(decision.allowed, true);
  assert.equal(decision.action, "allow");
});

test("DataClassificationService getHandlingDecision returns deny for restricted debug", () => {
  const service = new DataClassificationService();
  const decision = service.getHandlingDecision("restricted", "debug");
  assert.equal(decision.allowed, false);
  assert.equal(decision.action, "deny");
});

test("DataClassificationService getHandlingDecision returns redact for internal logs", () => {
  const service = new DataClassificationService();
  const decision = service.getHandlingDecision("internal", "logs");
  assert.equal(decision.action, "redact");
});

test("DataClassificationService getHandlingDecision strict mode downgrades allow", () => {
  const service = new DataClassificationService({ strictMode: true });
  const decision = service.getHandlingDecision("internal", "prompt");
  assert.equal(decision.action, "audit");
});

test("DataClassificationService filterForPrompt denies restricted content", () => {
  const service = new DataClassificationService();
  const result = service.filterForPrompt("top secret classified information");
  assert.equal(result.filtered, "[CONTENT DENIED DUE TO CLASSIFICATION POLICY]");
  assert.equal(result.decision.action, "deny");
});

test("DataClassificationService filterForPrompt audits confidential content", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const result = service.filterForPrompt("Email me at john@example.com");
  assert.ok(!result.filtered.includes("john@example.com"));
  // confidential content on prompt dimension returns 'audit' action (not 'redact')
  assert.equal(result.decision.action, "audit");
});

test("DataClassificationService filterForPrompt allows public content", () => {
  const service = new DataClassificationService();
  const result = service.filterForPrompt("This is public information");
  assert.equal(result.filtered, "This is public information");
  assert.equal(result.decision.action, "allow");
});

test("DataClassificationService filterForLogs denies restricted", () => {
  const service = new DataClassificationService();
  const result = service.filterForLogs("secret api key information");
  assert.equal(result.filtered, "[LOG DENIED DUE TO CLASSIFICATION POLICY]");
});

test("DataClassificationService filterForLogs redacts internal", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const result = service.filterForLogs("Internal log with test@test.com email");
  assert.ok(!result.filtered.includes("test@test.com"));
});

test("DataClassificationService filterForMemory denies restricted", () => {
  const service = new DataClassificationService();
  const result = service.filterForMemory("password is secret");
  assert.equal(result.filtered, "[MEMORY DENIED DUE TO CLASSIFICATION POLICY]");
});

test("DataClassificationService filterForMemory denies restricted content", () => {
  const service = new DataClassificationService();
  const result = service.filterForMemory("classified sensitive data");
  // restricted content on memory dimension returns 'deny' action
  assert.equal(result.filtered, "[MEMORY DENIED DUE TO CLASSIFICATION POLICY]");
  assert.equal(result.decision.action, "deny");
});

test("DataClassificationService redactContent replaces PII", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Email: test@example.com");
  const redacted = service.redactContent("Email: test@example.com", annotations);
  assert.ok(!redacted.includes("test@example.com"));
  assert.ok(redacted.includes("te***@example.com"));
});

test("DataClassificationService redactContent handles empty annotations", () => {
  const service = new DataClassificationService();
  const redacted = service.redactContent("Normal text", []);
  assert.equal(redacted, "Normal text");
});

test("DataClassificationService redactContent handles multiple annotations", () => {
  const service = new DataClassificationService({ autoDetectPii: true });
  const annotations = service.detectPii("Email: a@b.com, Phone: 555-123-4567");
  const redacted = service.redactContent("Email: a@b.com, Phone: 555-123-4567", annotations);
  assert.ok(!redacted.includes("a@b.com"));
  assert.ok(!redacted.includes("555-123-4567"));
});

test("DataClassificationService defineRule creates rule", () => {
  const service = new DataClassificationService();
  const rule = service.defineRule({
    name: "Test Rule",
    level: "confidential",
    patterns: ["secret"],
    keywords: [],
    autoClassify: true,
  });
  assert.ok(rule.id.startsWith("classrule_"));
  assert.equal(rule.level, "confidential");
});

test("DataClassificationService getRule retrieves rule", () => {
  const service = new DataClassificationService();
  const rule = service.defineRule({
    name: "Test Rule",
    level: "internal",
    patterns: [],
    keywords: ["classified"],
    autoClassify: true,
  });
  const retrieved = service.getRule(rule.id);
  assert.equal(retrieved?.name, "Test Rule");
});

test("DataClassificationService getRule returns null for unknown id", () => {
  const service = new DataClassificationService();
  const retrieved = service.getRule("unknown-id");
  assert.equal(retrieved, null);
});

test("DataClassificationService deleteRule removes rule", () => {
  const service = new DataClassificationService();
  const rule = service.defineRule({
    name: "Test Rule",
    level: "internal",
    patterns: [],
    keywords: ["test"],
    autoClassify: true,
  });
  const deleted = service.deleteRule(rule.id);
  assert.equal(deleted, true);
  assert.equal(service.getRule(rule.id), null);
});

test("DataClassificationService listRules returns all rules", () => {
  const service = new DataClassificationService();
  service.defineRule({
    name: "Rule 1",
    level: "internal",
    patterns: [],
    keywords: ["test1"],
    autoClassify: true,
  });
  service.defineRule({
    name: "Rule 2",
    level: "confidential",
    patterns: [],
    keywords: ["test2"],
    autoClassify: false,
  });
  const rules = service.listRules();
  assert.equal(rules.length, 2);
});

test("DataClassificationService classify applies rule match", () => {
  const service = new DataClassificationService();
  service.defineRule({
    name: "Custom Rule",
    level: "confidential",
    patterns: ["CUSTOM_PATTERN"],
    keywords: [],
    autoClassify: true,
  });
  const result = service.classify("This contains CUSTOM_PATTERN in it");
  assert.equal(result.level, "confidential");
});

test("DataClassificationService ignores unsafe custom regex rules", () => {
  const service = new DataClassificationService();
  service.defineRule({
    name: "Unsafe Rule",
    level: "restricted",
    patterns: ["("],
    keywords: [],
    autoClassify: true,
  });

  const result = service.classify("This would have crashed before.");
  assert.equal(result.level, "public");
});

test("DataClassificationService auditLog records decisions", () => {
  const service = new DataClassificationService({ enableAuditTrail: true });
  service.filterForPrompt("confidential information");
  const log = service.getAuditLog();
  assert.ok(log.length > 0);
});

test("DataClassificationService clearAuditLog requires authorization and records a clear marker", () => {
  const service = new DataClassificationService({ enableAuditTrail: true });
  service.filterForPrompt("confidential information");
  assert.throws(
    () => service.clearAuditLog({ principalId: "viewer", authorized: false }),
    /data_classification\.audit_log_clear_forbidden/,
  );
  service.clearAuditLog({ principalId: "operator-1", authorized: true, reason: "retention_window" });
  const log = service.getAuditLog();
  assert.equal(log.length, 1);
  assert.match(log[0]?.reason ?? "", /^audit_log_cleared:retention_window:1$/);
});

test("DataClassificationService getAuditLog respects limit", () => {
  const service = new DataClassificationService({ enableAuditTrail: true });
  // Use restricted content to trigger non-allow action (deny) so audit entries are created
  for (let i = 0; i < 10; i++) {
    service.filterForPrompt(`secret api key ${i}`);
  }
  const log = service.getAuditLog(5);
  assert.equal(log.length, 5);
});

test("DataClassificationService evicts oldest audit entries beyond maxAuditLogEntries", () => {
  const service = new DataClassificationService({ enableAuditTrail: true, maxAuditLogEntries: 3 });
  for (let i = 0; i < 5; i++) {
    service.filterForPrompt(`secret api key ${i}`);
  }

  const log = service.getAuditLog(10);
  assert.equal(log.length, 3);
  assert.deepEqual(log.map((entry) => entry.originalContent), [
    "secret api key 2",
    "secret api key 3",
    "secret api key 4",
  ]);
});

test("DataClassificationLevel type accepts all valid values", () => {
  const levels: DataClassificationLevel[] = ["public", "internal", "confidential", "restricted"];
  assert.equal(levels.length, 4);
});

test("DataHandlingDimension type accepts all valid values", () => {
  const dimensions: DataHandlingDimension[] = ["prompt", "logs", "memory", "artifact", "cross_worker", "debug"];
  assert.equal(dimensions.length, 6);
});

test("PiiType type accepts all valid values", () => {
  const types: PiiType[] = ["email", "phone", "ssn", "credit_card", "ip_address", "name", "address", "dob", "none"];
  assert.equal(types.length, 9);
});
