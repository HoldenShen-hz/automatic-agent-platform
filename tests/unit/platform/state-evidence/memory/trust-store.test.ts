import test from "node:test";
import assert from "node:assert/strict";

import {
  TrustLevelService,
  getTrustLevelMetadata,
  getTrustLevelPriority,
  compareTrustLevels,
  DEFAULT_TRUST_TRANSITION_RULES,
} from "../../../../../src/platform/five-plane-state-evidence/memory/trust-store.js";
import type {
  TrustLevel,
  TrustLevelMetadata,
  TrustTransitionRule,
} from "../../../../../src/platform/five-plane-state-evidence/memory/trust-store.js";

test("TrustStore exports TrustLevelService", () => {
  assert.equal(typeof TrustLevelService, "function");
});

test("TrustStore exports TrustLevel type", () => {
  const level: TrustLevel = "official";
  assert.equal(level, "official");
});

test("TrustStore exports TrustLevelMetadata type", () => {
  const metadata: TrustLevelMetadata = {
    level: "official",
    displayName: "Official",
    description: "Approved knowledge",
    priority: 3,
  };
  assert.equal(metadata.level, "official");
});

test("TrustLevelService can be instantiated", () => {
  const service = new TrustLevelService();
  assert.ok(service);
});

test("TrustLevelService getTrustLevelMetadata returns metadata", () => {
  const meta = getTrustLevelMetadata("private_unverified");
  assert.ok(meta);
  assert.equal(meta.level, "private_unverified");
});

test("TrustLevelService getTrustLevelPriority returns priority", () => {
  assert.equal(getTrustLevelPriority("authoritative"), 4);
});

test("TrustLevelService compareTrustLevels compares correctly", () => {
  assert.ok(compareTrustLevels("authoritative", "private_unverified") > 0);
  assert.ok(compareTrustLevels("private_unverified", "authoritative") < 0);
  assert.equal(compareTrustLevels("official", "official"), 0);
});

test("TrustLevelService canTransitionTo validates transitions", () => {
  const service = new TrustLevelService();
  assert.equal(service.canTransitionTo("authoritative", "private_unverified"), false);
  assert.equal(service.canTransitionTo("private_unverified", "team_reviewed"), true);
});

test("TrustLevelService exposes default transition rules", () => {
  const service = new TrustLevelService();
  assert.deepEqual(service.getTrustRules(), DEFAULT_TRUST_TRANSITION_RULES);
});

test("TrustLevelService accepts custom transition rules", () => {
  const customRules: readonly TrustTransitionRule[] = [
    {
      fromLevel: "private_unverified",
      toLevel: "official",
      minValidationScore: 0.8,
      requiresApproval: true,
      requiresReviewerRole: true,
    },
  ];
  const service = new TrustLevelService(customRules);
  assert.deepEqual(service.getTrustRules(), customRules);
});

test("TrustLevelService with custom rules uses injected transition policy", () => {
  const customRules: readonly TrustTransitionRule[] = [
    {
      fromLevel: "team_reviewed",
      toLevel: "official",
      minValidationScore: 0.7,
      requiresApproval: false,
      requiresReviewerRole: false,
    },
  ];
  const service = new TrustLevelService(customRules);
  assert.equal(service.canTransitionTo("team_reviewed", "official"), true);
  assert.equal(service.canTransitionTo("official", "authoritative"), false);
});
