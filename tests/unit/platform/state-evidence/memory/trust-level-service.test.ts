import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord, MemoryLayer, MemorySourceTrustLevel } from "../../../../../src/platform/contracts/types/domain/task-types.js";
import {
  TrustLevelService,
  getTrustLevelMetadata,
  getTrustLevelPriority,
  compareTrustLevels,
  canTransitionTrustLevel,
  DEFAULT_TRUST_TRANSITION_RULES,
  type TrustLevel,
} from "../../../../../src/platform/state-evidence/memory/index.js";

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString() as any;
  return {
    id: "mem_001",
    taskId: null,
    sessionId: "sess_001",
    agentId: "agent_001",
    executionId: "exec_001",
    memoryLayer: "layer_3" as MemoryLayer,
    scope: "session",
    contentJson: "{}",
    classification: "content",
    sourceTrustLevel: "trusted" as MemorySourceTrustLevel,
    qualityScore: null,
    hitCount: 0,
    createdAt: now,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

// =============================================================================
// Helper function tests
// =============================================================================

test("getTrustLevelMetadata returns correct metadata for private_unverified", () => {
  const meta = getTrustLevelMetadata("private_unverified");
  assert.ok(meta);
  assert.equal(meta.level, "private_unverified");
  assert.equal(meta.displayName, "Private/Unverified");
  assert.equal(meta.priority, 1);
});

test("getTrustLevelMetadata returns correct metadata for team_reviewed", () => {
  const meta = getTrustLevelMetadata("team_reviewed");
  assert.ok(meta);
  assert.equal(meta.level, "team_reviewed");
  assert.equal(meta.priority, 2);
});

test("getTrustLevelMetadata returns correct metadata for official", () => {
  const meta = getTrustLevelMetadata("official");
  assert.ok(meta);
  assert.equal(meta.level, "official");
  assert.equal(meta.priority, 3);
});

test("getTrustLevelMetadata returns correct metadata for authoritative", () => {
  const meta = getTrustLevelMetadata("authoritative");
  assert.ok(meta);
  assert.equal(meta.level, "authoritative");
  assert.equal(meta.displayName, "Authoritative");
  assert.equal(meta.priority, 4);
});

test("getTrustLevelMetadata returns null for invalid level", () => {
  assert.equal(getTrustLevelMetadata("invalid" as TrustLevel), null);
});

test("getTrustLevelPriority returns correct priority for each level", () => {
  assert.equal(getTrustLevelPriority("private_unverified"), 1);
  assert.equal(getTrustLevelPriority("team_reviewed"), 2);
  assert.equal(getTrustLevelPriority("official"), 3);
  assert.equal(getTrustLevelPriority("authoritative"), 4);
});

test("getTrustLevelPriority returns 0 for invalid level", () => {
  assert.equal(getTrustLevelPriority("invalid" as TrustLevel), 0);
});

test("compareTrustLevels returns negative when a < b", () => {
  assert.ok(compareTrustLevels("private_unverified", "team_reviewed") < 0);
  assert.ok(compareTrustLevels("team_reviewed", "official") < 0);
  assert.ok(compareTrustLevels("official", "authoritative") < 0);
});

test("compareTrustLevels returns positive when a > b", () => {
  assert.ok(compareTrustLevels("team_reviewed", "private_unverified") > 0);
  assert.ok(compareTrustLevels("official", "team_reviewed") > 0);
  assert.ok(compareTrustLevels("authoritative", "official") > 0);
});

test("compareTrustLevels returns 0 when equal", () => {
  assert.equal(compareTrustLevels("private_unverified", "private_unverified"), 0);
  assert.equal(compareTrustLevels("official", "official"), 0);
  assert.equal(compareTrustLevels("authoritative", "authoritative"), 0);
});

test("canTransitionTrustLevel returns true for same level", () => {
  assert.equal(canTransitionTrustLevel("private_unverified", "private_unverified", DEFAULT_TRUST_TRANSITION_RULES), true);
  assert.equal(canTransitionTrustLevel("official", "official", DEFAULT_TRUST_TRANSITION_RULES), true);
});

test("canTransitionTrustLevel returns true when rule exists", () => {
  assert.equal(canTransitionTrustLevel("private_unverified", "team_reviewed", DEFAULT_TRUST_TRANSITION_RULES), true);
  assert.equal(canTransitionTrustLevel("team_reviewed", "official", DEFAULT_TRUST_TRANSITION_RULES), true);
  assert.equal(canTransitionTrustLevel("official", "authoritative", DEFAULT_TRUST_TRANSITION_RULES), true);
});

test("canTransitionTrustLevel returns false when no rule exists", () => {
  assert.equal(canTransitionTrustLevel("team_reviewed", "authoritative", DEFAULT_TRUST_TRANSITION_RULES), false);
  assert.equal(canTransitionTrustLevel("private_unverified", "official", DEFAULT_TRUST_TRANSITION_RULES), false);
});

test("DEFAULT_TRUST_TRANSITION_RULES has correct number of rules", () => {
  assert.equal(DEFAULT_TRUST_TRANSITION_RULES.length, 3);
});

test("DEFAULT_TRUST_TRANSITION_RULES has correct structure", () => {
  const rule = DEFAULT_TRUST_TRANSITION_RULES[0];
  assert.ok(rule);
  assert.equal(rule.fromLevel, "private_unverified");
  assert.equal(rule.toLevel, "team_reviewed");
  assert.ok(rule.minValidationScore >= 0);
  assert.ok(typeof rule.requiresApproval === "boolean");
});

// =============================================================================
// TrustLevelService tests
// =============================================================================

test("TrustLevelService constructor accepts custom rules", () => {
  const customRules = DEFAULT_TRUST_TRANSITION_RULES.slice(0, 1);
  const service = new TrustLevelService(customRules);
  assert.equal(service.getTrustRules().length, 1);
});

test("TrustLevelService.createLearningObject creates object with correct initial state", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test_class" });
  const obj = service.createLearningObject(memory, "author_1", "Test Title", "Test content here for validation");
  assert.ok(obj.id);
  assert.ok(obj.id.startsWith("lo_"));
  assert.equal(obj.status, "draft");
  assert.equal(obj.currentTrustLevel, "private_unverified");
  assert.equal(obj.targetTrustLevel, "team_reviewed");
  assert.equal(obj.authorId, "author_1");
  assert.equal(obj.memoryId, memory.id);
  assert.equal(obj.title, "Test Title");
  assert.equal(obj.content, "Test content here for validation");
  assert.ok(obj.metadata.categories?.includes("test_class"));
});

test("TrustLevelService.createLearningObject generates unique ids", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord();
  const obj1 = service.createLearningObject(memory, "author_1", "Title 1", "Content 1");
  const obj2 = service.createLearningObject(memory, "author_1", "Title 2", "Content 2");
  assert.notEqual(obj1.id, obj2.id);
});

test("TrustLevelService.validate returns invalid for missing object", () => {
  const service = new TrustLevelService();
  const result = service.validate("nonexistent_id");
  assert.equal(result.valid, false);
  assert.equal(result.score, 0);
  assert.ok(result.errors.includes("LearningObject not found"));
});

test("TrustLevelService.validate returns valid for good content", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Valid Title", "This is valid content that is long enough.");
  const result = service.validate(obj.id);
  assert.equal(result.valid, true);
  assert.ok(result.score > 0);
});

test("TrustLevelService.validate returns errors for short content", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "short");
  const result = service.validate(obj.id);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("Content too short")));
});

test("TrustLevelService.validate returns warnings for brief content", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "This is brief content");
  const result = service.validate(obj.id);
  assert.ok(result.warnings.some(w => w.includes("brief")));
});

test("TrustLevelService.validate returns errors for short title", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Hi", "This content is long enough but title is short.");
  const result = service.validate(obj.id);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("Title too short")));
});

test("TrustLevelService.validate returns errors for missing classification", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const result = service.validate(obj.id);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("Classification")));
});

test("TrustLevelService.validate returns warnings for missing categories", () => {
  // When categories array is empty, validation warns
  // Note: createLearningObject sets categories from memory.classification by default
  // So we test the case where classification is empty, making categories empty too
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "" }); // empty classification
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const result = service.validate(obj.id);
  // Should have warnings due to missing classification and/or missing categories
  assert.ok(result.warnings.length > 0);
});

test("TrustLevelService.validate updates LearningObject status", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Valid Title", "This is valid content.");
  service.validate(obj.id);
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.status, "validation_pending");
});

test("TrustLevelService.validate fails for failed validation", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Short", "tiny");
  service.validate(obj.id);
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.status, "validation_failed");
});

test("TrustLevelService.submitForApproval returns false for nonexistent object", () => {
  const service = new TrustLevelService();
  assert.equal(service.submitForApproval("nonexistent"), false);
});

test("TrustLevelService.submitForApproval returns false for invalid object", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Short", "short");
  service.validate(obj.id); // Should fail validation
  assert.equal(service.submitForApproval(obj.id), false);
});

test("TrustLevelService.submitForApproval returns true for valid draft object", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Valid Title", "This is valid content.");
  service.validate(obj.id);
  assert.equal(service.submitForApproval(obj.id), true);
});

test("TrustLevelService.submitForApproval returns true for validation_pending object", () => {
  // Test that an object in validation_pending status can be submitted
  // This tests the path where object was validated but not yet submitted
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Valid Title", "This is valid content.");
  service.validate(obj.id);
  // Object is now in validation_pending status - submitForApproval should succeed
  assert.equal(service.submitForApproval(obj.id), true);
});

test("TrustLevelService.submitForApproval sets status to approval_pending", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.status, "approval_pending");
});

test("TrustLevelService.approve returns false for nonexistent object", () => {
  const service = new TrustLevelService();
  assert.equal(service.approve({ learningObjectId: "nonexistent", approvedBy: "admin" }), false);
});

test("TrustLevelService.approve returns false for wrong status", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  // Object is in draft status, not approval_pending
  assert.equal(service.approve({ learningObjectId: obj.id, approvedBy: "admin" }), false);
});

test("TrustLevelService.approve returns false for validation failure", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough");
  service.validate(obj.id);
  // Status is now validation_pending, approve should still fail
  assert.equal(service.approve({ learningObjectId: obj.id, approvedBy: "admin" }), false);
});

test("TrustLevelService.approve succeeds with correct target level", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  const result = service.approve({ learningObjectId: obj.id, approvedBy: "admin", targetTrustLevel: "team_reviewed" });
  assert.equal(result, true);
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.status, "approved");
  assert.equal(updated?.currentTrustLevel, "team_reviewed");
});

test("TrustLevelService.approve sets approval metadata", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  service.approve({ learningObjectId: obj.id, approvedBy: "admin", notes: "Looks good" });
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.approvedBy, "admin");
  assert.ok(updated?.approvedAt);
  assert.equal(updated?.approvalNotes, "Looks good");
});

test("TrustLevelService.reject returns false for nonexistent object", () => {
  const service = new TrustLevelService();
  assert.equal(service.reject("nonexistent", "reason"), false);
});

test("TrustLevelService.reject returns false for wrong status", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough");
  // Object is in draft status, not approval_pending
  assert.equal(service.reject(obj.id, "reason"), false);
});

test("TrustLevelService.reject sets rejection reason in metadata", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  service.reject(obj.id, "quality issues");
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.status, "rejected");
  assert.equal(updated?.metadata.rejectionReason, "quality issues");
});

test("TrustLevelService.rollout returns error for nonexistent object", () => {
  const service = new TrustLevelService();
  const result = service.rollout({ learningObjectId: "nonexistent", rolloutTargets: [], rolledOutBy: "admin" });
  assert.equal(result.success, false);
  assert.ok(result.error?.includes("not found"));
});

test("TrustLevelService.rollout returns error for non-approved object", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough");
  const result = service.rollout({ learningObjectId: obj.id, rolloutTargets: ["team_1"], rolledOutBy: "admin" });
  assert.equal(result.success, false);
  assert.ok(result.error?.includes("Cannot rollout"));
});

test("TrustLevelService.rollout succeeds for approved object", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  service.approve({ learningObjectId: obj.id, approvedBy: "admin" });
  const result = service.rollout({ learningObjectId: obj.id, rolloutTargets: ["team_1"], rolledOutBy: "admin" });
  assert.equal(result.success, true);
  assert.equal(result.learningObject?.status, "rolled_out");
});

test("TrustLevelService.rollout sets rollout metadata", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  service.approve({ learningObjectId: obj.id, approvedBy: "admin" });
  service.rollout({ learningObjectId: obj.id, rolloutTargets: ["team_1", "team_2"], rolledOutBy: "admin" });
  const updated = service.getLearningObject(obj.id);
  assert.ok(updated?.rolledOutAt);
  assert.deepEqual(updated?.rolloutTargets, ["team_1", "team_2"]);
});

test("TrustLevelService.deprecate returns false for nonexistent object", () => {
  const service = new TrustLevelService();
  assert.equal(service.deprecate("nonexistent"), false);
});

test("TrustLevelService.deprecate sets status to deprecated", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.deprecate(obj.id, "No longer needed");
  const updated = service.getLearningObject(obj.id);
  assert.equal(updated?.status, "deprecated");
  assert.equal(updated?.metadata.rollbackNote, "No longer needed");
});

test("TrustLevelService.getLearningObject returns null for nonexistent", () => {
  const service = new TrustLevelService();
  assert.equal(service.getLearningObject("nonexistent"), null);
});

test("TrustLevelService.getLearningObject returns object when exists", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const found = service.getLearningObject(obj.id);
  assert.ok(found);
  assert.equal(found?.id, obj.id);
});

test("TrustLevelService.listByStatus returns empty array when no matches", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const results = service.listByStatus("approval_pending");
  assert.equal(results.length, 0);
});

test("TrustLevelService.listByStatus returns matching objects", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  const obj = service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.validate(obj.id);
  service.submitForApproval(obj.id);
  const results = service.listByStatus("approval_pending");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, obj.id);
});

test("TrustLevelService.listByTrustLevel returns correct objects", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const results = service.listByTrustLevel("private_unverified");
  assert.equal(results.length, 1);
});

test("TrustLevelService.listByTrustLevel returns empty when no matches", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const results = service.listByTrustLevel("authoritative");
  assert.equal(results.length, 0);
});

test("TrustLevelService.listByAuthor returns correct objects", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const results = service.listByAuthor("author_1");
  assert.equal(results.length, 1);
});

test("TrustLevelService.listByAuthor returns empty when no matches", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  const results = service.listByAuthor("author_2");
  assert.equal(results.length, 0);
});

test("TrustLevelService.listAll returns all objects", () => {
  const service = new TrustLevelService();
  const memory = createMemoryRecord({ classification: "test" });
  service.createLearningObject(memory, "author_1", "Title", "Content is long enough here");
  service.createLearningObject(memory, "author_2", "Title 2", "More content here for validation");
  const results = service.listAll();
  assert.equal(results.length, 2);
});

test("TrustLevelService.getTrustRules returns all rules", () => {
  const service = new TrustLevelService();
  const rules = service.getTrustRules();
  assert.equal(rules.length, 3);
});

test("TrustLevelService.canTransitionTo returns true for valid transition", () => {
  const service = new TrustLevelService();
  assert.equal(service.canTransitionTo("private_unverified", "team_reviewed"), true);
});

test("TrustLevelService.canTransitionTo returns false for invalid transition", () => {
  const service = new TrustLevelService();
  assert.equal(service.canTransitionTo("team_reviewed", "authoritative"), false);
});

test("TrustLevelService.getNextTrustLevel returns correct next level", () => {
  const service = new TrustLevelService();
  assert.equal(service.getNextTrustLevel("private_unverified"), "team_reviewed");
  assert.equal(service.getNextTrustLevel("team_reviewed"), "official");
  assert.equal(service.getNextTrustLevel("official"), "authoritative");
  assert.equal(service.getNextTrustLevel("authoritative"), null);
});
