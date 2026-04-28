import assert from "node:assert/strict";
import test from "node:test";

import { MultimodalGatewayService } from "../../../src/ops-maturity/multimodal/multimodal-gateway-service.js";

test("integration: multimodal request flows through gateway routing, safety, and budget checks", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "mm_req_2",
    modalities: ["text", "audio", "document"],
    inputParts: [
      { partId: "part_text", type: "text", contentRef: "inline", text: "summarize call", mimeType: "text/plain" },
      { partId: "part_audio", type: "audio", contentRef: "aud://1", mimeType: "audio/wav", audioSampleCount: 48000, audioSampleRate: 24000 },
      { partId: "part_doc", type: "document", contentRef: "doc://1", mimeType: "application/pdf", documentChunks: ["p1", "p2", "p3"] },
    ],
    requestedOutputs: ["summary", "action_items"],
    safetyPolicyRef: "policy_mm_safe",
    costBudget: { maxUsd: 0.5 },
    traceId: "trace_mm_2",
  }, "2026-04-20T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 3);
  assert.equal(result.traceId, "trace_mm_2");
  assert.equal(result.blocked, false);
});

test("integration: multimodal gateway blocks over-budget requests without downgrading modalities", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "mm_req_3",
    modalities: ["document"],
    inputParts: [
      { partId: "part_doc", type: "document", contentRef: "doc://big", mimeType: "application/pdf", documentChunks: ["1", "2", "3", "4", "5", "6"] },
    ],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_mm_safe",
    costBudget: { maxUsd: 0.05 },
  });
  assert.equal(result.blocked, true);
  assert.ok(result.safetyFindings.some((item) => item.reasonCode === "multimodal_gateway.cost_budget_exceeded"));
});
