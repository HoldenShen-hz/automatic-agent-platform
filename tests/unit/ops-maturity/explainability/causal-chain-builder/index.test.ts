import assert from "node:assert/strict";
import test from "node:test";

import {
  CausalLink,
  CausalChainNode,
  buildCausalChain,
  buildCausalChainSummary,
  type CausalChain,
} from "../../../../../src/ops-maturity/explainability/causal-chain-builder/index.js";

test("buildCausalChainSummary returns formatted strings for each link", () => {
  const links: CausalLink[] = [
    { source: "A", target: "B", rationale: "because A happened" },
    { source: "B", target: "C", rationale: "to achieve C" },
  ];

  const summary = buildCausalChainSummary(links);

  assert.equal(summary.length, 2);
  assert.equal(summary[0], "A -> B: because A happened");
  assert.equal(summary[1], "B -> C: to achieve C");
});

test("buildCausalChainSummary handles empty links", () => {
  const summary = buildCausalChainSummary([]);
  assert.deepEqual(summary, []);
});

test("buildCausalChainSummary handles links with confidence", () => {
  const links: CausalLink[] = [
    { source: "A", target: "B", rationale: "high confidence", confidence: 0.95 },
  ];

  const summary = buildCausalChainSummary(links);

  assert.equal(summary[0], "A -> B: high confidence");
});

test("buildCausalChain creates frozen chain with nodes and links", () => {
  const nodes: CausalChainNode[] = [
    { nodeId: "n1", title: "Signal A", category: "signal" },
    { nodeId: "n2", title: "Decision B", category: "decision" },
    { nodeId: "n3", title: "Outcome C", category: "outcome" },
  ];

  const links: CausalLink[] = [
    { source: "n1", target: "n2", rationale: "triggered by signal" },
    { source: "n2", target: "n3", rationale: "led to outcome" },
  ];

  const chain = buildCausalChain(nodes, links);

  assert.equal(chain.nodes.length, 3);
  assert.equal(chain.links.length, 2);
  assert.equal(chain.summary.length, 2);
  assert.equal(chain.summary[0], "n1 -> n2: triggered by signal");
});

test("buildCausalChain returns frozen objects", () => {
  const nodes: CausalChainNode[] = [
    { nodeId: "n1", title: "Signal", category: "signal" },
  ];

  const links: CausalLink[] = [
    { source: "n1", target: "n2", rationale: "test" },
  ];

  const chain = buildCausalChain(nodes, links);

  // The arrays themselves should be frozen (shallow freeze)
  assert.ok(Object.isFrozen(chain.nodes));
  assert.ok(Object.isFrozen(chain.links));
  assert.ok(Object.isFrozen(chain.summary));
  // Note: individual nodes/links inside the arrays are not deeply frozen
});

test("buildCausalChain handles all category types", () => {
  const nodes: CausalChainNode[] = [
    { nodeId: "n1", title: "Signal", category: "signal" },
    { nodeId: "n2", title: "Decision", category: "decision" },
    { nodeId: "n3", title: "Action", category: "action" },
    { nodeId: "n4", title: "Outcome", category: "outcome" },
  ];

  const links: CausalLink[] = [
    { source: "n1", target: "n2", rationale: "signal to decision" },
    { source: "n2", target: "n3", rationale: "decision to action" },
    { source: "n3", target: "n4", rationale: "action to outcome" },
  ];

  const chain = buildCausalChain(nodes, links);

  assert.equal(chain.nodes.length, 4);
  assert.equal(chain.links.length, 3);
  assert.equal(chain.summary.length, 3);
});

test("CausalChain has correct structure", () => {
  const nodes: CausalChainNode[] = [
    { nodeId: "start", title: "Start", category: "signal" },
  ];

  const links: CausalLink[] = [];

  const chain: CausalChain = buildCausalChain(nodes, links);

  assert.ok("nodes" in chain);
  assert.ok("links" in chain);
  assert.ok("summary" in chain);
  assert.ok(Array.isArray(chain.nodes));
  assert.ok(Array.isArray(chain.links));
  assert.ok(Array.isArray(chain.summary));
});
