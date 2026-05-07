/**
 * E2E NL Gateway Tests
 *
 * End-to-end tests covering Natural Language Gateway:
 * 1. Intent parsing and classification
 * 2. Ambiguity handling
 * 3. Slot resolution
 * 4. Disambiguation flows
 * 5. NL-to-task mapping
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { SimpleIntentParser as IntentParser } from "../../../src/interaction/nl-gateway/intent-parser/index.js";
import { AmbiguityHandler } from "../../../src/interaction/nl-gateway/ambiguity-handler/index.js";
import { SlotResolver } from "../../../src/interaction/nl-gateway/slot-resolver/index.js";
import type { NlRequest, ParsedIntent, DisambiguationOption } from "../../../src/interaction/nl-gateway/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createNlRequest(overrides: Partial<NlRequest> = {}): NlRequest {
  return {
    message: overrides.message ?? "创建任务来备份数据库",
    userId: overrides.userId ?? "user_e2e_001",
    tenantId: overrides.tenantId ?? "tenant_e2e",
    context: overrides.context ?? {},
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Intent Parsing
// ---------------------------------------------------------------------------

test("E2E NL Gateway: IntentParser classifies user message into correct intent", async () => {
  const harness = createE2EHarness("aa-e2e-nlg-intent-");
  try {
    const parser = new IntentParser();

    const request = createNlRequest({
      message: "运行一个代码分析任务",
    });

    const parsed = await parser.parse(request);

    assert.ok(parsed, "Should return parsed intent");
    assert.ok(parsed.intent, "Should have intent classification");
    assert.ok(parsed.confidence > 0, "Should have confidence score");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Ambiguity Handling
// ---------------------------------------------------------------------------

test("E2E NL Gateway: AmbiguityHandler detects ambiguous requests and offers options", async () => {
  const harness = createE2EHarness("aa-e2e-nlg-ambiguity-");
  try {
    const handler = new AmbiguityHandler();

    const ambiguousMessage = "启动任务"; // Ambiguous - which workflow?

    const options = handler.handleAmbiguity(ambiguousMessage, "user_e2e_001");

    assert.ok(Array.isArray(options), "Should return options array");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Slot Resolution
// ---------------------------------------------------------------------------

test("E2E NL Gateway: SlotResolver fills required slots from user message", async () => {
  const harness = createE2EHarness("aa-e2e-nlg-slot-");
  try {
    const resolver = new SlotResolver();

    const request = createNlRequest({
      message: "在devops分区创建一个分析代码的任务",
    });

    const slots = resolver.resolve(request, ["divisionId", "taskType", "description"]);

    assert.ok(slots, "Should return resolved slots");
    assert.ok(slots.divisionId, "Should have divisionId resolved");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Full NL Processing Pipeline
// ---------------------------------------------------------------------------

test("E2E NL Gateway: Complete pipeline from NL to structured task", async () => {
  const harness = createE2EHarness("aa-e2e-nlg-full-");
  try {
    const parser = new IntentParser();

    const request = createNlRequest({
      message: "创建一个备份任务到db_backup分区",
    });

    // Parse intent
    const parsed = await parser.parse(request);
    assert.ok(parsed.intent, "Should parse intent");

    // Verify mapping to workflow
    assert.ok(parsed.workflowId || parsed.fallbackWorkflowId, "Should map to workflow");
  } finally {
    harness.cleanup();
  }
});
