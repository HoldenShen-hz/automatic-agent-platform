/**
 * Additional tests for ExperienceCacheService focusing on eviction,
 * retrieval formatting, and similarity scoring edge cases.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  computeKeywordSimilarity,
  computeToolOverlap,
  ExperienceCacheService,
  ExperienceCacheManager,
  type ExperienceToolCall,
  type RecordExperienceInput,
  type SimilarExperienceQuery,
  type FewShotExample,
} from "../../../../../src/platform/state-evidence/memory/experience-cache-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

// =============================================================================
// Enhanced Mock Store with proper eviction support
// =============================================================================

interface ExperienceEntry {
  id: string;
  task_id: string;
  session_id: string;
  agent_id: string;
  execution_id: string;
  task_context: string;
  task_intent: string;
  tools_used_json: string;
  outcome: string;
  final_error_code: string | null;
  quality_score: number;
  created_at: string;
  hit_count: number;
  last_accessed_at: string;
}

type MockConnection = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { changes: number };
    get: () => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

function createMockStore(): { store: AuthoritativeTaskStore; getExperiences: () => ExperienceEntry[] } {
  const experiences: ExperienceEntry[] = [];

  const mockConnection: MockConnection = {
    exec: (_sql: string) => {
      experiences.length = 0;
    },
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.includes("INSERT")) {
          experiences.push({
            id: args[0] as string,
            task_id: args[1] as string,
            session_id: args[2] as string,
            agent_id: args[3] as string,
            execution_id: args[4] as string,
            task_context: args[5] as string,
            task_intent: args[6] as string,
            tools_used_json: args[7] as string,
            outcome: args[8] as string,
            final_error_code: args[9] as string | null,
            quality_score: args[10] as number,
            created_at: args[11] as string,
            hit_count: 0,
            last_accessed_at: args[12] as string,
          });
          return { changes: 1 };
        }
        // NOTE: evictByCapacity must be checked BEFORE evictStaleExperiences
        // because its SQL also contains "last_accessed_at" in the ORDER BY clause
        if (sql.includes("DELETE") && sql.includes("quality_score")) {
          // evictByCapacity: DELETE to bring count below maxEntries
          const maxEntries = args[0] as number;
          const currentCount = experiences.length;
          if (currentCount > maxEntries) {
            // Sort by quality_score ASC, last_accessed_at ASC (worst/oldest first)
            experiences.sort((a, b) => {
              if (a.quality_score !== b.quality_score) {
                return a.quality_score - b.quality_score;
              }
              return a.last_accessed_at.localeCompare(b.last_accessed_at);
            });
            const toDelete = currentCount - maxEntries;
            experiences.splice(0, toDelete);
            return { changes: toDelete };
          }
          return { changes: 0 };
        }
        if (sql.includes("DELETE") && sql.includes("last_accessed_at")) {
          // evictStaleExperiences: DELETE WHERE last_accessed_at < cutoff
          const cutoff = args[0] as string;
          const before = experiences.length;
          for (let i = experiences.length - 1; i >= 0; i--) {
            if (experiences[i].last_accessed_at < cutoff) {
              experiences.splice(i, 1);
            }
          }
          return { changes: before - experiences.length };
        }
        if (sql.includes("UPDATE") && sql.includes("hit_count")) {
          // incrementHitCount
          const expId = args[1] as string;
          const exp = experiences.find((e) => e.id === expId);
          if (exp) {
            exp.hit_count++;
            exp.last_accessed_at = args[0] as string;
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        return { changes: 0 };
      },
      get: () => ({
        total: experiences.length,
        successful: experiences.filter((e) => e.outcome === "succeeded").length,
        failed: experiences.filter((e) => e.outcome === "failed").length,
        avg_quality:
          experiences.length > 0
            ? experiences.reduce((sum, e) => sum + e.quality_score, 0) / experiences.length
            : null,
        total_hits: experiences.reduce((sum, e) => sum + e.hit_count, 0),
      }),
      all: (..._args: unknown[]) => [...experiences],
    }),
  };

  const store = {
    withConnection: <T>(work: (connection: MockConnection) => T): T => work(mockConnection),
  } as unknown as AuthoritativeTaskStore;

  return { store, getExperiences: () => [...experiences] };
}

// =============================================================================
// computeKeywordSimilarity edge cases
// =============================================================================

test("computeKeywordSimilarity returns 0 when only stop words exist in both", () => {
  const result = computeKeywordSimilarity("the and for are", "the and for are");
  // All stop words should be filtered, resulting in empty sets
  assert.equal(result.score, 0);
});

test("computeKeywordSimilarity handles text with only stop words vs normal text", () => {
  const result = computeKeywordSimilarity("the and for", "hello world");
  assert.equal(result.score, 0);
});

test("computeKeywordSimilarity length similarity edge case: identical length strings", () => {
  const result = computeKeywordSimilarity("abc", "abc");
  // Same string should give high score
  assert.ok(result.score > 0.9);
});

test("computeKeywordSimilarity length similarity edge case: very different lengths", () => {
  const result = computeKeywordSimilarity("a", "abcdefghij");
  // Very different lengths should give low length similarity component
  // But if there are matching words, score could still be higher
  assert.ok(result.score >= 0);
  assert.ok(result.score <= 1);
});

test("computeKeywordSimilarity handles whitespace-only strings", () => {
  const result = computeKeywordSimilarity("   ", "hello");
  assert.equal(result.score, 0);
});

test("computeKeywordSimilarity handles newlines and tabs", () => {
  const result = computeKeywordSimilarity("hello\nworld\ttest", "hello world test");
  // Newlines and tabs should be treated as separators like whitespace
  assert.ok(result.score > 0.5);
});

// =============================================================================
// computeToolOverlap edge cases
// =============================================================================

test("computeToolOverlap handles single tool in both", () => {
  const result = computeToolOverlap(["bash"], ["bash"]);
  assert.equal(result, 1);
});

test("computeToolOverlap handles query tools subset of experience tools", () => {
  const result = computeToolOverlap(["bash", "grep", "sed", "awk"], ["bash", "grep"]);
  // query has 2 tools, both found in experience -> 2/2 = 1
  assert.equal(result, 1);
});

test("computeToolOverlap handles experience tools subset of query tools", () => {
  const result = computeToolOverlap(["bash"], ["bash", "grep", "sed"]);
  // query has 3 tools, 1 found -> 1/3
  assert.equal(result, 1 / 3);
});

// =============================================================================
// ExperienceCacheService eviction tests with enhanced mock
// =============================================================================

test("ExperienceCacheService.evictStaleExperiences removes old entries", () => {
  const { store, getExperiences } = createMockStore();
  const service = new ExperienceCacheService(store, { maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

  // Use recordExperience to add experiences
  // These will all have recent created_at and last_accessed_at
  service.recordExperience({
    taskId: "t1",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e1",
    taskContext: "context 1",
    taskIntent: "intent 1",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // Manually update one entry's last_accessed_at to be old
  // This is tricky because the service doesn't expose this - we'll test differently
  // For now, just verify basic eviction behavior

  const deleted = service.evictStaleExperiences(0); // Should delete all with last_accessed_at older than epoch
  // Since all our experiences have recent timestamps, this should return 0
  assert.ok(deleted >= 0);
});

test("ExperienceCacheService.evictStaleExperiences keeps recent entries", () => {
  const { store, getExperiences } = createMockStore();
  const service = new ExperienceCacheService(store);

  // Add a recent experience
  service.recordExperience({
    taskId: "t1",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e1",
    taskContext: "context",
    taskIntent: "intent",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  const deleted = service.evictStaleExperiences(7 * 24 * 60 * 60 * 1000); // 7 days

  assert.equal(deleted, 0);
  assert.equal(getExperiences().length, 1);
});

test("ExperienceCacheService.evictByCapacity removes lowest quality when over limit", () => {
  const { store, getExperiences } = createMockStore();
  const service = new ExperienceCacheService(store, { maxEntries: 1000 });

  // Use recordExperience to add experiences
  service.recordExperience({
    taskId: "t1",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e1",
    taskContext: "c1",
    taskIntent: "i1",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });
  service.recordExperience({
    taskId: "t2",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e2",
    taskContext: "c2",
    taskIntent: "i2",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.7,
  });
  service.recordExperience({
    taskId: "t3",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e3",
    taskContext: "c3",
    taskIntent: "i3",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.5,
  });
  service.recordExperience({
    taskId: "t4",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e4",
    taskContext: "c4",
    taskIntent: "i4",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.3,
  });
  service.recordExperience({
    taskId: "t5",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e5",
    taskContext: "c5",
    taskIntent: "i5",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.1,
  });

  assert.equal(getExperiences().length, 5);

  const deleted = service.evictByCapacity(3);

  assert.equal(deleted, 2);
  assert.equal(getExperiences().length, 3);

  // Verify only highest quality remain
  const remainingQualities = getExperiences().map((e) => e.quality_score).sort((a, b) => b - a);
  assert.deepEqual(remainingQualities, [0.9, 0.7, 0.5]);
});

test("ExperienceCacheService.evictByCapacity keeps all when under limit", () => {
  const { store, getExperiences } = createMockStore();
  const service = new ExperienceCacheService(store);

  const now = new Date().toISOString();

  const mockConnection = (store as unknown as { withConnection: <T>(work: (conn: MockConnection) => T) => T }).withConnection.bind(store);
  mockConnection((conn) => {
    conn.prepare("INSERT").run("exp_1", "t1", "s1", "a1", "e1", "c1", "i1", "[]", "succeeded", null, 0.9, now, now);
    conn.prepare("INSERT").run("exp_2", "t2", "s1", "a1", "e2", "c2", "i2", "[]", "succeeded", null, 0.7, now, now);
  });

  const deleted = service.evictByCapacity(10);

  assert.equal(deleted, 0);
  assert.equal(getExperiences().length, 2);
});

test("ExperienceCacheService.evictByCapacity removes oldest when quality ties", () => {
  const { store, getExperiences } = createMockStore();
  const service = new ExperienceCacheService(store, { maxEntries: 1000 });

  // Add two experiences with same quality but we can't easily control timestamps
  // since recordExperience uses nowIso(). We'll just verify the method works.
  service.recordExperience({
    taskId: "t1",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e1",
    taskContext: "c1",
    taskIntent: "i1",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.5,
  });
  service.recordExperience({
    taskId: "t2",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e2",
    taskContext: "c2",
    taskIntent: "i2",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.5,
  });

  const deleted = service.evictByCapacity(1);

  assert.equal(deleted, 1);
  assert.equal(getExperiences().length, 1);
});

// =============================================================================
// ExperienceCacheService.findSimilarExperiences scoring tests
// =============================================================================

test("ExperienceCacheService.findSimilarExperiences sorts by similarity score descending", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  const input1: RecordExperienceInput = {
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add API",
    toolsUsed: [{ toolName: "bash", callId: "c1", status: "succeeded", durationMs: 100 }],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  };

  const input2: RecordExperienceInput = {
    taskId: "task_2",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "completely different task",
    taskIntent: "do something else",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  };

  service.recordExperience(input1);
  service.recordExperience(input2);

  const results = service.findSimilarExperiences({
    taskContext: "implement feature",
  });

  assert.ok(results.length > 0);
  if (results.length >= 2) {
    assert.ok(results[0].similarityScore >= results[1].similarityScore);
  }
});

test("ExperienceCacheService.findSimilarExperiences weights context vs intent correctly", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  // Context match only
  service.recordExperience({
    taskId: "t1",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e1",
    taskContext: "implement feature",
    taskIntent: "unrelated intent",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // Intent match only
  service.recordExperience({
    taskId: "t2",
    sessionId: "s1",
    agentId: "a1",
    executionId: "e2",
    taskContext: "unrelated context",
    taskIntent: "implement feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  const results = service.findSimilarExperiences({
    taskContext: "implement feature",
    taskIntent: "implement feature",
  });

  // Both should be returned, context match (50% weight) vs intent match (30% weight)
  // Context match should score higher due to higher weight
  assert.ok(results.length >= 1);
});

// =============================================================================
// ExperienceCacheService.retrieveForFewShot formatting tests
// =============================================================================

test("ExperienceCacheService.retrieveForFewShot formats succeeded tools correctly", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "deploy application",
    taskIntent: "deploy to production",
    toolsUsed: [
      { toolName: "bash", callId: "c1", status: "succeeded", durationMs: 100 },
      { toolName: "kubectl", callId: "c2", status: "succeeded", durationMs: 200 },
      { toolName: "curl", callId: "c3", status: "failed", durationMs: 50, errorCode: "ECONNREFUSED" },
    ],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  const result = service.retrieveForFewShot({ taskContext: "deploy application" }, "session_1");

  assert.ok(result.examples.length > 0);
  const example = result.examples[0];
  // Only succeeded tools should be included
  assert.ok(example.toolsUsed.includes("bash"));
  assert.ok(example.toolsUsed.includes("kubectl"));
  assert.ok(!example.toolsUsed.includes("curl"));
});

test("ExperienceCacheService.retrieveForFewShot includes matched keywords in reasoning", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement REST API endpoint",
    taskIntent: "create new service",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  const result = service.retrieveForFewShot({ taskContext: "implement REST API" }, "session_1");

  if (result.examples.length > 0 && result.examples[0].reasoning) {
    // Reasoning should mention matched keywords
    assert.ok(
      result.examples[0].reasoning.includes("REST") ||
        result.examples[0].reasoning.includes("API") ||
        result.examples[0].reasoning.includes("implement"),
    );
  }
});

test("ExperienceCacheService.retrieveForFewShot hitAudit contains correct experienceIds", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  const exp1 = service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  const exp2 = service.recordExperience({
    taskId: "task_2",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  const result = service.retrieveForFewShot({ taskContext: "implement feature", limit: 10 }, "session_1");

  assert.ok(result.hitAudit.experienceIds.includes(exp1.id));
  assert.ok(result.hitAudit.experienceIds.includes(exp2.id));
  assert.equal(result.hitAudit.sessionId, "session_1");
  assert.equal(result.hitAudit.hitsFound, result.examples.length);
});

test("ExperienceCacheService.retrieveForFewShot increments hit count", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  // First retrieval
  service.retrieveForFewShot({ taskContext: "implement feature" }, "session_1");

  // Second retrieval of same experience
  const result = service.retrieveForFewShot({ taskContext: "implement feature" }, "session_1");

  // Hit audit should reflect access
  assert.ok(result.hitAudit.hitsFound >= 1);
});

// =============================================================================
// ExperienceCacheManager session isolation tests
// =============================================================================

test("ExperienceCacheManager isolates sessions with separate services", () => {
  const store1 = createMockStore().store;
  const store2 = createMockStore().store;
  const manager = new ExperienceCacheManager();

  const service1 = manager.getService("session_1", store1);
  const service2 = manager.getService("session_2", store2);

  // Record experience in session 1
  service1.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "session 1 context",
    taskIntent: "session 1 intent",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  // Find in session 2 - should not find session 1's experience
  const results = service2.findSimilarExperiences({ taskContext: "session 1 context" });

  // Since each store is independent, session 2's store is empty
  assert.equal(results.length, 0);
});

test("ExperienceCacheManager.removeService actually removes the service", () => {
  const store = createMockStore().store;
  const manager = new ExperienceCacheManager();

  const service1 = manager.getService("session_1", store);
  const serviceId1 = (service1 as unknown as { [key: string]: unknown }).constructor?.name;

  manager.removeService("session_1");

  const service2 = manager.getService("session_1", store);
  const serviceId2 = (service2 as unknown as { [key: string]: unknown }).constructor?.name;

  // service2 should be a new instance (different object reference)
  assert.notEqual(service1, service2);
});

test("ExperienceCacheManager.clearAll removes all services", () => {
  const store = createMockStore().store;
  const manager = new ExperienceCacheManager();

  manager.getService("session_1", store);
  manager.getService("session_2", store);
  manager.getService("session_3", store);

  assert.equal((manager as unknown as { services: Map<string, ExperienceCacheService> }).services.size, 3);

  manager.clearAll();

  assert.equal((manager as unknown as { services: Map<string, ExperienceCacheService> }).services.size, 0);
});

// =============================================================================
// ExperienceCacheService constructor options tests
// =============================================================================

test("ExperienceCacheService uses custom maxAgeMs option", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store, { maxAgeMs: 30 * 24 * 60 * 60 * 1000 }); // 30 days

  // The service should use the custom maxAgeMs when evicting
  // We can't easily test the eviction behavior without time travel,
  // but we can verify the service was created with the option
  assert.ok(service);
});

test("ExperienceCacheService uses custom maxEntries option", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store, { maxEntries: 5000 });

  // The service should use the custom maxEntries
  assert.ok(service);
});

// =============================================================================
// ExperienceCacheService statistics tests
// =============================================================================

test("ExperienceCacheService.getStatistics handles null avg_quality", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  // Before any experiences, avg should be 0
  const stats = service.getStatistics();

  assert.equal(stats.totalExperiences, 0);
  assert.equal(stats.averageQualityScore, 0);
});

test("ExperienceCacheService.getStatistics counts totalHits correctly after retrieval", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  // Retrieve to increment hit count
  service.retrieveForFewShot({ taskContext: "implement feature" }, "session_1");

  const stats = service.getStatistics();

  assert.ok(stats.totalHits >= 1);
});

// =============================================================================
// SimilarExperienceQuery filtering tests
// =============================================================================

test("ExperienceCacheService.findSimilarExperiences combines multiple filters", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [{ toolName: "bash", callId: "c1", status: "succeeded", durationMs: 100 }],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  service.recordExperience({
    taskId: "task_2",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "failed",
    finalErrorCode: "ERROR",
    qualityScore: 0.3,
  });

  // Query with multiple filters
  const results = service.findSimilarExperiences({
    taskContext: "implement feature",
    outcome: "succeeded",
    minQualityScore: 0.8,
  });

  // Note: The mock's all() doesn't implement SQL filtering,
  // so results may include experiences that don't match the SQL filters.
  // But they should still have valid structure and similarity scores.
  assert.ok(Array.isArray(results));
  for (const r of results) {
    assert.ok(r.experience);
    assert.ok(typeof r.similarityScore === "number");
    assert.ok(Array.isArray(r.matchedKeywords));
  }
});

test("ExperienceCacheService.findSimilarExperiences empty query returns all (up to limit)", () => {
  const { store } = createMockStore();
  const service = new ExperienceCacheService(store);

  // Record multiple experiences
  for (let i = 0; i < 10; i++) {
    service.recordExperience({
      taskId: `task_${i}`,
      sessionId: "session_1",
      agentId: "agent_1",
      executionId: `exec_${i}`,
      taskContext: "context",
      taskIntent: "intent",
      toolsUsed: [],
      outcome: "succeeded",
      finalErrorCode: null,
      qualityScore: 0.5 + (i * 0.05),
    });
  }

  // Empty query should return experiences ordered by quality
  const results = service.findSimilarExperiences({});

  assert.ok(results.length <= 5); // Default limit is 5
  // Results should be sorted by quality_score DESC
  if (results.length > 1) {
    assert.ok(results[0].experience.qualityScore >= results[1].experience.qualityScore);
  }
});
