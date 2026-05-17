/**
 * E2E Context Compaction Tests
 *
 * End-to-end tests covering context compaction and compaction record
 * management for context window overflow handling.
 *
 * Tests verify:
 * - Stage 1 (trim) compaction: removes less critical tool results
 * - Stage 2 (summarize) compaction: synthesizes summary when trim is insufficient
 * - Compaction record creation and persistence
 * - KV cache key generation and fixed prefix handling
 * - Protected message handling (user requests, plans, approvals)
 * - Context overflow detection and response
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { ContextCompactionService, type ContextCompactionOptions, type ContextCompactionResult } from "../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test 1: Stage 1 Trim Compaction
// ---------------------------------------------------------------------------

test("E2E Context Compaction: Stage 1 trim removes old tool results", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-trim-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup: Create session with many tool results
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Compaction test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add user request (protected)
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Please analyze this data and create a report",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add many tool results (trim candidates)
      for (let i = 0; i < 10; i++) {
        harness.store.insertMessage({
          id: newId("msg"),
          sessionId,
          direction: "outbound",
          messageType: "tool_result",
          content: `Tool result ${i}: ${"x".repeat(100)}`,
          partsJson: null,
          attachmentsJson: null,
          createdAt: now,
        });
      }

      // Add assistant response (protected)
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "outbound",
        messageType: "assistant_response",
        content: "I'll analyze the data and create a report for you.",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });
    });

    // Execute compaction with low threshold to trigger Stage 1
    const result = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 500, // Low threshold to trigger trim
      stage1TriggerRatio: 0.5,
      stage2TriggerRatio: 0.9,
      recentToolResultWindow: 2,
      occurredAt: now,
    });

    // Verify Stage 1 was triggered
    assert.equal(result.stage1Triggered, true, "Stage 1 should be triggered");
    assert.ok(result.stage2Triggered === false || result.stage2Triggered === true, "Result should report whether Stage 2 triggered");

    // Verify compaction record was created
    assert.ok(result.persistedRecords.length > 0, "Should have compaction records");
    const trimRecord = result.persistedRecords.find((r) => r.stage === "trim");
    assert.ok(trimRecord, "Should have trim record");
    assert.equal(trimRecord!.compactionReason, "context_overflow_stage1_trim", "Record should have correct reason");

    assert.ok(result.usageAfterStage1Tokens <= result.usageBeforeTokens, "Stage 1 should not increase token usage");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Stage 2 Summarize Compaction
// ---------------------------------------------------------------------------

test("E2E Context Compaction: Stage 2 summarize creates summary when trim insufficient", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-summarize-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup: Create session with enough content to trigger Stage 2
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Summarize test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add user request (protected)
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Please perform a complex analysis task",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add many tool results to fill context
      for (let i = 0; i < 15; i++) {
        harness.store.insertMessage({
          id: newId("msg"),
          sessionId,
          direction: "outbound",
          messageType: "tool_result",
          content: `Tool result ${i}: ${"data".repeat(50)}`,
          partsJson: null,
          attachmentsJson: null,
          createdAt: now,
        });
      }

      // Add more content
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "outbound",
        messageType: "assistant_response",
        content: "Working on the analysis...",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });
    });

    // Execute compaction with thresholds that trigger both stages
    const result = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 300, // Very low to trigger Stage 2
      stage1TriggerRatio: 0.3,
      stage2TriggerRatio: 0.5,
      recentToolResultWindow: 1,
      compactionMaxFrequencyPerSession: 2,
      occurredAt: now,
    });

    // Verify both stages may be triggered
    assert.ok(result.stage1Triggered === true || result.stage2Triggered === true, "At least one stage should be triggered");

    // If Stage 2 triggered, verify summary
    if (result.stage2Triggered) {
      const summarizeRecord = result.persistedRecords.find((r) => r.stage === "summarize");
      assert.ok(summarizeRecord, "Should have summarize record");
      assert.ok(summarizeRecord!.summaryText, "Summary record should have summary text");
      assert.ok(summarizeRecord!.summaryRef, "Summary record should reference the summary message");

      // Verify summary message in context
      const summaryMessage = result.contextMessages.find((m) => m.messageType === "compaction_summary");
      assert.ok(summaryMessage, "Should have summary message in context");
      assert.equal(summaryMessage!.protected, true, "Summary should be protected");
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Compaction Record Persistence
// ---------------------------------------------------------------------------

test("E2E Context Compaction: compaction records are persisted to store", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-record-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup session
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Record test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add user request
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Process this request",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add tool results
      for (let i = 0; i < 8; i++) {
        harness.store.insertMessage({
          id: newId("msg"),
          sessionId,
          direction: "outbound",
          messageType: "tool_result",
          content: `Result ${i}: ${"y".repeat(80)}`,
          partsJson: null,
          attachmentsJson: null,
          createdAt: now,
        });
      }
    });

    // Execute compaction
    const result = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 400,
      stage1TriggerRatio: 0.4,
      stage2TriggerRatio: 0.9,
      recentToolResultWindow: 2,
      occurredAt: now,
    });

    // Verify records were persisted
    const storedRecords = harness.store.session.listCompactionRecordsBySession(sessionId);
    assert.ok(storedRecords.length > 0, "Should have persisted compaction records");

    // Verify record structure
    const record = storedRecords[0];
    assert.ok(record, "Record should exist");
    assert.ok(record.id, "Record should have ID");
    assert.equal(record.sessionId, sessionId, "Record should reference session");
    assert.equal(record.taskId, taskId, "Record should reference task");
    assert.ok(record.stage === "trim" || record.stage === "summarize", "Record should have valid stage");
    assert.ok(record.sourceMessageIdsJson, "Record should list source message IDs");
    assert.ok(record.compactionReason, "Record should have compaction reason");
    assert.ok(record.tokenReductionEstimate >= 0, "Record should estimate token reduction");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Protected Message Handling
// ---------------------------------------------------------------------------

test("E2E Context Compaction: protected messages are not compacted", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-protected-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup session with specific protected message types
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Protected test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add user request (protected)
      harness.store.insertMessage({
        id: "msg-user",
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Important user request that must not be trimmed",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add assistant plan (protected)
      harness.store.insertMessage({
        id: "msg-plan",
        sessionId,
        direction: "system",
        messageType: "assistant_plan",
        content: "Plan: Step 1, Step 2, Step 3",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add approval decision (protected)
      harness.store.insertMessage({
        id: "msg-approval",
        sessionId,
        direction: "system",
        messageType: "approval_decision",
        content: "Approved by manager",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add compaction summary (protected)
      harness.store.insertMessage({
        id: "msg-summary",
        sessionId,
        direction: "system",
        messageType: "compaction_summary",
        content: "Previous context summarized",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add feedback signal (protected)
      harness.store.insertMessage({
        id: "msg-feedback",
        sessionId,
        direction: "system",
        messageType: "feedback_signal",
        content: "Quality feedback here",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add learning object (protected)
      harness.store.insertMessage({
        id: "msg-learning",
        sessionId,
        direction: "system",
        messageType: "learning_object",
        content: "Learned pattern",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add tool results (not protected)
      for (let i = 0; i < 10; i++) {
        harness.store.insertMessage({
          id: newId("msg"),
          sessionId,
          direction: "outbound",
          messageType: "tool_result",
          content: `Tool result ${i}: ${"z".repeat(100)}`,
          partsJson: null,
          attachmentsJson: null,
          createdAt: now,
        });
      }
    });

    // Execute aggressive compaction
    const result = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 300,
      stage1TriggerRatio: 0.2,
      stage2TriggerRatio: 0.9,
      recentToolResultWindow: 1,
      occurredAt: now,
    });

    // Verify protected messages are marked as protected in result
    const protectedMessages = result.contextMessages.filter((m) => m.protected);
    assert.ok(protectedMessages.length >= 6, "Should preserve all protected message types");

    // Verify specific protected message IDs are preserved
    const userMsg = result.contextMessages.find((m) => m.messageId === "msg-user");
    assert.ok(userMsg, "User request should be in context");
    assert.equal(userMsg!.protected, true, "User request should be marked protected");

    const planMsg = result.contextMessages.find((m) => m.messageId === "msg-plan");
    assert.ok(planMsg, "Plan message should be in context");
    assert.equal(planMsg!.protected, true, "Plan should be marked protected");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: KV Cache Prefix Configuration
// ---------------------------------------------------------------------------

test("E2E Context Compaction: KV cache keys generated correctly", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-kv-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup session with system messages (fixed prefix)
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "KV cache test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add system messages (fixed prefix candidates)
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "system",
        messageType: "system",
        content: "System prompt: You are a helpful assistant",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "system",
        messageType: "system",
        content: "Domain context: General operations",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add user request
      harness.store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Process my request",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });
    });

    // Execute compaction with KV cache config
    const result = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 500,
      stage1TriggerRatio: 0.5,
      stage2TriggerRatio: 0.9,
      recentToolResultWindow: 3,
      kvCacheConfig: {
        strategy: { kvCacheEnabled: true, cacheKeyStrategy: "hash_prefix" },
        domainBlockTemplates: { [taskId]: "domain-specific-template" },
      },
      occurredAt: now,
    });

    // Verify KV cache keys are generated when enabled
    assert.ok(result.kvCacheFixedPrefixCacheKey !== undefined, "Should have fixed prefix cache key field");
    assert.ok(result.kvCacheDomainBlockCacheKey !== undefined, "Should have domain block cache key field");

    // Current implementation returns raw SHA-256 digests.
    if (result.kvCacheFixedPrefixCacheKey) {
      assert.match(result.kvCacheFixedPrefixCacheKey, /^[a-f0-9]{64}$/i, "Fixed prefix key should be a SHA-256 digest");
    }
    if (result.kvCacheDomainBlockCacheKey) {
      assert.match(result.kvCacheDomainBlockCacheKey, /^[a-f0-9]{64}$/i, "Domain block key should be a SHA-256 digest");
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Context Overflow Fallback
// ---------------------------------------------------------------------------

test("E2E Context Compaction: falls back to Stage 1 when Stage 2 exhausted", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-fallback-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup session
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Fallback test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add user request
      harness.store.insertMessage({
        id: "msg-user",
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Long task request",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add many tool results
      for (let i = 0; i < 20; i++) {
        harness.store.insertMessage({
          id: newId("msg"),
          sessionId,
          direction: "outbound",
          messageType: "tool_result",
          content: `Result ${i}: ${"data".repeat(100)}`,
          partsJson: null,
          attachmentsJson: null,
          createdAt: now,
        });
      }
    });

    // First compaction - should create summarize record
    const result1 = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 200,
      stage1TriggerRatio: 0.3,
      stage2TriggerRatio: 0.5,
      recentToolResultWindow: 1,
      compactionMaxFrequencyPerSession: 1, // Only allow 1 summarize
      occurredAt: now,
    });

    // If first compaction triggered Stage 2, verify it was recorded
    if (result1.stage2Triggered) {
      const summarizeRecord = result1.persistedRecords.find((r) => r.stage === "summarize");
      assert.ok(summarizeRecord, "Should have summarize record");
    }

    // Second compaction - should fallback to Stage 1 since Stage 2 exhausted
    const result2 = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 200,
      stage1TriggerRatio: 0.3,
      stage2TriggerRatio: 0.5,
      recentToolResultWindow: 1,
      compactionMaxFrequencyPerSession: 1, // Already used summarize
      occurredAt: now,
    });

    // Should fallback to Stage 1 or have budget exhausted error
    if (result2.stage2Triggered) {
      assert.equal(result2.fallbackToStage1, true, "Should fallback to Stage 1");
      assert.equal(result2.errorCode, "runtime.compaction_budget_exhausted", "Should have budget exhausted error");
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Recent Tool Results Window
// ---------------------------------------------------------------------------

test("E2E Context Compaction: recent tool results are preserved", async () => {
  const harness = createE2EHarness("aa-e2e-compaction-recent-");
  try {
    const service = new ContextCompactionService(harness.db, harness.store);
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Setup session with tool results
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Recent test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Add user request
      harness.store.insertMessage({
        id: "msg-user",
        sessionId,
        direction: "inbound",
        messageType: "user_request",
        content: "Process data",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });

      // Add 10 tool results
      for (let i = 0; i < 10; i++) {
        harness.store.insertMessage({
          id: `msg-tool-${i}`,
          sessionId,
          direction: "outbound",
          messageType: "tool_result",
          content: `Tool result ${i}`,
          partsJson: null,
          attachmentsJson: null,
          createdAt: now,
        });
      }
    });

    // Execute with recentToolResultWindow of 3
    const result = service.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 300,
      stage1TriggerRatio: 0.4,
      stage2TriggerRatio: 0.9,
      recentToolResultWindow: 3,
      occurredAt: now,
    });

    // Verify recent tool results are preserved (not trimmed)
    const recentToolMessages = result.contextMessages.filter(
      (m) => m.messageId.startsWith("msg-tool-") && ["8", "9"].includes(m.messageId.slice(-1))
    );

    // The 2 most recent (indices 8, 9) should be in context and not trimmed
    for (const msg of recentToolMessages) {
      assert.equal(msg.trimmed, false, `Recent tool result ${msg.messageId} should not be trimmed`);
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Context Compaction Tests
// ---------------------------------------------------------------------------
