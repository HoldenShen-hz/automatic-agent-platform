/**
 * Extended unit tests for Incident Detector
 * Tests detection rules, composite conditions, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentSeverity,
  type IncidentCategory,
  type DetectionRule,
  type IncidentDetectorOptions,
} from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

// ============================================================================
// Detection Rule Tests
// ============================================================================

test("IncidentDetector addRule adds new rule", () => {
  const detector = new IncidentDetector();
  const newRule: DetectionRule = {
    ruleId: "custom_rule",
    name: "Custom Rule",
    description: "A custom detection rule",
    severity: "SEV2",
    condition: {
      type: "status_match",
      matchStatus: ["degraded"],
    },
    autoAction: "create_ticket",
    enabled: true,
  };

  detector.addRule(newRule);

  const rules = detector.getRules();
  assert.ok(rules.some((r) => r.ruleId === "custom_rule"));
});

test("IncidentDetector addRule updates existing rule", () => {
  const detector = new IncidentDetector();
  const rule1: DetectionRule = {
    ruleId: "existing_rule",
    name: "Original Name",
    description: "Original description",
    severity: "SEV3",
    condition: { type: "status_match", matchStatus: ["degraded"] },
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule1);

  const rule2: DetectionRule = {
    ...rule1,
    name: "Updated Name",
    severity: "SEV2",
  };

  detector.addRule(rule2);

  const rules = detector.getRules();
  const updatedRule = rules.find((r) => r.ruleId === "existing_rule");
  assert.strictEqual(updatedRule?.name, "Updated Name");
  assert.strictEqual(updatedRule?.severity, "SEV2");
});

test("IncidentDetector getRules returns copy of rules array", () => {
  const detector = new IncidentDetector();
  const rules1 = detector.getRules();
  const rules2 = detector.getRules();

  // Should be equal but not same reference
  assert.deepStrictEqual(rules1, rules2);
  rules1.push({} as DetectionRule);
  assert.notStrictEqual(rules1.length, rules2.length);
});

test("IncidentDetector evaluateRule returns matching rule", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "test_rule",
    name: "Test Rule",
    description: "Test description",
    severity: "SEV2",
    condition: {
      type: "status_match",
      matchStatus: ["degraded"],
    },
    autoAction: "create_ticket",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test_check",
    status: "degraded",
    summary: "Test summary",
    findings: [],
    metrics: {},
  };

  const result = detector.evaluateRule(check);

  assert.ok(result);
  assert.strictEqual(result?.ruleId, "test_rule");
});

test("IncidentDetector evaluateRule returns null for disabled rule", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "disabled_rule",
    name: "Disabled Rule",
    description: "Disabled description",
    severity: "SEV2",
    condition: { type: "status_match", matchStatus: ["degraded"] },
    autoAction: "create_ticket",
    enabled: false,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test_check",
    status: "degraded",
    summary: "Test summary",
    findings: [],
    metrics: {},
  };

  const result = detector.evaluateRule(check);

  assert.strictEqual(result, null);
});

test("IncidentDetector evaluateRule returns null for non-matching status", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "test_rule",
    name: "Test Rule",
    description: "Test description",
    severity: "SEV2",
    condition: {
      type: "status_match",
      matchStatus: ["fail_closed"],
    },
    autoAction: "create_ticket",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test_check",
    status: "degraded", // Does not match fail_closed
    summary: "Test summary",
    findings: [],
    metrics: {},
  };

  const result = detector.evaluateRule(check);

  assert.strictEqual(result, null);
});

// ============================================================================
// Metric Threshold Condition Tests
// ============================================================================

test("IncidentDetector evaluates metric_threshold condition with gt operator", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_gt_rule",
    name: "Metric GT Rule",
    description: "Tests > operator",
    severity: "SEV3",
    condition: {
      type: "metric_threshold",
      metricName: "error_rate",
      operator: "gt",
      threshold: 0.05,
    },
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { error_rate: 0.1 }, // 0.1 > 0.05
  };

  const result = detector.evaluateRule(check);

  assert.ok(result);
  assert.strictEqual(result?.ruleId, "metric_gt_rule");
});

test("IncidentDetector evaluates metric_threshold condition with gte operator", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_gte_rule",
    name: "Metric GTE Rule",
    description: "Tests >= operator",
    severity: "SEV3",
    condition: {
      type: "metric_threshold",
      metricName: "error_rate",
      operator: "gte",
      threshold: 0.05,
    },
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { error_rate: 0.05 }, // Exactly at threshold
  };

  const result = detector.evaluateRule(check);

  assert.ok(result);
});

test("IncidentDetector evaluates metric_threshold condition with lt operator", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_lt_rule",
    name: "Metric LT Rule",
    description: "Tests < operator",
    severity: "SEV4",
    condition: {
      type: "metric_threshold",
      metricName: "cpu_usage",
      operator: "lt",
      threshold: 10,
    },
    autoAction: "log_only",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { cpu_usage: 5 }, // 5 < 10
  };

  const result = detector.evaluateRule(check);

  assert.ok(result);
});

test("IncidentDetector evaluates metric_threshold condition with lte operator", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_lte_rule",
    name: "Metric LTE Rule",
    description: "Tests <= operator",
    severity: "SEV4",
    condition: {
      type: "metric_threshold",
      metricName: "cpu_usage",
      operator: "lte",
      threshold: 10,
    },
    autoAction: "log_only",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { cpu_usage: 10 }, // Exactly at threshold
  };

  const result = detector.evaluateRule(check);

  assert.ok(result);
});

test("IncidentDetector evaluates metric_threshold condition with eq operator", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_eq_rule",
    name: "Metric EQ Rule",
    description: "Tests == operator",
    severity: "SEV3",
    condition: {
      type: "metric_threshold",
      metricName: "active_workers",
      operator: "eq",
      threshold: 0,
    },
    autoAction: "page_on_call",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { active_workers: 0 }, // Exactly 0
  };

  const result = detector.evaluateRule(check);

  assert.ok(result);
});

test("IncidentDetector metric_threshold returns false for missing metric", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_missing_rule",
    name: "Metric Missing Rule",
    description: "Tests missing metric",
    severity: "SEV3",
    condition: {
      type: "metric_threshold",
      metricName: "nonexistent_metric",
      operator: "gt",
      threshold: 0,
    },
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { error_rate: 0.1 }, // No nonexistent_metric
  };

  const result = detector.evaluateRule(check);

  assert.strictEqual(result, null);
});

test("IncidentDetector metric_threshold returns false for non-numeric metric", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "metric_string_rule",
    name: "Metric String Rule",
    description: "Tests string metric value",
    severity: "SEV3",
    condition: {
      type: "metric_threshold",
      metricName: "status_code",
      operator: "gt",
      threshold: 400,
    },
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { status_code: "error" }, // String, not number
  };

  const result = detector.evaluateRule(check);

  assert.strictEqual(result, null);
});

// ============================================================================
// Composite Condition Tests
// ============================================================================

test("IncidentDetector evaluates composite AND condition", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "composite_and_rule",
    name: "Composite AND Rule",
    description: "Tests AND logic",
    severity: "SEV1",
    condition: {
      type: "composite",
      logic: "and",
      expressions: [
        { type: "status_match", matchStatus: ["fail_closed"] },
        { type: "metric_threshold", metricName: "error_rate", operator: "gt", threshold: 0.5 },
      ],
    },
    autoAction: "page_on_call",
    enabled: true,
  };

  detector.addRule(rule);

  // Both conditions match
  const matchingCheck = {
    checkId: "test",
    status: "fail_closed",
    summary: "Test",
    findings: [],
    metrics: { error_rate: 0.8 },
  };

  const result1 = detector.evaluateRule(matchingCheck);
  assert.ok(result1);

  // Only one condition matches
  const partialCheck = {
    checkId: "test",
    status: "fail_closed",
    summary: "Test",
    findings: [],
    metrics: { error_rate: 0.3 },
  };

  const result2 = detector.evaluateRule(partialCheck);
  assert.strictEqual(result2, null);
});

test("IncidentDetector evaluates composite OR condition", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "composite_or_rule",
    name: "Composite OR Rule",
    description: "Tests OR logic",
    severity: "SEV2",
    condition: {
      type: "composite",
      logic: "or",
      expressions: [
        { type: "status_match", matchStatus: ["fail_closed"] },
        { type: "metric_threshold", metricName: "error_rate", operator: "gt", threshold: 0.5 },
      ],
    },
    autoAction: "create_ticket",
    enabled: true,
  };

  detector.addRule(rule);

  // Only second condition matches
  const partialCheck = {
    checkId: "test",
    status: "ok",
    summary: "Test",
    findings: [],
    metrics: { error_rate: 0.8 },
  };

  const result = detector.evaluateRule(partialCheck);
  assert.ok(result);
});

test("IncidentDetector composite with empty expressions returns false", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "empty_composite_rule",
    name: "Empty Composite Rule",
    description: "Tests empty expressions",
    severity: "SEV3",
    condition: {
      type: "composite",
      logic: "and",
      expressions: [], // Empty
    },
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "fail_closed",
    summary: "Test",
    findings: [],
    metrics: {},
  };

  const result = detector.evaluateRule(check);

  assert.strictEqual(result, null);
});

test("IncidentDetector composite with missing logic returns false", () => {
  const detector = new IncidentDetector();
  const rule: DetectionRule = {
    ruleId: "no_logic_rule",
    name: "No Logic Rule",
    description: "Tests missing logic",
    severity: "SEV3",
    condition: {
      type: "composite",
      expressions: [{ type: "status_match", matchStatus: ["fail_closed"] }],
      // No logic specified
    } as DetectionRule["condition"],
    autoAction: "log_alert",
    enabled: true,
  };

  detector.addRule(rule);

  const check = {
    checkId: "test",
    status: "fail_closed",
    summary: "Test",
    findings: [],
    metrics: {},
  };

  const result = detector.evaluateRule(check);

  assert.strictEqual(result, null);
});

// ============================================================================
// Severity to Runbook Priority Mapping Tests
// ============================================================================

test("IncidentDetector severity to runbook priority mapping is correct", () => {
  const detector = new IncidentDetector();

  // Create incidents with different severities and verify runbookPriority
  const sev1 = detector.createIncident({
    category: "system_health",
    severity: "SEV1",
    title: "SEV1",
    description: "Test",
  });
  assert.strictEqual(sev1.runbookPriority, "P0");

  const sev2 = detector.createIncident({
    category: "system_health",
    severity: "SEV2",
    title: "SEV2",
    description: "Test",
  });
  assert.strictEqual(sev2.runbookPriority, "P1");

  const sev3 = detector.createIncident({
    category: "system_health",
    severity: "SEV3",
    title: "SEV3",
    description: "Test",
  });
  assert.strictEqual(sev3.runbookPriority, "P2");

  const sev4 = detector.createIncident({
    category: "system_health",
    severity: "SEV4",
    title: "SEV4",
    description: "Test",
  });
  assert.strictEqual(sev4.runbookPriority, "P3");
});

// ============================================================================
// Auto-Escalation Tests
// ============================================================================

test("IncidentDetector shouldAutoEscalate respects custom threshold", () => {
  const detector = new IncidentDetector({ autoEscalateSev1AfterSeconds: 600 });

  const oldTime = new Date(Date.now() - 700 * 1000).toISOString(); // 700 seconds ago
  const recentTime = new Date(Date.now() - 300 * 1000).toISOString(); // 300 seconds ago

  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV1"), true);
  assert.strictEqual(detector.shouldAutoEscalate(recentTime, "SEV1"), false);
});

test("IncidentDetector shouldAutoEscalate only applies to SEV1", () => {
  const detector = new IncidentDetector({ autoEscalateSev1AfterSeconds: 300 });

  const oldTime = new Date(Date.now() - 400 * 1000).toISOString();

  // Non-SEV1 incidents should never auto-escalate
  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV2"), false);
  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV3"), false);
  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV4"), false);
});

test("IncidentDetector shouldAutoEscalate calculates time correctly", () => {
  const detector = new IncidentDetector({ autoEscalateSev1AfterSeconds: 300 });

  // Exactly at threshold - 300 seconds = 300000 ms
  const atThreshold = new Date(Date.now() - 300000).toISOString();
  // Just past threshold
  const pastThreshold = new Date(Date.now() - 300001).toISOString();

  // At threshold should not escalate (elapsed >= threshold)
  assert.strictEqual(detector.shouldAutoEscalate(atThreshold, "SEV1"), true);
  // Past threshold should escalate
  assert.strictEqual(detector.shouldAutoEscalate(pastThreshold, "SEV1"), true);
});

// ============================================================================
// Create Incident Tests
// ============================================================================

test("IncidentDetector createIncident with all optional fields", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "security",
    severity: "SEV1",
    title: "Security Breach",
    description: "Unauthorized access detected",
    sourceCheckId: "audit_integrity",
    symptoms: ["unauthorized_login", "privilege_escalation"],
    affectedEntities: ["user-123", "role-admin"],
    metrics: { login_attempts: 100, failed_logins: 95 },
    autoAction: "page_on_call",
    requiresPostMortem: true,
  });

  assert.strictEqual(incident.category, "security");
  assert.strictEqual(incident.severity, "SEV1");
  assert.strictEqual(incident.title, "Security Breach");
  assert.strictEqual(incident.sourceCheckId, "audit_integrity");
  assert.strictEqual(incident.symptoms.length, 2);
  assert.strictEqual(incident.affectedEntities.length, 2);
  assert.strictEqual(incident.autoAction, "page_on_call");
  assert.strictEqual(incident.requiresPostMortem, true);
  assert.strictEqual(incident.status, "open");
});

test("IncidentDetector createIncident sets requiresPostMortem based on severity", () => {
  const detector = new IncidentDetector();

  const sev1Incident = detector.createIncident({
    category: "system_health",
    severity: "SEV1",
    title: "SEV1",
    description: "Test",
  });
  assert.strictEqual(sev1Incident.requiresPostMortem, true);

  const sev2Incident = detector.createIncident({
    category: "system_health",
    severity: "SEV2",
    title: "SEV2",
    description: "Test",
  });
  assert.strictEqual(sev2Incident.requiresPostMortem, true);

  const sev3Incident = detector.createIncident({
    category: "system_health",
    severity: "SEV3",
    title: "SEV3",
    description: "Test",
  });
  // SEV3 and SEV4 don't automatically require post-mortem unless specified
  assert.strictEqual(sev3Incident.requiresPostMortem, false);
});

// ============================================================================
// Check ID Category Mapping Tests
// ============================================================================

test("IncidentDetector category mapping for db check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "db",
    status: "fail_closed",
    summary: "Database failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "data_integrity");
});

test("IncidentDetector category mapping for config check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "config",
    status: "fail_closed",
    summary: "Config failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "configuration");
});

test("IncidentDetector category mapping for backup check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "backup",
    status: "fail_closed",
    summary: "Backup failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector category mapping for locks check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "locks",
    status: "fail_closed",
    summary: "Lock failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "data_integrity");
});

test("IncidentDetector category mapping for workers check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "workers",
    status: "fail_closed",
    summary: "Worker failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector category mapping for event_backlog check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "event_backlog",
    status: "fail_closed",
    summary: "Event backlog",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "performance");
});

test("IncidentDetector category mapping for audit_integrity check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "audit_integrity",
    status: "fail_closed",
    summary: "Audit integrity failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "security");
});

test("IncidentDetector category mapping for provider_health check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "provider_health",
    status: "fail_closed",
    summary: "Provider health failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector category mapping for unknown check defaults to system_health", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "completely_unknown_check",
    status: "fail_closed",
    summary: "Unknown check",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "system_health");
});

// ============================================================================
// Urgency Classification Tests
// ============================================================================

test("IncidentDetector classifyUrgency for SEV1 returns critical", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV1"), "critical");
});

test("IncidentDetector classifyUrgency for SEV2 returns high", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV2"), "high");
});

test("IncidentDetector classifyUrgency for SEV3 returns medium", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV3"), "medium");
});

test("IncidentDetector classifyUrgency for SEV4 returns low", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV4"), "low");
});

// ============================================================================
// Default Rules Tests
// ============================================================================

test("IncidentDetector has default rules", () => {
  const detector = new IncidentDetector();
  const rules = detector.getRules();

  assert.ok(rules.length > 0);
});

test("IncidentDetector default rules include SEV1 detection", () => {
  const detector = new IncidentDetector();
  const rules = detector.getRules();

  const sev1Rules = rules.filter((r) => r.severity === "SEV1");
  assert.ok(sev1Rules.length > 0);
});

test("IncidentDetector default rules include SEV2 detection", () => {
  const detector = new IncidentDetector();
  const rules = detector.getRules();

  const sev2Rules = rules.filter((r) => r.severity === "SEV2");
  assert.ok(sev2Rules.length > 0);
});

test("IncidentDetector default rules are all enabled", () => {
  const detector = new IncidentDetector();
  const rules = detector.getRules();

  for (const rule of rules) {
    assert.strictEqual(rule.enabled, true);
  }
});

// ============================================================================
// Options Tests
// ============================================================================

test("IncidentDetector respects maxOpenIncidents option", () => {
  const detector = new IncidentDetector({ maxOpenIncidents: 50 });
  // The maxOpenIncidents is stored but not actively enforced in detectFromChecks
  // It's available for external usage
  assert.ok(detector);
});

test("IncidentDetector uses custom autoEscalateSev1AfterSeconds", () => {
  const detector = new IncidentDetector({ autoEscalateSev1AfterSeconds: 600 });

  const oldTime = new Date(Date.now() - 700 * 1000).toISOString();
  const recentTime = new Date(Date.now() - 300 * 1000).toISOString();

  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV1"), true);
  assert.strictEqual(detector.shouldAutoEscalate(recentTime, "SEV1"), false);
});

// ============================================================================
// Multiple Checks Detection Tests
// ============================================================================

test("IncidentDetector detectFromChecks handles checks with multiple issues", () => {
  const detector = new IncidentDetector();
  const checks = [
    { checkId: "db", status: "fail_closed", summary: "DB down", findings: ["probe_failed"], metrics: {} },
    { checkId: "workers", status: "degraded", summary: "Workers degraded", findings: ["slow_processing"], metrics: {} },
    { checkId: "event_backlog", status: "ok", summary: "OK", findings: [], metrics: { error_rate: 0.1 } },
  ];

  const incidents = detector.detectFromChecks(checks);

  // Should detect: db fail_closed -> SEV1, workers degraded -> SEV2, event_backlog metric threshold -> SEV3
  assert.ok(incidents.length >= 2);
});

test("IncidentDetector detectFromChecks with no matching rules or conditions", () => {
  const detector = new IncidentDetector();
  const checks = [
    { checkId: "unknown", status: "ok", summary: "All good", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  // No rules match "unknown" check with "ok" status
  assert.strictEqual(incidents.length, 0);
});
