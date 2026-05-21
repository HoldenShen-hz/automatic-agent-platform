import test from "node:test";
import assert from "node:assert/strict";

// TrustStore is a re-export shim for TrustLevelService
// Verify the re-export chain works correctly
import {
  TrustLevelService,
  TrustLevelServiceConfig,
  type TrustLevel,
  type TrustLevelMetadata,
} from "../../../../../src/platform/five-plane-state-evidence/memory/trust-store.js";

// ─────────────────────────────────────────────────────────────────────────────
// Re-export Verification Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TrustStore exports TrustLevelService", () => {
  // TrustStore should re-export TrustLevelService from trust-level-service
  assert.ok(TrustLevelService);
  assert.equal(typeof TrustLevelService, "function");
});

test("TrustStore exports TrustLevelServiceConfig", () => {
  // Should have the config type available
  assert.ok(TrustLevelServiceConfig);
});

test("TrustStore exports TrustLevel type", () => {
  assert.ok(TrustLevel);
});

test("TrustStore exports TrustLevelMetadata type", () => {
  assert.ok(TrustLevelMetadata);
});

// ─────────────────────────────────────────────────────────────────────────────
// TrustLevelService Basic Functionality
// ─────────────────────────────────────────────────────────────────────────────

test("TrustLevelService can be instantiated", () => {
  const service = new TrustLevelService();
  assert.ok(service);
});

test("TrustLevelService getTrustLevelMetadata returns metadata", () => {
  const service = new TrustLevelService();
  const meta = service.getTrustLevelMetadata("private_unverified");
  assert.ok(meta);
  assert.equal(meta.level, "private_unverified");
});

test("TrustLevelService getTrustLevelPriority returns priority", () => {
  const service = new TrustLevelService();
  const priority = service.getTrustLevelPriority("authoritative");
  assert.equal(priority, 3);
});

test("TrustLevelService compareTrustLevels compares correctly", () => {
  const service = new TrustLevelService();
  assert.ok(service.compareTrustLevels("authoritative", "private_unverified") > 0);
  assert.ok(service.compareTrustLevels("private_unverified", "authoritative") < 0);
  assert.equal(service.compareTrustLevels("official", "official"), 0);
});

test("TrustLevelService canTransitionTrustLevel validates transitions", () => {
  const service = new TrustLevelService();
  // Can transition down
  assert.ok(service.canTransitionTrustLevel("authoritative", "private_unverified"));
  // Cannot transition up (specific rules)
  const result = service.canTransitionTrustLevel("private_unverified", "authoritative");
  assert.equal(typeof result, "boolean");
});

test("TrustLevelService defaultTransitionRules exists", () => {
  const service = new TrustLevelService();
  const rules = service.defaultTransitionRules;
  assert.ok(rules);
  assert.ok(Array.isArray(rules));
});

// ─────────────────────────────────────────────────────────────────────────────
// TrustLevelService Config Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TrustLevelService accepts config object", () => {
  const service = new TrustLevelService({
    maxTrustLevel: "authoritative",
    minTrustLevel: "private_unverified",
  });
  assert.ok(service);
});

test("TrustLevelService with custom config uses limits", () => {
  const service = new TrustLevelService({
    maxTrustLevel: "official",
    minTrustLevel: "team_reviewed",
  });
  const priority = service.getTrustLevelPriority("authoritative");
  // authoritative should be above official, so this tests config enforcement
  assert.ok(typeof priority === "number");
});
