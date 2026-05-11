import assert from "node:assert/strict";
import test from "node:test";

import { CanaryTrafficRouter } from "../../../src/platform/five-plane-orchestration/improve-rollout/canary-traffic-router.js";
import { ExperienceDistillationService } from "../../../src/platform/five-plane-orchestration/learn/experience-distillation-service.js";
import { validatePatchBundle, type PatchBundle } from "../../../src/platform/five-plane-execution/recovery/patch-bundle.js";
import { ConversationHistoryService } from "../../../src/interaction/ux/conversation-history-service.js";
import { parseIntentTokens } from "../../../src/interaction/nl-gateway/intent-parser/index.js";
import {
  detectAmbiguity,
  detectAmbiguityFn,
} from "../../../src/interaction/nl-gateway/index.js";
import { detectAmbiguity as directDetectAmbiguity } from "../../../src/interaction/nl-gateway/disambiguation-handler/index.js";

test("R29-12 canary router keeps short task ids spread across many buckets", () => {
  const router = new CanaryTrafficRouter();
  const buckets = new Set<number>();

  for (let index = 0; index < 80; index += 1) {
    buckets.add(router.route(`t${index}`, "canary_5").bucket);
  }

  assert.ok(buckets.size >= 30);
});

test("R29-13 experience distillation keeps specialized recommendations for every learning type", () => {
  const service = new ExperienceDistillationService();
  const outputs = service.distill([
    {
      learningType: "failure_pattern",
      valueSummary: "failure",
      confidence: 0.8,
      evidenceRefs: ["evidence://1"],
      sourceSignalIds: ["signal://1"],
      generatedAt: "2026-05-11T00:00:00.000Z",
    },
    {
      learningType: "recovery_playbook",
      valueSummary: "recovery",
      confidence: 0.8,
      evidenceRefs: ["evidence://2"],
      sourceSignalIds: ["signal://2"],
      generatedAt: "2026-05-11T00:00:00.000Z",
    },
    {
      learningType: "user_correction",
      valueSummary: "correction",
      confidence: 0.8,
      evidenceRefs: ["evidence://3"],
      sourceSignalIds: ["signal://3"],
      generatedAt: "2026-05-11T00:00:00.000Z",
    },
    {
      learningType: "model_retraining",
      valueSummary: "retraining",
      confidence: 0.8,
      evidenceRefs: ["evidence://4"],
      sourceSignalIds: ["signal://4"],
      generatedAt: "2026-05-11T00:00:00.000Z",
    },
    {
      learningType: "dataset_gap",
      valueSummary: "gap",
      confidence: 0.8,
      evidenceRefs: ["evidence://5"],
      sourceSignalIds: ["signal://5"],
      generatedAt: "2026-05-11T00:00:00.000Z",
    },
  ] as never);

  assert.match(outputs[0]!.recommendation, /preventive measures/i);
  assert.match(outputs[1]!.recommendation, /recovery playbook/i);
  assert.match(outputs[2]!.recommendation, /user feedback/i);
  assert.match(outputs[3]!.recommendation, /model retraining/i);
  assert.match(outputs[4]!.recommendation, /dataset enrichment/i);
});

test("R29-18 patch bundle validation error keeps the configured diff limit in the message", () => {
  const bundle: PatchBundle = {
    bundleId: "bundle-1",
    taskId: "task-1",
    changedFiles: [{
      path: "src/example.ts",
      operation: "modify",
      hunks: [{
        originalStart: 1,
        originalCount: 1,
        finalStart: 1,
        finalCount: 3,
        lines: [" line", "+line2", "+line3", "+line4"],
      }],
    }],
    totalDiffLines: 4,
    createdAt: "2026-05-11T00:00:00.000Z",
    authorAgentId: "agent-1",
    status: "pending",
  };

  const result = validatePatchBundle(bundle, {
    maxChangedFiles: 5,
    maxDiffLines: 3,
    forbiddenPaths: [],
  });

  assert.deepEqual(result.errors, ["Total diff lines (4) exceeds maximum (3)"]);
});

test("R29-26 conversation history getSession still enforces tenant isolation", async () => {
  const service = new ConversationHistoryService({
    remember: async () => undefined,
    recall: async () => [{
      contentJson: JSON.stringify({
        sessionId: "conv-1",
        tenantId: "tenant-a",
        userId: "user-1",
        turns: [],
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
        status: "active",
      }),
    }],
  } as never);

  const result = await service.getSession("conv-1", "tenant-b");
  assert.equal(result, null);
});

test("R29-28 intent parser fallback keeps detailed questions as queries", () => {
  const query = parseIntentTokens("数据库连接超时应该怎么处理？");
  const request = parseIntentTokens("请帮我重启 staging 环境的 worker");

  assert.equal(query[0]?.intentType, "task_query");
  assert.equal(request[0]?.intentType, "task_create");
});

test("R29-29 nl-gateway barrel keeps detectAmbiguity bound to the direct implementation", () => {
  assert.equal(detectAmbiguity, detectAmbiguityFn);
  assert.equal(detectAmbiguity, directDetectAmbiguity);
});

test("R29-31 conversation history persists by default on layer_3 when memory is available", async () => {
  const remembered: Array<{ memoryLayer: string; content: string }> = [];
  const service = new ConversationHistoryService({
    remember: async (record: { memoryLayer: string; content: string }) => {
      remembered.push(record);
    },
    recall: async () => [],
  } as never);
  const session = service.startSession("tenant-1", "user-1");

  await service.addTurn(session, {
    role: "user",
    message: "记录这条消息",
  });

  assert.equal(remembered.length, 1);
  assert.equal(remembered[0]?.memoryLayer, "layer_3");
  assert.match(remembered[0]?.content ?? "", /记录这条消息/);
});
