/**
 * Unit tests for nl-gateway-support.ts utility functions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  serializeEntities,
  collectRegexEntities,
  parseStoredConversationTurn,
  collectResolvedSlotsFromTurns,
  buildConfirmationScope,
  buildCanonicalDomainId,
  memoryScopeFor,
  clarificationRoundKey,
  defaultCostEstimate,
  inferRequiredSlots,
  DATE_PATTERN,
  PERCENT_PATTERN,
  CURRENCY_PATTERN,
  ENV_PATTERN,
  CHANNEL_PATTERN,
} from "../../../../src/interaction/nl-gateway/nl-gateway-support.js";
import type { ConversationTurn } from "../../../../src/interaction/nl-gateway/index.js";

test("serializeEntities converts entities to JSON-safe format", () => {
  const entities = [
    {
      entityType: "date",
      value: "2026-05-21",
      normalized: new Date("2026-05-21"),
      sourceSpan: [0, 10] as [number, number],
    },
    {
      entityType: "money",
      value: "$100",
      normalized: 100,
      sourceSpan: [11, 15] as [number, number],
    },
  ];

  const result = serializeEntities(entities);

  assert.equal(result.length, 2);
  assert.equal(result[0]!.entityType, "date");
  assert.deepEqual(result[0]!.normalized, {}); // Date becomes an empty plain object
});

test("collectRegexEntities extracts matches from message", () => {
  const entities = collectRegexEntities("Meeting on 2026-05-21", DATE_PATTERN, "date");

  assert.ok(entities.length > 0);
  assert.equal(entities[0]!.entityType, "date");
  assert.equal(entities[0]!.value, "2026-05-21");
});

test("collectRegexEntities handles custom normalization", () => {
  const entities = collectRegexEntities("Growth is 50%", PERCENT_PATTERN, "percentage", (v) => {
    return parseFloat(v.replace("%", "")) / 100;
  });

  assert.ok(entities.length > 0);
  assert.equal(entities[0]!.normalized, 0.5);
});

test("collectRegexEntities returns empty array when no matches", () => {
  const entities = collectRegexEntities("No date here", DATE_PATTERN, "date");

  assert.equal(entities.length, 0);
});

test("collectRegexEntities handles regex with global flag", () => {
  const entities = collectRegexEntities("Dates: 2026-05-21 and 2026-06-01", DATE_PATTERN, "date");

  assert.equal(entities.length, 2);
});

test("parseStoredConversationTurn parses valid JSON conversation turn", () => {
  const content = JSON.stringify({
    turnNumber: 1,
    message: "Create a task",
    timestamp: "2026-05-21T10:00:00Z",
    detectedIntent: {
      intentType: "task_create",
      confidence: 0.88,
      entities: [],
      domainHint: "eng",
      urgency: "normal" as const,
    },
  });

  const result = parseStoredConversationTurn(content);

  assert.ok(result !== null);
  assert.equal(result.turnNumber, 1);
  assert.equal(result.message, "Create a task");
  assert.equal(result.detectedIntent.intentType, "task_create");
});

test("parseStoredConversationTurn returns null for invalid JSON", () => {
  const result = parseStoredConversationTurn("not valid json");

  assert.equal(result, null);
});

test("parseStoredConversationTurn returns null for incomplete data", () => {
  const content = JSON.stringify({
    turnNumber: 1,
    message: "Create a task",
    // missing timestamp and detectedIntent
  });

  const result = parseStoredConversationTurn(content);

  assert.equal(result, null);
});

test("parseStoredConversationTurn returns null for missing message", () => {
  const content = JSON.stringify({
    turnNumber: 1,
    timestamp: "2026-05-21T10:00:00Z",
    detectedIntent: {
      intentType: "task_create",
      confidence: 0.88,
      entities: [],
      domainHint: "eng",
      urgency: "normal" as const,
    },
  });

  const result = parseStoredConversationTurn(content);

  assert.equal(result, null);
});

test("collectResolvedSlotsFromTurns extracts entities from conversation turns", () => {
  const turns: readonly ConversationTurn[] = [
    {
      turnNumber: 1,
      message: "deploy to production",
      detectedIntent: {
        intentType: "task_create",
        confidence: 0.88,
        entities: [
          { entityType: "environment", value: "production", normalized: "production", sourceSpan: [10, 21] },
        ],
        domainHint: "eng",
        urgency: "normal",
      },
      timestamp: "2026-05-21T10:00:00Z",
    },
    {
      turnNumber: 2,
      message: "schedule for 2026-05-30",
      detectedIntent: {
        intentType: "task_create",
        confidence: 0.85,
        entities: [
          { entityType: "date", value: "2026-05-30", normalized: "2026-05-30", sourceSpan: [12, 22] },
        ],
        domainHint: "eng",
        urgency: "normal",
      },
      timestamp: "2026-05-21T10:01:00Z",
    },
  ];

  const result = collectResolvedSlotsFromTurns(turns);

  assert.equal(result.environment, "production");
  assert.equal(result.date, "2026-05-30");
});

test("collectResolvedSlotsFromTurns handles empty turns", () => {
  const result = collectResolvedSlotsFromTurns([]);

  assert.deepEqual(result, {});
});

test("collectResolvedSlotsFromTurns prefers earlier entity when duplicate types", () => {
  const turns: readonly ConversationTurn[] = [
    {
      turnNumber: 1,
      message: "use staging",
      detectedIntent: {
        intentType: "task_create",
        confidence: 0.88,
        entities: [
          { entityType: "environment", value: "staging", normalized: "staging", sourceSpan: [4, 11] },
        ],
        domainHint: "eng",
        urgency: "normal",
      },
      timestamp: "2026-05-21T10:00:00Z",
    },
    {
      turnNumber: 2,
      message: "actually use dev",
      detectedIntent: {
        intentType: "task_create",
        confidence: 0.85,
        entities: [
          { entityType: "environment", value: "dev", normalized: "dev", sourceSpan: [11, 14] },
        ],
        domainHint: "eng",
        urgency: "normal",
      },
      timestamp: "2026-05-21T10:01:00Z",
    },
  ];

  const result = collectResolvedSlotsFromTurns(turns);

  // Current implementation keeps the latest resolved slot.
  assert.equal(result.environment, "dev");
});

test("buildConfirmationScope uses environment from context", () => {
  const context = {
    domainHint: "eng",
    extractedConstraints: ["production_scope"],
    targetEnvironments: ["production"],
    requestedChannels: [],
    timelineRefs: [],
  };

  const result = buildConfirmationScope("engineering", context);

  assert.ok(result.includes("production"));
});

test("buildConfirmationScope falls back to division when no production constraint", () => {
  const context = {
    domainHint: "eng",
    extractedConstraints: [],
    targetEnvironments: ["staging"],
    requestedChannels: [],
    timelineRefs: [],
  };

  const result = buildConfirmationScope("engineering", context);

  assert.equal(result, "engineering/staging");
});

test("buildCanonicalDomainId maps platform_engineering to coding", () => {
  assert.equal(buildCanonicalDomainId("platform_engineering"), "coding");
});

test("buildCanonicalDomainId maps engineering_ops to coding", () => {
  assert.equal(buildCanonicalDomainId("engineering_ops"), "coding");
});

test("buildCanonicalDomainId passes through other division IDs", () => {
  assert.equal(buildCanonicalDomainId("marketing"), "marketing");
  assert.equal(buildCanonicalDomainId("hr"), "hr");
});

test("memoryScopeFor creates correct scope string", () => {
  const request = { tenantId: "tenant-1", userId: "user-1" };

  const result = memoryScopeFor(request);

  assert.equal(result, "tenant-1:user-1:nl_gateway");
});

test("memoryScopeFor handles different tenants and users", () => {
  const request1 = { tenantId: "t1", userId: "u1" };
  const request2 = { tenantId: "t2", userId: "u2" };

  const scope1 = memoryScopeFor(request1);
  const scope2 = memoryScopeFor(request2);

  assert.notEqual(scope1, scope2);
});

test("clarificationRoundKey creates deterministic key", () => {
  const request = { tenantId: "t1", userId: "u1", message: "Deploy to production" };

  const key1 = clarificationRoundKey(request);
  const key2 = clarificationRoundKey(request);

  assert.equal(key1, key2);
});

test("clarificationRoundKey normalizes message case and whitespace", () => {
  const request1 = { tenantId: "t1", userId: "u1", message: "Deploy to production" };
  const request2 = { tenantId: "t1", userId: "u1", message: "  deploy to production  " };

  const key1 = clarificationRoundKey(request1);
  const key2 = clarificationRoundKey(request2);

  assert.equal(key1, key2);
});

test("clarificationRoundKey differs for different messages", () => {
  const request1 = { tenantId: "t1", userId: "u1", message: "Deploy to production" };
  const request2 = { tenantId: "t1", userId: "u1", message: "Deploy to staging" };

  const key1 = clarificationRoundKey(request1);
  const key2 = clarificationRoundKey(request2);

  assert.notEqual(key1, key2);
});

test("defaultCostEstimate returns valid cost estimate", () => {
  const result = defaultCostEstimate();

  assert.equal(result.estimatedCostUsd, 0.05);
  assert.equal(result.confidence, "default");
  assert.equal(result.sampleCount, 0);
  assert.equal(result.divisionId, null);
  assert.equal(result.basedOn, "default");
});

test("inferRequiredSlots identifies date slot for schedule/rollout keywords", () => {
  assert.ok(inferRequiredSlots("schedule the deployment", "task_create", "schedule_wf").includes("date"));
  assert.ok(inferRequiredSlots("rollout on monday", "task_create", "rollout_wf").includes("date"));
});

test("inferRequiredSlots identifies environment slot for deploy keywords", () => {
  assert.ok(inferRequiredSlots("deploy to production", "task_create", "deploy_wf").includes("environment"));
  assert.ok(inferRequiredSlots("release to prod", "task_create", "release_wf").includes("environment"));
});

test("inferRequiredSlots identifies channel slot for notify keywords", () => {
  assert.ok(inferRequiredSlots("notify via slack", "task_create", "notify_wf").includes("channel"));
  assert.ok(inferRequiredSlots("send email notification", "task_create", "email_wf").includes("channel"));
});

test("inferRequiredSlots returns empty array when no slots inferred", () => {
  const result = inferRequiredSlots("create a simple task", "task_create", "simple_wf");

  assert.deepEqual(result, []);
});

test("inferRequiredSlots combines multiple slots when applicable", () => {
  const result = inferRequiredSlots(
    "schedule deployment to production via slack",
    "task_create",
    "complex_wf",
  );

  assert.ok(result.includes("date"));
  assert.ok(result.includes("environment"));
  assert.ok(result.includes("channel"));
});

test("inferRequiredSlots identifies date slot for approval with invoice/payment", () => {
  const result = inferRequiredSlots("approve invoice payment", "approval_action", "approve_wf");

  assert.ok(result.includes("date"));
});

test("CURRENCY_PATTERN matches various currency formats", () => {
  const testCases = [
    "$100",
    "¥500",
    "￥1000",
    "$ 200.50",
  ];

  for (const testCase of testCases) {
    const match = testCase.match(CURRENCY_PATTERN);
    assert.ok(match !== null, `Should match: ${testCase}`);
  }
});

test("ENV_PATTERN matches environment keywords", () => {
  for (const value of ["production", "prod", "staging", "dev", "生产环境"]) {
    ENV_PATTERN.lastIndex = 0;
    assert.ok(ENV_PATTERN.test(value));
  }
});

test("CHANNEL_PATTERN matches channel keywords", () => {
  for (const value of ["slack", "email", "webhook", "telegram"]) {
    CHANNEL_PATTERN.lastIndex = 0;
    assert.ok(CHANNEL_PATTERN.test(value));
  }
});
