/**
 * E2E Explainability Service Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { ExplanationPipelineService } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { buildCausalChain } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
import { collectExplanationEvidence } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";
import { putExplanationCacheEntry } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
import { simplifyExplanation } from "../../../src/ops-maturity/explainability/simplified-explainer/index.js";

test("E2E Explainability: evidence collector aggregates records by category", async () => {
  const harness = createE2EHarness("aa-e2e-explain-ev-");
  try {
    const aggregated = collectExplanationEvidence([
      { evidenceId: "ev_read_001", category: "tool_call", excerpt: "read config" },
      { evidenceId: "ev_write_001", category: "tool_call", excerpt: "write report" },
    ]);

    assert.equal(aggregated.evidenceIds.length, 2);
    assert.equal(aggregated.groupedByCategory.tool_call?.length, 2);
  } finally {
    harness.cleanup();
  }
});

test("E2E Explainability: causal chain builder constructs chain from nodes and links", async () => {
  const harness = createE2EHarness("aa-e2e-explain-chain-");
  try {
    const chain = buildCausalChain(
      [
        { nodeId: "node_001", title: "Read config", category: "action" },
        { nodeId: "node_002", title: "Generate report", category: "outcome" },
      ],
      [
        { source: "node_001", target: "node_002", rationale: "configuration enabled the report run" },
      ],
    );

    assert.equal(chain.nodes.length, 2);
    assert.equal(chain.links.length, 1);
    assert.ok(chain.summary[0]?.includes("node_001 -> node_002"));
  } finally {
    harness.cleanup();
  }
});

test("E2E Explainability: ExplanationPipelineService processes rationale into explanation bundle", async () => {
  const harness = createE2EHarness("aa-e2e-explain-pipeline-");
  try {
    const pipeline = new ExplanationPipelineService();
    const explanation = pipeline.generate({
      taskId: "task_e2e_001",
      stageId: "execute",
      summary: "Processed the task successfully",
      decision: "accept",
      decisionFactors: ["low_risk", "cost_within_budget"],
      evidence: [{ evidenceId: "ev_001", category: "tool_call" }],
      riskNotes: ["none"],
      causalLinks: [{ source: "read", target: "write", rationale: "input drove output" }],
    });

    assert.ok(explanation.rendered.length > 0);
    assert.equal(explanation.rationale.taskId, "task_e2e_001");
    assert.equal(explanation.causalSummary.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("E2E Explainability: explanation cache stores and retrieves summaries", async () => {
  const harness = createE2EHarness("aa-e2e-explain-cache-");
  try {
    const cache = putExplanationCacheEntry({}, {
      cacheKey: "task_e2e_001:execute:L2",
      summary: "Task completed successfully",
      ttlHours: 24,
    });

    assert.equal(cache["task_e2e_001:execute:L2"]?.summary, "Task completed successfully");
  } finally {
    harness.cleanup();
  }
});

test("E2E Explainability: simplified explainer generates user-friendly explanation", async () => {
  const harness = createE2EHarness("aa-e2e-explain-simple-");
  try {
    const simplified = simplifyExplanation(
      "execute",
      "Workflow execution completed with acceptable latency",
      ["low risk", "good performance"],
      [{ source: "observe", target: "execute", rationale: "healthy telemetry supported execution" }],
      "low",
    );

    assert.ok(simplified.headline.length > 0);
    assert.ok(simplified.whatHappened.length > 0);
    assert.equal(simplified.riskLevel, "low");
  } finally {
    harness.cleanup();
  }
});
