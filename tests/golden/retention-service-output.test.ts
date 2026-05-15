/**
 * Golden Test: Observability Retention Service Output
 *
 * Verifies retention service produces consistent report structure
 * for event, message, and compaction retention policies.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { ObservabilityRetentionService, type ObservabilityRetentionReport } from "../../src/platform/shared/observability/observability-retention-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: retention service preview has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-retention-preview-");

  const dbPath = `${workspace}/retention-preview.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const service = new ObservabilityRetentionService(db);
  const report = service.preview();

  // Verify structure
  assert.ok(report, "Report should exist");
  assert.ok(report.mode === "dry_run" || report.mode === "enforced", "Mode should be valid");
  assert.ok(report.evaluatedAt, "Should have evaluatedAt");
  assert.ok(report.policy, "Should have policy");
  assert.ok(report.events, "Should have events");
  assert.ok(report.messages, "Should have messages");
  assert.ok(report.compactions, "Should have compactions");

  assertGolden("retention-service-preview-structure", {
    mode: report.mode,
    hasEvaluatedAt: typeof report.evaluatedAt === "string" && report.evaluatedAt.length > 0,
    hasPolicy: report.policy !== null,
    hasEvents: report.events !== null,
    hasMessages: report.messages !== null,
    hasCompactions: report.compactions !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: retention service policy has correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-retention-policy-");

  const dbPath = `${workspace}/retention-policy.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const service = new ObservabilityRetentionService(db);
  const report = service.preview();

  const policy = report.policy;

  assert.ok(policy, "Policy should exist");
  assert.ok(policy.eventRetentionDays, "Should have event retention days");
  assert.ok(typeof policy.eventRetentionDays.tier1 === "number" || policy.eventRetentionDays.tier1 === null, "Tier1 should be number or null");
  assert.ok(typeof policy.eventRetentionDays.tier2 === "number", "Tier2 should be number");
  assert.ok(typeof policy.eventRetentionDays.tier3 === "number", "Tier3 should be number");
  assert.ok(typeof policy.terminalMessageRetentionDays === "number", "Terminal message retention should be number");
  assert.ok(Array.isArray(policy.preservedMessageTypes), "Preserved types should be array");

  assertGolden("retention-service-policy-structure", {
    tier1Retention: policy.eventRetentionDays.tier1,
    tier2Retention: policy.eventRetentionDays.tier2,
    tier3Retention: policy.eventRetentionDays.tier3,
    terminalMessageRetention: policy.terminalMessageRetentionDays,
    preservedTypes: policy.preservedMessageTypes,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: retention service event tier summaries have correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-retention-events-");

  const dbPath = `${workspace}/retention-events.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const service = new ObservabilityRetentionService(db);
  const report = service.preview();

  for (const [tier, summary] of Object.entries(report.events)) {
    assert.ok(typeof summary.retentionDays === "number" || summary.retentionDays === null, `${tier} retentionDays should be number or null`);
    assert.ok(typeof summary.totalCount === "number", `${tier} totalCount should be number`);
    assert.ok(typeof summary.eligibleCount === "number", `${tier} eligibleCount should be number`);
    assert.ok(typeof summary.deletedCount === "number", `${tier} deletedCount should be number`);
    assert.ok(summary.oldestEligibleCreatedAt === null || typeof summary.oldestEligibleCreatedAt === "string", `${tier} oldestEligibleCreatedAt should be string or null`);
  }

  assertGolden("retention-service-event-tiers", {
    tiers: Object.keys(report.events),
    tier1: {
      retentionDays: report.events.tier_1.retentionDays,
      totalCount: report.events.tier_1.totalCount,
    },
    tier2: {
      retentionDays: report.events.tier_2.retentionDays,
      totalCount: report.events.tier_2.totalCount,
    },
    tier3: {
      retentionDays: report.events.tier_3.retentionDays,
      totalCount: report.events.tier_3.totalCount,
    },
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: retention service message summary has correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-retention-messages-");

  const dbPath = `${workspace}/retention-messages.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const service = new ObservabilityRetentionService(db);
  const report = service.preview();

  const messages = report.messages;

  assert.ok(messages, "Messages summary should exist");
  assert.ok(typeof messages.retentionDays === "number", "Retention days should be number");
  assert.ok(typeof messages.totalCount === "number", "Total count should be number");
  assert.ok(typeof messages.eligibleCount === "number", "Eligible count should be number");
  assert.ok(typeof messages.deletedCount === "number", "Deleted count should be number");
  assert.ok(typeof messages.preservedSummaryCount === "number", "Preserved summary count should be number");
  assert.ok(typeof messages.preservedActiveSessionCount === "number", "Preserved active session count should be number");
  assert.ok(Array.isArray(messages.preservedMessageTypes), "Preserved message types should be array");

  assertGolden("retention-service-message-summary", {
    retentionDays: messages.retentionDays,
    totalCount: messages.totalCount,
    eligibleCount: messages.eligibleCount,
    preservedSummaryCount: messages.preservedSummaryCount,
    preservedActiveSessionCount: messages.preservedActiveSessionCount,
    preservedTypes: messages.preservedMessageTypes,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: retention service compaction summary has correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-retention-compactions-");

  const dbPath = `${workspace}/retention-compactions.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const service = new ObservabilityRetentionService(db);
  const report = service.preview();

  const compactions = report.compactions;

  assert.ok(compactions, "Compactions summary should exist");
  assert.ok(typeof compactions.totalCount === "number", "Total count should be number");
  assert.ok(typeof compactions.preservedCount === "number", "Preserved count should be number");
  assert.equal(compactions.totalCount, compactions.preservedCount, "All compactions should be preserved");

  assertGolden("retention-service-compaction-summary", {
    totalCount: compactions.totalCount,
    preservedCount: compactions.preservedCount,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: retention service JSON serialization is valid", () => {
  const workspace = createTempWorkspace("aa-golden-retention-json-");

  const dbPath = `${workspace}/retention-json.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const service = new ObservabilityRetentionService(db);
  const report = service.preview();

  // Should serialize to JSON without errors
  const json = JSON.stringify(report);
  assert.ok(json.length > 0, "Report should serialize to JSON");

  // Should deserialize back correctly
  const parsed = JSON.parse(json) as ObservabilityRetentionReport;
  assert.equal(parsed.mode, report.mode);
  assert.equal(parsed.policy.terminalMessageRetentionDays, report.policy.terminalMessageRetentionDays);

  db.close();
  cleanupPath(workspace);
});
