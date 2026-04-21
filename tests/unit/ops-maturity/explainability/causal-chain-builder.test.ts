/**
 * Unit tests for CausalChainBuilder
 *
 * @see src/ops-maturity/explainability/causal-chain-builder/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildCausalChain,
  buildCausalChainSummary,
  type CausalChain,
  type CausalChainNode,
  type CausalLink,
} from "../../../../src/ops-maturity/explainability/index.js";

describe("CausalChainBuilder", () => {
  describe("buildCausalChainSummary", () => {
    test("renders causal links as readable summary strings", () => {
      const links: readonly CausalLink[] = [
        { source: "input_validated", target: "processing_started", rationale: "Data passed validation checks" },
        { source: "processing_started", target: "task_completed", rationale: "All steps succeeded" },
      ];

      const summary = buildCausalChainSummary(links);

      assert.equal(summary.length, 2);
      assert.ok(summary[0]!.includes("input_validated -> processing_started"));
      assert.ok(summary[0]!.includes("Data passed validation checks"));
      assert.ok(summary[1]!.includes("processing_started -> task_completed"));
      assert.ok(summary[1]!.includes("All steps succeeded"));
    });

    test("handles links with confidence scores", () => {
      const links: readonly CausalLink[] = [
        { source: "A", target: "B", rationale: "High confidence link", confidence: 0.95 },
      ];

      const summary = buildCausalChainSummary(links);

      assert.ok(summary[0]!.includes("A -> B"));
      assert.ok(summary[0]!.includes("High confidence link"));
    });

    test("returns empty array for empty input", () => {
      const summary = buildCausalChainSummary([]);
      assert.deepEqual(summary, []);
    });
  });

  describe("buildCausalChain", () => {
    test("assembles nodes, links, and summary into a CausalChain", () => {
      const nodes: readonly CausalChainNode[] = [
        { nodeId: "n1", title: "Signal Detected", category: "signal" },
        { nodeId: "n2", title: "Decision Made", category: "decision" },
        { nodeId: "n3", title: "Action Taken", category: "action" },
        { nodeId: "n4", title: "Outcome", category: "outcome" },
      ];

      const links: readonly CausalLink[] = [
        { source: "n1", target: "n2", rationale: "Threshold exceeded" },
        { source: "n2", target: "n3", rationale: "Approved decision" },
        { source: "n3", target: "n4", rationale: "Action completed" },
      ];

      const chain = buildCausalChain(nodes, links);

      assert.equal(chain.nodes, nodes);
      assert.equal(chain.links, links);
      assert.equal(chain.summary.length, 3);
    });

    test("correct node categories are preserved", () => {
      const nodes: readonly CausalChainNode[] = [
        { nodeId: "s1", title: "Error Spike", category: "signal" },
        { nodeId: "d1", title: "Failover Decision", category: "decision" },
        { nodeId: "a1", title: "Switchover", category: "action" },
        { nodeId: "o1", title: "Service Restored", category: "outcome" },
      ];
      const links: readonly CausalLink[] = [];

      const chain = buildCausalChain(nodes, links);

      const categories = chain.nodes.map((n) => n.category);
      assert.ok(categories.includes("signal"));
      assert.ok(categories.includes("decision"));
      assert.ok(categories.includes("action"));
      assert.ok(categories.includes("outcome"));
    });

    test("empty nodes and links produces empty summary", () => {
      const chain = buildCausalChain([], []);

      assert.equal(chain.nodes.length, 0);
      assert.equal(chain.links.length, 0);
      assert.equal(chain.summary.length, 0);
    });

    test("summary contains formatted string for each link", () => {
      const nodes: readonly CausalChainNode[] = [
        { nodeId: "node_a", title: "Node A", category: "action" },
        { nodeId: "node_b", title: "Node B", category: "outcome" },
      ];
      const links: readonly CausalLink[] = [
        { source: "node_a", target: "node_b", rationale: "Cause and effect" },
      ];

      const chain = buildCausalChain(nodes, links);

      assert.equal(chain.summary[0], "node_a -> node_b: Cause and effect");
    });

    test("buildCausalChain returns a frozen immutable object", () => {
      const chain = buildCausalChain([], []);

      assert.ok(Object.isFrozen(chain));
      assert.ok(Object.isFrozen(chain.nodes));
      assert.ok(Object.isFrozen(chain.links));
      assert.ok(Object.isFrozen(chain.summary));
    });
  });

  describe("CausalLink type", () => {
    test("link with all optional fields", () => {
      const links: readonly CausalLink[] = [
        { source: "x", target: "y", rationale: "r", confidence: 0.85 },
      ];
      const summary = buildCausalChainSummary(links);
      assert.equal(summary.length, 1);
    });

    test("link without confidence (optional) still works", () => {
      const links: readonly CausalLink[] = [
        { source: "start", target: "end", rationale: "no confidence" },
      ];
      const chain = buildCausalChain(
        [
          { nodeId: "start", title: "Start", category: "action" },
          { nodeId: "end", title: "End", category: "outcome" },
        ],
        links,
      );
      assert.equal(chain.links.length, 1);
      assert.equal(chain.links[0]!.confidence, undefined);
    });
  });

  describe("CausalChainNode type", () => {
    test("all four category values are accepted", () => {
      const nodes: CausalChainNode[] = [
        { nodeId: "1", title: "Signal", category: "signal" },
        { nodeId: "2", title: "Decision", category: "decision" },
        { nodeId: "3", title: "Action", category: "action" },
        { nodeId: "4", title: "Outcome", category: "outcome" },
      ];
      const links: CausalLink[] = [
        { source: "1", target: "2", rationale: "r1" },
        { source: "2", target: "3", rationale: "r2" },
        { source: "3", target: "4", rationale: "r3" },
      ];

      const chain = buildCausalChain(nodes, links);

      assert.equal(chain.nodes.length, 4);
      assert.equal(chain.links.length, 3);
    });
  });
});
