import assert from "node:assert/strict";
import test from "node:test";

import { SessionSummaryService, type SessionSummaryInput } from "../../../../../src/platform/five-plane-state-evidence/memory/session-summary-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { SessionSummaryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockStore(): AuthoritativeTaskStore {
  const summaries: Map<string, SessionSummaryRecord[]> = new Map();

  return {
    session: {
      insertSessionSummary: (record: SessionSummaryRecord) => {
        const existing = summaries.get(record.sessionId) ?? [];
        existing.push(record);
        summaries.set(record.sessionId, existing);
      },
      getLatestSessionSummary: (sessionId: string): SessionSummaryRecord | null => {
        const existing = summaries.get(sessionId);
        if (!existing || existing.length === 0) return null;
        return existing[existing.length - 1] ?? null;
      },
    },
  } as unknown as AuthoritativeTaskStore;
}

test("SessionSummaryService type exports are correct", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);
  assert.ok(service !== undefined);
});

test("SessionSummaryService.createSummary creates a summary record", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  const input: SessionSummaryInput = {
    sessionId: "session_test",
    summaryText: "Completed task analysis",
  };

  const result = service.createSummary(input);

  assert.ok(result.id.startsWith("summ_"));
  assert.equal(result.sessionId, "session_test");
  assert.equal(result.summaryText, "Completed task analysis");
  assert.ok(typeof result.tokenCount === "number");
  assert.ok(result.createdAt.length > 0);
});

test("SessionSummaryService.createSummary with all optional fields", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  const input: SessionSummaryInput = {
    sessionId: "session_full",
    taskId: "task_123",
    agentId: "agent_456",
    summaryText: "Full test summary",
    keyDecisions: ["decided to use method A", " chose approach B"],
    keyOutcomes: ["task completed successfully"],
    memoryIdsReferenced: ["mem_1", "mem_2"],
  };

  const result = service.createSummary(input);

  assert.equal(result.sessionId, "session_full");
  assert.equal(result.taskId, "task_123");
  assert.equal(result.agentId, "agent_456");
  assert.equal(result.summaryText, "Full test summary");
  assert.ok(result.keyDecisions !== null);
  assert.ok(result.keyOutcomes !== null);
  assert.ok(result.memoryIdsReferenced !== null);
});

test("SessionSummaryService.getLatestSummary returns null for unknown session", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  const result = service.getLatestSummary("nonexistent_session");

  assert.equal(result, null);
});

test("SessionSummaryService.getLatestSummary returns latest summary", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  service.createSummary({
    sessionId: "session_latest",
    summaryText: "First summary",
  });

  service.createSummary({
    sessionId: "session_latest",
    summaryText: "Second summary",
  });

  const result = service.getLatestSummary("session_latest");

  assert.ok(result !== null);
  assert.equal(result?.summaryText, "Second summary");
});

test("SessionSummaryService.getLatestSummary returns null for session with no summaries", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  // Don't add any summaries - just query
  const result = service.getLatestSummary("session_empty");

  assert.equal(result, null);
});

test("SessionSummaryService.createSummary calculates token count", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  const input: SessionSummaryInput = {
    sessionId: "session_tokens",
    summaryText: "Test summary text", // 4 tokens at 4 chars/token
  };

  const result = service.createSummary(input);

  // At 4 chars per token, "Test summary text" = 17 chars ≈ 5 tokens (rounded up)
  assert.ok(result.tokenCount != null && result.tokenCount >= 4);
});

test("SessionSummaryService.createSummary stores in mock store", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  const input: SessionSummaryInput = {
    sessionId: "session_store",
    summaryText: "Store test",
  };

  const result = service.createSummary(input);

  // Verify it was stored
  const stored = store.session.getLatestSessionSummary("session_store");
  assert.ok(stored !== null);
  assert.equal(stored?.id, result.id);
});

test("SessionSummaryService.createSummary rejects oversized list payloads", () => {
  const store = createMockStore();
  const service = new SessionSummaryService(store);

  assert.throws(
    () => service.createSummary({
      sessionId: "session_limit",
      summaryText: "Summary",
      keyDecisions: Array.from({ length: 51 }, (_, index) => `decision_${index}`),
    }),
    /session_summary\.list_limit_exceeded/,
  );
});
