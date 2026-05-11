import assert from "node:assert/strict";
import test from "node:test";

import {
  DecisionTreeNode,
  StructuredExplanation,
  renderStageExplanation,
  buildDecisionTree,
  renderStructuredExplanation,
  renderPlainTextExplanation,
  renderForAudience,
} from "../../../../../src/ops-maturity/explainability/explanation-renderer/index.js";
import type { CausalLink } from "../../../../../src/ops-maturity/explainability/causal-chain-builder/index.js";

test("renderStageExplanation formats stage and summary", () => {
  const result = renderStageExplanation("plan", "Task completed successfully", []);
  assert.equal(result, "plan: Task completed successfully");
});

test("renderStageExplanation includes evidence when present", () => {
  const result = renderStageExplanation("execute", "Action taken", ["e1", "e2"]);
  assert.equal(result, "execute: Action taken [evidence=e1,e2]");
});

test("renderStageExplanation omits evidence bracket when empty", () => {
  const result = renderStageExplanation("evaluate", "Result is good", []);
  assert.equal(result, "evaluate: Result is good");
});

test("buildDecisionTree creates correct structure", () => {
  const causalLinks: CausalLink[] = [
    { source: "A", target: "B", rationale: "A leads to B" },
  ];
  const evidenceLabels = ["Evidence 1"];
  const decisionFactors = ["Factor 1"];

  const tree = buildDecisionTree("Root Decision", causalLinks, evidenceLabels, decisionFactors);

  assert.equal(tree.format, "decision_tree");
  assert.equal(tree.version, "1.0");
  assert.equal(tree.rootNode.nodeId, "root");
  assert.equal(tree.rootNode.type, "decision");
  assert.equal(tree.rootNode.label, "Root Decision");
  assert.ok(Array.isArray(tree.allNodes));
  assert.ok(tree.maxDepth >= 0);
});

test("buildDecisionTree includes causal link nodes", () => {
  const causalLinks: CausalLink[] = [
    { source: "Input", target: "Processing", rationale: "takes input" },
    { source: "Processing", target: "Output", rationale: "produces output" },
  ];

  const tree = buildDecisionTree("Process", causalLinks, [], []);

  const sourceNodes = tree.allNodes.filter((n) => n.nodeId.startsWith("source-"));
  const targetNodes = tree.allNodes.filter((n) => n.nodeId.startsWith("target-"));

  assert.ok(sourceNodes.length >= 2);
  assert.ok(targetNodes.length >= 2);
});

test("buildDecisionTree includes evidence nodes", () => {
  const tree = buildDecisionTree("Decision", [], ["Evidence A", "Evidence B"], []);

  const evidenceNodes = tree.allNodes.filter((n) => n.type === "evidence");
  assert.equal(evidenceNodes.length, 2);
  assert.equal(evidenceNodes[0].label, "Evidence A");
  assert.equal(evidenceNodes[1].label, "Evidence B");
});

test("buildDecisionTree includes factor nodes", () => {
  const tree = buildDecisionTree("Decision", [], [], ["Factor X", "Factor Y"]);

  const factorNodes = tree.allNodes.filter((n) => n.type === "factor");
  assert.ok(factorNodes.length >= 2);
});

test("buildDecisionTree calculates maxDepth", () => {
  const causalLinks: CausalLink[] = [
    { source: "A", target: "B", rationale: "A to B" },
    { source: "B", target: "C", rationale: "B to C" },
  ];

  const tree = buildDecisionTree("Root", causalLinks, [], []);

  assert.ok(tree.maxDepth >= 0);
});

test("buildDecisionTree calculates maxDepth for chained causal links", () => {
  // A -> B -> C chain should give maxDepth of at least 2
  const causalLinks: CausalLink[] = [
    { source: "A", target: "B", rationale: "A to B" },
    { source: "B", target: "C", rationale: "B to C" },
  ];

  const tree = buildDecisionTree("Root", causalLinks, [], []);

  // Depth: root(0) -> A(1) -> B(2) -> C(3), so maxDepth should be 3
  assert.equal(tree.maxDepth, 3, "Chained causal links should produce depth 3");
});

test("buildDecisionTree calculates maxDepth for single causal link", () => {
  const causalLinks: CausalLink[] = [
    { source: "A", target: "B", rationale: "A to B" },
  ];

  const tree = buildDecisionTree("Root", causalLinks, [], []);

  // Depth: root(0) -> A(1) -> B(2), so maxDepth should be 2
  assert.equal(tree.maxDepth, 2, "Single causal link should produce depth 2");
});

test("buildDecisionTree calculates maxDepth for root with evidence children", () => {
  const tree = buildDecisionTree("Root", [], ["Evidence 1", "Evidence 2"], []);

  // Depth: root(0) -> evidence(1), so maxDepth should be 1
  assert.equal(tree.maxDepth, 1, "Evidence children should produce depth 1");
});

test("buildDecisionTree calculates maxDepth for root with factor children", () => {
  const tree = buildDecisionTree("Root", [], [], ["Factor 1", "Factor 2"]);

  // Depth: root(0) -> factor(1), so maxDepth should be 1
  assert.equal(tree.maxDepth, 1, "Factor children should produce depth 1");
});

test("buildDecisionTree calculates maxDepth for root with no children", () => {
  const tree = buildDecisionTree("Root", [], [], []);

  // Root only, depth should be 0
  assert.equal(tree.maxDepth, 0, "Root with no children should have depth 0");
});

test("buildDecisionTree calculates maxDepth for complex graph", () => {
  // Create a more complex graph: root -> A -> B and root -> C -> D
  const causalLinks: CausalLink[] = [
    { source: "A", target: "B", rationale: "A to B" },
    { source: "C", target: "D", rationale: "C to D" },
  ];

  const tree = buildDecisionTree("Root", causalLinks, ["E1"], ["F1"]);

  // Depth: root(0) -> A(1) -> B(2), root(0) -> C(1) -> D(2),
  //        root(0) -> evidence(1), root(0) -> factor(1)
  // max depth should be 2
  assert.equal(tree.maxDepth, 2, "Complex graph should have max depth 2");
});

test("renderStructuredExplanation returns JSON string", () => {
  const causalLinks: CausalLink[] = [
    { source: "Start", target: "End", rationale: "goes to" },
  ];

  const result = renderStructuredExplanation("test", "Summary", causalLinks, [], []);

  const parsed = JSON.parse(result);
  assert.equal(parsed.format, "decision_tree");
  assert.equal(parsed.version, "1.0");
  assert.equal(parsed.rootNode.label, "Summary");
});

test("renderPlainTextExplanation formats with all sections", () => {
  const causalLinks: CausalLink[] = [
    { source: "X", target: "Y", rationale: "because X" },
  ];

  const result = renderPlainTextExplanation("stage", "Summary", causalLinks, ["Evidence 1"], ["Factor 1"]);

  assert.ok(result.includes("[stage] Summary"));
  assert.ok(result.includes("Factors:"));
  assert.ok(result.includes("Evidence:"));
  assert.ok(result.includes("Reasoning Chain:"));
  assert.ok(result.includes("X → Y (because X)"));
});

test("renderPlainTextExplanation omits empty sections", () => {
  const result = renderPlainTextExplanation("stage", "Summary", [], [], []);

  assert.ok(result.includes("[stage] Summary"));
  assert.ok(!result.includes("Factors:"));
  assert.ok(!result.includes("Evidence:"));
  assert.ok(!result.includes("Reasoning Chain:"));
});

test("renderForAudience technical returns structured format", () => {
  const result = renderForAudience("stage", "Summary", [], [], [], "technical");
  const parsed = JSON.parse(result);
  assert.equal(parsed.format, "decision_tree");
});

test("renderForAudience audit returns structured format", () => {
  const result = renderForAudience("stage", "Summary", [], [], [], "audit");
  const parsed = JSON.parse(result);
  assert.equal(parsed.format, "decision_tree");
});

test("renderForAudience business returns plain text", () => {
  const result = renderForAudience("stage", "Summary", [], [], [], "business");
  assert.ok(result.includes("[stage] Summary"));
  assert.ok(!result.includes("decision_tree"));
});

test("DecisionTreeNode accepts all types", () => {
  const node: DecisionTreeNode = {
    nodeId: "test",
    type: "decision",
    label: "Test",
  };
  assert.equal(node.type, "decision");

  const factorNode: DecisionTreeNode = {
    nodeId: "factor",
    type: "factor",
    label: "Factor",
    confidence: 0.8,
  };
  assert.equal(factorNode.type, "factor");
  assert.equal(factorNode.confidence, 0.8);

  const evidenceNode: DecisionTreeNode = {
    nodeId: "evidence",
    type: "evidence",
    label: "Evidence",
    metadata: { source: "log" },
  };
  assert.equal(evidenceNode.type, "evidence");
  assert.equal(evidenceNode.metadata?.source, "log");

  const outcomeNode: DecisionTreeNode = {
    nodeId: "outcome",
    type: "outcome",
    label: "Outcome",
    children: [],
  };
  assert.equal(outcomeNode.type, "outcome");
});

test("StructuredExplanation has correct structure", () => {
  const tree: StructuredExplanation = buildDecisionTree("Root", [], [], []);
  assert.equal(tree.format, "decision_tree");
  assert.equal(tree.version, "1.0");
  assert.ok("rootNode" in tree);
  assert.ok("allNodes" in tree);
  assert.ok("maxDepth" in tree);
});
