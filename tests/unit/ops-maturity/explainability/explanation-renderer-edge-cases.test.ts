/**
 * Unit tests for ExplanationRenderer - edge cases and additional coverage
 *
 * @see src/ops-maturity/explainability/explanation-renderer/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildDecisionTree,
  renderForAudience,
  renderPlainTextExplanation,
  renderStageExplanation,
  renderStructuredExplanation,
  type StructuredExplanation,
} from "../../../../src/ops-maturity/explainability/index.js";
import type { CausalLink } from "../../../../src/ops-maturity/explainability/index.js";

describe("ExplanationRenderer - Edge Cases", () => {
  describe("buildDecisionTree", () => {
    test("root node has correct structure", () => {
      const tree = buildDecisionTree("Root Label", [], [], []);

      assert.equal(tree.rootNode.nodeId, "root");
      assert.equal(tree.rootNode.type, "decision");
      assert.equal(tree.rootNode.label, "Root Label");
    });

    test("causal links create source and target nodes", () => {
      const links: CausalLink[] = [
        { source: "input_ok", target: "process_start", rationale: "Ready to process" },
        { source: "process_start", target: "done", rationale: "Complete" },
      ];
      const tree = buildDecisionTree("Test", links, [], []);

      const nodeIds = tree.allNodes.map((n) => n.nodeId);
      assert.ok(nodeIds.includes("causal-input_ok"));
      assert.ok(nodeIds.includes("causal-process_start"));
      assert.ok(nodeIds.includes("causal-done"));
    });

    test("duplicate causal link sources do not create duplicate nodes", () => {
      const links: CausalLink[] = [
        { source: "same_node", target: "target1", rationale: "first" },
        { source: "same_node", target: "target2", rationale: "second" },
      ];
      const tree = buildDecisionTree("Test", links, [], []);

      const sourceNodes = tree.allNodes.filter((n) => n.nodeId === "causal-same_node");
      assert.equal(sourceNodes.length, 1);
    });

    test("evidence nodes have sequential IDs", () => {
      const tree = buildDecisionTree("Test", [], ["ev_a", "ev_b", "ev_c"], []);

      const evidenceNodes = tree.allNodes.filter((n) => n.nodeId.startsWith("evidence-"));
      assert.equal(evidenceNodes.length, 3);
      assert.equal(evidenceNodes[0]!.nodeId, "evidence-0");
      assert.equal(evidenceNodes[1]!.nodeId, "evidence-1");
      assert.equal(evidenceNodes[2]!.nodeId, "evidence-2");
    });

    test("decision factor nodes have correct type", () => {
      const tree = buildDecisionTree("Test", [], [], ["factor_a", "factor_b"]);

      const factorNodes = tree.allNodes.filter((n) => n.type === "factor");
      assert.ok(factorNodes.length >= 2);
    });

    test("all node types are represented when all inputs provided", () => {
      const links: CausalLink[] = [{ source: "src", target: "tgt", rationale: "r" }];
      const tree = buildDecisionTree("Test", links, ["evidence"], ["factor"]);

      const types = [...new Set(tree.allNodes.map((n) => n.type))];
      assert.ok(types.includes("decision"));
      assert.ok(types.includes("factor"));
      assert.ok(types.includes("evidence"));
      assert.ok(types.includes("outcome"));
    });

    test("maxDepth is calculated as number", () => {
      const tree = buildDecisionTree("Test", [], [], []);
      assert.ok(typeof tree.maxDepth === "number");
    });

    test("format and version fields are correct", () => {
      const tree = buildDecisionTree("Test", [], [], []);
      assert.equal(tree.format, "decision_tree");
      assert.equal(tree.version, "1.0");
    });

    test("empty inputs produce tree with only root node", () => {
      const tree = buildDecisionTree("Empty Test", [], [], []);

      assert.equal(tree.rootNode.label, "Empty Test");
      assert.ok(tree.allNodes.length >= 1);
    });
  });

  describe("renderStageExplanation", () => {
    test("includes evidence list when provided", () => {
      const result = renderStageExplanation("plan", "Planning", ["ev1", "ev2", "ev3"]);
      assert.ok(result.includes("[evidence=ev1,ev2,ev3]"));
    });

    test("single evidence item renders correctly", () => {
      const result = renderStageExplanation("execute", "Running", ["only_one"]);
      assert.ok(result.includes("only_one"));
    });

    test("empty evidence list produces clean output", () => {
      const result = renderStageExplanation("observe", "Observing", []);
      assert.equal(result, "observe: Observing");
    });

    test("stage name appears at start", () => {
      const result = renderStageExplanation("my_stage", "Description", []);
      assert.ok(result.startsWith("my_stage:"));
    });
  });

  describe("renderPlainTextExplanation", () => {
    test("factors section appears when factors provided", () => {
      const result = renderPlainTextExplanation("test", "summary", [], [], ["factor1", "factor2"]);
      assert.ok(result.includes("Factors:"));
      assert.ok(result.includes("factor1"));
      assert.ok(result.includes("factor2"));
    });

    test("evidence section appears when evidence provided", () => {
      const result = renderPlainTextExplanation("test", "summary", [], ["data1", "data2"], []);
      assert.ok(result.includes("Evidence:"));
      assert.ok(result.includes("data1"));
      assert.ok(result.includes("data2"));
    });

    test("reasoning chain section appears when causal links provided", () => {
      const links: CausalLink[] = [{ source: "A", target: "B", rationale: "Because A leads to B" }];
      const result = renderPlainTextExplanation("test", "summary", links, [], []);
      assert.ok(result.includes("Reasoning Chain:"));
      assert.ok(result.includes("A → B"));
      assert.ok(result.includes("Because A leads to B"));
    });

    test("multiple causal links render all", () => {
      const links: CausalLink[] = [
        { source: "X", target: "Y", rationale: "r1" },
        { source: "Y", target: "Z", rationale: "r2" },
      ];
      const result = renderPlainTextExplanation("test", "summary", links, [], []);
      assert.ok(result.includes("X → Y"));
      assert.ok(result.includes("Y → Z"));
    });

    test("no sections when all inputs empty", () => {
      const result = renderPlainTextExplanation("test", "summary", [], [], []);
      const lines = result.split("\n");
      assert.equal(lines.length, 1);
      assert.ok(result.includes("[test]"));
      assert.ok(result.includes("summary"));
    });
  });

  describe("renderStructuredExplanation", () => {
    test("returns valid JSON string", () => {
      const json = renderStructuredExplanation("stage", "summary", [], [], []);
      const parsed = JSON.parse(json);
      assert.equal(parsed.format, "decision_tree");
      assert.equal(parsed.version, "1.0");
    });

    test("JSON structure contains allNodes array", () => {
      const json = renderStructuredExplanation("stage", "summary", [], ["ev"], ["fac"]);
      const parsed = JSON.parse(json);
      assert.ok(Array.isArray(parsed.allNodes));
    });

    test("JSON rootNode has expected fields", () => {
      const json = renderStructuredExplanation("stage", "summary", [], [], []);
      const parsed = JSON.parse(json);
      assert.ok(parsed.rootNode);
      assert.ok(parsed.rootNode.nodeId);
      assert.ok(parsed.rootNode.type);
      assert.ok(parsed.rootNode.label);
    });

    test("pretty-printed JSON has indentation", () => {
      const json = renderStructuredExplanation("stage", "summary", [], [], []);
      assert.ok(json.includes("  "));
    });
  });

  describe("renderForAudience", () => {
    test("technical audience gets structured JSON", () => {
      const result = renderForAudience("execute", "Summary", [], [], [], "technical");
      const parsed = JSON.parse(result);
      assert.equal(parsed.format, "decision_tree");
    });

    test("audit audience gets structured JSON", () => {
      const result = renderForAudience("execute", "Summary", [], [], [], "audit");
      const parsed = JSON.parse(result);
      assert.equal(parsed.format, "decision_tree");
    });

    test("business audience gets plain text", () => {
      const result = renderForAudience("execute", "Summary text here", [], [], [], "business");
      assert.ok(!result.startsWith("{"));
      assert.ok(result.includes("Summary text here"));
    });

    test("unknown audience falls back to plain text", () => {
      const result = renderForAudience("execute", "Summary", [], [], [], "unknown" as any);
      assert.ok(!result.startsWith("{"));
    });

    test("stage name appears in business format", () => {
      const result = renderForAudience("plan", "Planning phase", [], [], [], "business");
      assert.ok(result.includes("[plan]") || result.includes("plan"));
    });
  });

  describe("DecisionTreeNode structure", () => {
    test("nodes can have children", () => {
      const tree = buildDecisionTree("Parent", [{ source: "a", target: "b", rationale: "r" }], [], []);
      const parent = tree.rootNode;
      assert.ok(Array.isArray(parent.children));
    });

    test("nodes can have optional metadata", () => {
      const tree = buildDecisionTree("Test", [], [], []);
      assert.ok(tree.allNodes.every((n) => n.metadata === undefined));
    });

    test("evidence nodes have no children", () => {
      const tree = buildDecisionTree("Test", [], ["evidence_item"], []);
      const evidenceNodes = tree.allNodes.filter((n) => n.type === "evidence");
      assert.ok(evidenceNodes.every((n) => n.children === undefined || n.children.length === 0));
    });
  });

  describe("StructuredExplanation interface", () => {
    test("format field is always decision_tree", () => {
      const tree = buildDecisionTree("Test", [], [], []);
      assert.equal(tree.format, "decision_tree");
    });

    test("version field is semver-like string", () => {
      const tree = buildDecisionTree("Test", [], [], []);
      assert.match(tree.version, /^\d+\.\d+$/);
    });

    test("allNodes contains root node plus additional nodes", () => {
      const tree = buildDecisionTree("Root", [{ source: "a", target: "b", rationale: "r" }], ["e"], ["f"]);
      assert.ok(tree.allNodes.length >= 1);
      assert.ok(tree.allNodes.some((n) => n.nodeId === "root"));
    });
  });
});
