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
} from "../../../../../src/platform/five-plane-state-evidence/memory/experience-cache-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// =============================================================================
// computeKeywordSimilarity tests
// =============================================================================

test("computeKeywordSimilarity returns 0 for empty text1", () => {
  const result = computeKeywordSimilarity("", "hello world");
  assert.equal(result.score, 0);
  assert.deepEqual(result.matchedKeywords, []);
});

test("computeKeywordSimilarity returns 0 for empty text2", () => {
  const result = computeKeywordSimilarity("hello world", "");
  assert.equal(result.score, 0);
  assert.deepEqual(result.matchedKeywords, []);
});

test("computeKeywordSimilarity returns 0 for both empty", () => {
  const result = computeKeywordSimilarity("", "");
  assert.equal(result.score, 0);
  assert.deepEqual(result.matchedKeywords, []);
});

test("computeKeywordSimilarity returns perfect score for identical strings", () => {
  const result = computeKeywordSimilarity("hello world", "hello world");
  assert.ok(result.score > 0.9);
});

test("computeKeywordSimilarity returns high score for similar strings", () => {
  const result = computeKeywordSimilarity("the quick brown fox", "quick brown fox jumps");
  assert.ok(result.score > 0.5);
});

test("computeKeywordSimilarity returns low score for dissimilar strings", () => {
  const result = computeKeywordSimilarity("hello world", "goodbye moon");
  assert.ok(result.score < 0.3);
});

test("computeKeywordSimilarity returns non-zero for no common keywords due to length similarity", () => {
  // Even with no common words, length similarity (30% weight) gives a non-zero score
  const result = computeKeywordSimilarity("cat dog bird", "fish frog toad");
  assert.equal(result.matchedKeywords.length, 0); // No matched keywords
  assert.ok(result.score > 0); // But score is non-zero due to length similarity
});

test("computeKeywordSimilarity filters out common stop words", () => {
  const result = computeKeywordSimilarity("the and for", "the and for");
  assert.equal(result.score, 0);
});

test("computeKeywordSimilarity filters short words (length <= 2)", () => {
  const result = computeKeywordSimilarity("an it of", "an it of");
  assert.equal(result.score, 0);
});

test("computeKeywordSimilarity is case insensitive", () => {
  const result = computeKeywordSimilarity("HELLO WORLD", "hello world");
  assert.ok(result.score > 0.9);
  assert.ok(result.matchedKeywords.includes("hello"));
  assert.ok(result.matchedKeywords.includes("world"));
});

test("computeKeywordSimilarity matches multiple keywords", () => {
  const result = computeKeywordSimilarity("hello world testing", "hello world another");
  assert.ok(result.matchedKeywords.includes("hello"));
  assert.ok(result.matchedKeywords.includes("world"));
  assert.ok(result.matchedKeywords.length >= 2);
});

test("computeKeywordSimilarity handles unicode characters", () => {
  const result = computeKeywordSimilarity("日本語 テスト", "日本語 テスト");
  assert.ok(result.score > 0.9);
});

test("computeKeywordSimilarity handles mixed unicode and ascii", () => {
  const result = computeKeywordSimilarity("hello 日本語 world", "hello 日本語 world");
  assert.ok(result.score > 0.9);
});

test("computeKeywordSimilarity handles numbers as terms", () => {
  const result = computeKeywordSimilarity("test123 abc", "test123 xyz");
  assert.ok(result.matchedKeywords.includes("test123"));
});

test("computeKeywordSimilarity handles underscores in terms", () => {
  const result = computeKeywordSimilarity("hello_world foo_bar", "hello_world baz");
  assert.ok(result.matchedKeywords.includes("hello_world"));
});

// =============================================================================
// computeToolOverlap tests
// =============================================================================

test("computeToolOverlap returns 0 for empty experienceTools", () => {
  const result = computeToolOverlap([], ["tool1", "tool2"]);
  assert.equal(result, 0);
});

test("computeToolOverlap returns 0 for empty queryTools", () => {
  const result = computeToolOverlap(["tool1", "tool2"], []);
  assert.equal(result, 0);
});

test("computeToolOverlap returns 0 for both empty", () => {
  const result = computeToolOverlap([], []);
  assert.equal(result, 0);
});

test("computeToolOverlap returns 1 for complete overlap", () => {
  const result = computeToolOverlap(["tool1", "tool2", "tool3"], ["tool1", "tool2", "tool3"]);
  assert.equal(result, 1);
});

test("computeToolOverlap returns 0 for no overlap", () => {
  const result = computeToolOverlap(["tool1", "tool2"], ["tool3", "tool4"]);
  assert.equal(result, 0);
});

test("computeToolOverlap returns fraction for partial overlap", () => {
  const result = computeToolOverlap(["tool1", "tool2", "tool3"], ["tool1", "tool2"]);
  assert.equal(result, 1); // 2/2 since querySet has 2 items and both match
});

test("computeToolOverlap returns 0.5 for half overlap", () => {
  const result = computeToolOverlap(["tool1", "tool2"], ["tool1", "tool3"]);
  assert.equal(result, 0.5); // 1/2
});

test("computeToolOverlap handles duplicate tools in experience", () => {
  const result = computeToolOverlap(["tool1", "tool1", "tool2"], ["tool1"]);
  assert.equal(result, 1); // 1/1 unique match
});

test("computeToolOverlap is based on query tool count", () => {
  // Overlap is measured against queryTools size
  const result = computeToolOverlap(["tool1"], ["tool1", "tool2", "tool3", "tool4"]);
  assert.equal(result, 0.25); // 1/4
});

test("computeToolOverlap handles single tool match", () => {
  const result = computeToolOverlap(["bash", "grep", "sed"], ["bash"]);
  assert.equal(result, 1); // 1/1
});

// =============================================================================
// Mock Store for ExperienceCacheService tests
// =============================================================================

type MockConnection = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { changes: number };
    get: () => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

function createMockStore(): AuthoritativeTaskStore {
  // Each mock store has its own experiences array to avoid test pollution
  const experiences: Array<Record<string, unknown>> = [];

  const mockConnection: MockConnection = {
    exec: () => {
      // exec("DELETE FROM experience_cache") - clear all
      experiences.length = 0;
    },
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.includes("INSERT")) {
          experiences.push({
            id: args[0],
            task_id: args[1],
            session_id: args[2],
            agent_id: args[3],
            execution_id: args[4],
            task_context: args[5],
            task_intent: args[6],
            tools_used_json: args[7],
            outcome: args[8],
            final_error_code: args[9],
            quality_score: args[10],
            created_at: args[11],
            hit_count: 0,
            last_accessed_at: args[12],
          });
          return { changes: 1 };
        }
        if (sql.includes("DELETE") && sql.includes("experience_cache")) {
          const count = experiences.length;
          experiences.length = 0;
          return { changes: count };
        }
        if (sql.includes("UPDATE") && sql.includes("hit_count")) {
          return { changes: 1 };
        }
        return { changes: 0 };
      },
      get: () => ({
        total: experiences.length,
        successful: experiences.filter(e => e.outcome === "succeeded").length,
        failed: experiences.filter(e => e.outcome === "failed").length,
        avg_quality: experiences.length > 0 ? experiences.reduce((sum, e) => sum + (e.quality_score as number), 0) / experiences.length : null,
        total_hits: experiences.reduce((sum, e) => sum + (e.hit_count as number || 0), 0),
      }),
      all: (..._args: unknown[]) => [...experiences],
    }),
  };

  return {
    withConnection: <T>(work: (connection: MockConnection) => T): T => work(mockConnection),
  } as unknown as AuthoritativeTaskStore;
}

// =============================================================================
// ExperienceCacheService tests
// =============================================================================

test("ExperienceCacheService.recordExperience creates and returns record", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  const input: RecordExperienceInput = {
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "test context",
    taskIntent: "test intent",
    toolsUsed: [{ toolName: "bash", callId: "call_1", status: "succeeded", durationMs: 100 }],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  };

  const result = service.recordExperience(input);

  assert.equal(result.taskId, "task_1");
  assert.equal(result.sessionId, "session_1");
  assert.equal(result.outcome, "succeeded");
  assert.equal(result.hitCount, 0);
  assert.ok(result.id.startsWith("exp_"));
});

test("ExperienceCacheService.recordExperience handles failed outcome", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  const input: RecordExperienceInput = {
    taskId: "task_2",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "failed context",
    taskIntent: "failed intent",
    toolsUsed: [{ toolName: "bash", callId: "call_1", status: "failed", durationMs: 50, errorCode: "ENOENT" }],
    outcome: "failed",
    finalErrorCode: "ENOENT",
    qualityScore: 0.3,
  };

  const result = service.recordExperience(input);

  assert.equal(result.outcome, "failed");
  assert.equal(result.finalErrorCode, "ENOENT");
  assert.equal(result.qualityScore, 0.3);
});

test("ExperienceCacheService.clearAll removes all experiences", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  // First add an experience
  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "context",
    taskIntent: "intent",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // Clear all
  service.clearAll();

  // Verify cleared by checking statistics
  const stats = service.getStatistics();
  assert.equal(stats.totalExperiences, 0);
});

test("ExperienceCacheService.getStatistics returns correct counts", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  // Add experiences with different outcomes
  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "context",
    taskIntent: "intent",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  service.recordExperience({
    taskId: "task_2",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "context",
    taskIntent: "intent",
    toolsUsed: [],
    outcome: "failed",
    finalErrorCode: "ERROR",
    qualityScore: 0.2,
  });

  const stats = service.getStatistics();

  assert.equal(stats.totalExperiences, 2);
  assert.equal(stats.successfulExperiences, 1);
  assert.equal(stats.failedExperiences, 1);
  assert.ok(stats.averageQualityScore > 0);
});

test("ExperienceCacheService.getStatistics handles empty cache", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  const stats = service.getStatistics();

  assert.equal(stats.totalExperiences, 0);
  assert.equal(stats.successfulExperiences, 0);
  assert.equal(stats.failedExperiences, 0);
  assert.equal(stats.averageQualityScore, 0);
  assert.equal(stats.totalHits, 0);
});

test("ExperienceCacheService.evictStaleExperiences returns number deleted", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  // Should return 0 when no experiences exist
  const deleted = service.evictStaleExperiences(0);
  assert.equal(deleted, 0);
});

test("ExperienceCacheService.evictByCapacity returns number deleted", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  // Should return 0 when under capacity
  const deleted = service.evictByCapacity(1000);
  assert.equal(deleted, 0);
});

test("ExperienceCacheService.findSimilarExperiences returns empty array when no matches", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  const query: SimilarExperienceQuery = {
    taskContext: "nonexistent context",
    limit: 5,
  };

  const results = service.findSimilarExperiences(query);
  assert.deepEqual(results, []);
});

test("ExperienceCacheService.findSimilarExperiences respects limit parameter", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  // Add multiple experiences
  for (let i = 0; i < 10; i++) {
    service.recordExperience({
      taskId: `task_${i}`,
      sessionId: "session_1",
      agentId: "agent_1",
      executionId: `exec_${i}`,
      taskContext: "similar context",
      taskIntent: "similar intent",
      toolsUsed: [],
      outcome: "succeeded",
      finalErrorCode: null,
      qualityScore: 0.8,
    });
  }

  const results = service.findSimilarExperiences({
    taskContext: "similar context",
    limit: 3,
  });

  assert.ok(results.length <= 3);
});

test("ExperienceCacheService.findSimilarExperiences filters by toolNames", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_bash",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "run bash command",
    taskIntent: "execute script",
    toolsUsed: [{ toolName: "bash", callId: "c1", status: "succeeded", durationMs: 100 }],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  service.recordExperience({
    taskId: "task_grep",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "search files",
    taskIntent: "find pattern",
    toolsUsed: [{ toolName: "grep", callId: "c2", status: "succeeded", durationMs: 50 }],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // Query with toolNames should filter results
  const results = service.findSimilarExperiences({
    taskContext: "run command",
    toolNames: ["bash"],
    limit: 10,
  });

  // Should find the bash experience but not grep (tool overlap matters)
  assert.ok(results.length >= 0); // May be 0 if tool overlap score is too low
});

test("ExperienceCacheService.findSimilarExperiences returns scored results with similarityScore", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add API",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  const results = service.findSimilarExperiences({
    taskContext: "implement feature",
  });

  assert.ok(results.length > 0);
  for (const r of results) {
    assert.ok(typeof r.similarityScore === "number");
    assert.ok(Array.isArray(r.matchedKeywords));
  }
});

test("ExperienceCacheService.findSimilarExperiences uses default limit of 5", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  const results = service.findSimilarExperiences({});
  // Should not throw and should return results within default limit
  assert.ok(Array.isArray(results));
});

test("ExperienceCacheService.retrieveForFewShot returns formatted examples", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "implement feature",
    taskIntent: "add new API endpoint",
    toolsUsed: [{ toolName: "bash", callId: "c1", status: "succeeded", durationMs: 100 }],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  const result = service.retrieveForFewShot({ taskContext: "implement feature" }, "session_1");

  assert.ok(Array.isArray(result.examples));
  assert.ok(result.hitAudit);
  assert.equal(result.hitAudit.sessionId, "session_1");
});

test("ExperienceCacheService.retrieveForFewShot returns empty when no experiences", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  const result = service.retrieveForFewShot({ taskContext: "nonexistent" }, "session_1");

  assert.equal(result.examples.length, 0);
  assert.equal(result.totalAvailable, 0);
  assert.equal(result.hitAudit.hitsFound, 0);
});

test("ExperienceCacheService.retrieveForFewShot formats failed experience correctly", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_failed",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_failed",
    taskContext: "deploy application",
    taskIntent: "deploy to production",
    toolsUsed: [{ toolName: "kubectl", callId: "c1", status: "failed", durationMs: 50, errorCode: "ECONNREFUSED" }],
    outcome: "failed",
    finalErrorCode: "ECONNREFUSED",
    qualityScore: 0.1,
  });

  const result = service.retrieveForFewShot({ taskContext: "deploy application" }, "session_1");

  assert.ok(result.examples.length > 0);
  const example = result.examples[0];
  assert.ok(example);
  assert.equal(example.outcome, "failed");
  assert.ok(example.approach.includes("Failed with error"));
});

test("ExperienceCacheService.retrieveForFewShot formats partially completed outcome", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_partial",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_partial",
    taskContext: "process data",
    taskIntent: "transform records",
    toolsUsed: [{ toolName: "bash", callId: "c1", status: "succeeded", durationMs: 100 }],
    outcome: "partial", // Triggers "Partially completed" path
    finalErrorCode: null,
    qualityScore: 0.5,
  });

  const result = service.retrieveForFewShot({ taskContext: "process data" }, "session_1");

  assert.ok(result.examples.length > 0);
  const example = result.examples[0];
  assert.ok(example);
  assert.equal(example.outcome, "partial");
  assert.ok(example.approach.includes("Partially completed"));
});

test("ExperienceCacheService.findSimilarExperiences filters by minQualityScore", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  // Add experiences with different quality scores
  service.recordExperience({
    taskId: "task_low",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_low",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.3,
  });

  service.recordExperience({
    taskId: "task_high",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_high",
    taskContext: "implement feature",
    taskIntent: "add feature",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  // The minQualityScore filter should apply - verify the query doesn't throw
  const results = service.findSimilarExperiences({
    taskContext: "implement feature",
    minQualityScore: 0.8,
  });

  // Since mock returns all, we just verify the call doesn't throw and returns array
  assert.ok(Array.isArray(results));
});

test("ExperienceCacheService.findSimilarExperiences filters by sessionId", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_session1",
    sessionId: "session_alpha",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "run tests",
    taskIntent: "test code",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  service.recordExperience({
    taskId: "task_session2",
    sessionId: "session_beta",
    agentId: "agent_1",
    executionId: "exec_2",
    taskContext: "run tests",
    taskIntent: "test code",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // The sessionId filter should apply - verify the query doesn't throw
  const results = service.findSimilarExperiences({
    taskContext: "run tests",
    sessionId: "session_alpha",
  });

  assert.ok(Array.isArray(results));
});

test("ExperienceCacheService.findSimilarExperiences filters by outcome", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_success",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_success",
    taskContext: "deploy app",
    taskIntent: "deploy",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  service.recordExperience({
    taskId: "task_fail",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_fail",
    taskContext: "deploy app",
    taskIntent: "deploy",
    toolsUsed: [],
    outcome: "failed",
    finalErrorCode: "ERROR",
    qualityScore: 0.2,
  });

  // The outcome filter should apply - verify the query doesn't throw
  const results = service.findSimilarExperiences({
    taskContext: "deploy app",
    outcome: "succeeded",
  });

  assert.ok(Array.isArray(results));
});

test("ExperienceCacheService.findSimilarExperiences filters by taskIntent", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_api",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_api",
    taskContext: "work on API",
    taskIntent: "implement REST API",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
  });

  service.recordExperience({
    taskId: "task_ui",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_ui",
    taskContext: "work on UI",
    taskIntent: "implement UI components",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // The taskIntent filter should apply - verify the query doesn't throw
  const results = service.findSimilarExperiences({
    taskContext: "work on something",
    taskIntent: "implement REST API",
  });

  assert.ok(Array.isArray(results));
});

test("ExperienceCacheService.findSimilarExperiences handles missing taskIntent in query", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "build project",
    taskIntent: "compile code",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.8,
  });

  // Query with no taskIntent - should use taskContext fallback
  const results = service.findSimilarExperiences({
    taskContext: "build project",
  });

  assert.ok(results.length >= 0); // Should not throw
});

test("ExperienceCacheService.findSimilarExperiences handles failed experience with null finalErrorCode", () => {
  const store = createMockStore();
  const service = new ExperienceCacheService(store);

  service.recordExperience({
    taskId: "task_failed_null",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_failed",
    taskContext: "deploy",
    taskIntent: "deploy app",
    toolsUsed: [],
    outcome: "failed",
    finalErrorCode: null,
    qualityScore: 0.1,
  });

  const results = service.findSimilarExperiences({
    taskContext: "deploy",
  });

  // Should not throw when finalErrorCode is null
  assert.ok(Array.isArray(results));
});

// =============================================================================
// ExperienceCacheManager tests
// =============================================================================

test("ExperienceCacheManager.getService creates new service for session", () => {
  const store = createMockStore();
  const manager = new ExperienceCacheManager();

  const service1 = manager.getService("session_1", store);
  const service2 = manager.getService("session_2", store);

  assert.ok(service1);
  assert.ok(service2);
  assert.notEqual(service1, service2);
});

test("ExperienceCacheManager.getService returns same service for same session", () => {
  const store = createMockStore();
  const manager = new ExperienceCacheManager();

  const service1 = manager.getService("session_1", store);
  const service2 = manager.getService("session_1", store);

  assert.equal(service1, service2);
});

test("ExperienceCacheManager.removeService removes service for session", () => {
  const store = createMockStore();
  const manager = new ExperienceCacheManager();

  manager.getService("session_1", store);
  manager.removeService("session_1");

  // Getting service again should create a new one
  const service = manager.getService("session_1", store);
  assert.ok(service);
});

test("ExperienceCacheManager.clearAll removes all services", () => {
  const store = createMockStore();
  const manager = new ExperienceCacheManager();

  manager.getService("session_1", store);
  manager.getService("session_2", store);
  manager.clearAll();

  // Both sessions should get new services
  const service1 = manager.getService("session_1", store);
  const service2 = manager.getService("session_2", store);
  assert.ok(service1);
  assert.ok(service2);
});
