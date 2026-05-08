/**
 * E2E Explainability Service Tests
 *
 * End-to-end tests covering the complete explainability pipeline:
 * 1. Evidence collection and causal chain building
 * 2. Explanation pipeline processing
 * 3. Explanation caching
 * 4. Explanation rendering
 * 5. Simplified explainer output
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { ExplanationPipelineService } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
// @ts-ignore
import { CausalChainBuilder } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
// @ts-ignore
import { EvidenceCollector } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";
// @ts-ignore
import { ExplanationCache } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
// @ts-ignore
import { SimplifiedExplainer } from "../../../src/ops-maturity/explainability/simplified-explainer/index.js";
// @ts-ignore
import type { CausalChainNode, EvidenceRecord } from "../../../src/ops-maturity/explainability/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createEvidenceRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: overrides.id ?? "ev_e2e_001",
    taskId: overrides.taskId ?? "task_e2e_001",
    executionId: overrides.executionId ?? "exec_e2e_001",
    traceId: overrides.traceId ?? "trace_e2e_001",
    agentId: overrides.agentId ?? "agent_e2e",
    action: overrides.action ?? "tool_call",
    toolName: overrides.toolName ?? "read_file",
    inputSummary: overrides.inputSummary ?? '{"path": "/tmp/test.txt"}',
    outputSummary: overrides.outputSummary ?? '{"content": "test data"}',
    latencyMs: overrides.latencyMs ?? 150,
    costUsd: overrides.costUsd ?? 0.002,
    riskScore: overrides.riskScore ?? 20,
    success: overrides.success ?? true,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    tags: overrides.tags ?? [],
    ...overrides,
  };
}

function createCausalChainNode(overrides: Partial<CausalChainNode> = {}): CausalChainNode {
  return {
    nodeId: overrides.nodeId ?? "node_001",
    type: overrides.type ?? "action",
    label: overrides.label ?? "Read file",
    parentIds: overrides.parentIds ?? [],
    confidence: overrides.confidence ?? 0.95,
    evidenceIds: overrides.evidenceIds ?? [],
    metadata: overrides.metadata ?? {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Evidence Collection
// ---------------------------------------------------------------------------

test("E2E Explainability: EvidenceCollector aggregates records from task execution", async () => {
  const harness = createE2EHarness("aa-e2e-explain-ev-");
  try {
    const collector = new EvidenceCollector();

    // Add evidence records from multiple tool calls
    const evidence1 = createEvidenceRecord({
      id: "ev_read_001",
      toolName: "read_file",
      action: "tool_call",
      success: true,
      latencyMs: 120,
    });

    const evidence2 = createEvidenceRecord({
      id: "ev_write_001",
      toolName: "write_file",
      action: "tool_call",
      success: true,
      latencyMs: 200,
    });

    collector.addEvidence(evidence1);
    collector.addEvidence(evidence2);

    const aggregated = collector.getAggregatedEvidence("task_e2e_001");
    assert.ok(Array.isArray(aggregated), "Should return array of evidence");
    assert.equal(aggregated.length, 2, "Should have 2 evidence records");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Causal Chain Building
// ---------------------------------------------------------------------------

test("E2E Explainability: CausalChainBuilder constructs chain from evidence", async () => {
  const harness = createE2EHarness("aa-e2e-explain-chain-");
  try {
    const builder = new CausalChainBuilder();

    // Build chain from evidence records
    const evidence = [
      createEvidenceRecord({ id: "ev_001", toolName: "read_file" }),
      createEvidenceRecord({ id: "ev_002", toolName: "bash" }),
      createEvidenceRecord({ id: "ev_003", toolName: "write_file" }),
    ];

    const chain = builder.buildFromEvidence("task_e2e_001", evidence);

    assert.ok(chain, "Should return causal chain");
    assert.ok(Array.isArray(chain.nodes), "Chain should have nodes array");
    assert.ok(chain.rootNodeId, "Chain should have root node");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Explanation Pipeline
// ---------------------------------------------------------------------------

test("E2E Explainability: ExplanationPipelineService processes chain to explanation", async () => {
  const harness = createE2EHarness("aa-e2e-explain-pipeline-");
  try {
    const pipeline = new ExplanationPipelineService();

    const chain = {
      chainId: "chain_e2e_001",
      taskId: "task_e2e_001",
      rootNodeId: "node_root",
      nodes: [
        createCausalChainNode({ nodeId: "node_root", type: "action", label: "Read config" }),
        createCausalChainNode({ nodeId: "node_1", type: "action", label: "Process data", parentIds: ["node_root"] }),
      ],
      metadata: { builtAt: new Date().toISOString() },
    };

// @ts-ignore
    const explanation = await pipeline.process(chain);

    assert.ok(explanation, "Should produce explanation");
    assert.ok(explanation.summary, "Should have summary");
    assert.ok(Array.isArray(explanation.factors), "Should have factors array");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Explanation Cache
// ---------------------------------------------------------------------------

test("E2E Explainability: ExplanationCache stores and retrieves explanations", async () => {
  const harness = createE2EHarness("aa-e2e-explain-cache-");
  try {
    const cache = new ExplanationCache({ ttlSeconds: 300 });

    const explanation = {
      summary: "Task completed successfully",
      factors: [{ factor: "low_risk", weight: 0.8 }],
      confidence: 0.92,
    };

    cache.set("task_e2e_001", explanation);

    const cached = cache.get("task_e2e_001");
    assert.ok(cached, "Should retrieve cached explanation");
    assert.equal(cached?.summary, "Task completed successfully", "Should match original summary");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 5: Simplified Explainer
// ---------------------------------------------------------------------------

test("E2E Explainability: SimplifiedExplainer generates user-friendly explanation", async () => {
  const harness = createE2EHarness("aa-e2e-explain-simple-");
  try {
    const explainer = new SimplifiedExplainer();

    const detailedExplanation = {
      summary: "File processing completed with data transformation",
      factors: [
        { factor: "sequential_processing", weight: 0.6 },
        { factor: "data_validation", weight: 0.4 },
      ],
      causalChain: ["read_input", "transform_data", "write_output"],
      confidence: 0.88,
    };

    const simplified = explainer.simplify(detailedExplanation);

    assert.ok(simplified, "Should produce simplified explanation");
    assert.ok(simplified.plainLanguage, "Should have plain language version");
    assert.ok(simplified.keyPoints, "Should have key points");
  } finally {
    harness.cleanup();
  }
});
