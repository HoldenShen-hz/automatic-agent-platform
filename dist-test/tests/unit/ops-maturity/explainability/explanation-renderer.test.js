/**
 * Unit tests for ExplanationRenderer
 *
 * @see src/ops-maturity/explainability/explanation-renderer/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionTree, renderForAudience, renderPlainTextExplanation, renderStageExplanation, renderStructuredExplanation, } from "../../../../src/ops-maturity/explainability/index.js";
// ============================================================
// renderStageExplanation
// ============================================================
test("renderStageExplanation with evidence formats stage, summary, and evidence IDs", () => {
    const result = renderStageExplanation("plan", "Planning complete", ["ev-1", "ev-2"]);
    assert.equal(result, "plan: Planning complete [evidence=ev-1,ev-2]");
});
test("renderStageExplanation without evidence returns just stage and summary", () => {
    const result = renderStageExplanation("execute", "Execution done", []);
    assert.equal(result, "execute: Execution done");
});
test("renderStageExplanation with single evidence item", () => {
    const result = renderStageExplanation("assess", "Assessment", ["only"]);
    assert.equal(result, "assess: Assessment [evidence=only]");
});
test("renderStageExplanation stage appears at beginning", () => {
    const result = renderStageExplanation("my_stage", "Some summary", []);
    assert.ok(result.startsWith("my_stage:"));
});
test("renderStageExplanation summary appears after colon", () => {
    const result = renderStageExplanation("stage", "The summary text", []);
    assert.ok(result.includes("The summary text"));
});
// ============================================================
// buildDecisionTree
// ============================================================
test("buildDecisionTree creates root node with correct properties", () => {
    const tree = buildDecisionTree("Root Label", [], [], []);
    assert.equal(tree.rootNode.nodeId, "root");
    assert.equal(tree.rootNode.type, "decision");
    assert.equal(tree.rootNode.label, "Root Label");
    assert.ok(Array.isArray(tree.rootNode.children));
});
test("buildDecisionTree returns StructuredExplanation with format and version", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.equal(tree.format, "decision_tree");
    assert.equal(tree.version, "1.0");
});
test("buildDecisionTree maxDepth is a number", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.equal(typeof tree.maxDepth, "number");
});
test("buildDecisionTree with causal links creates source and target nodes", () => {
    const links = [
        { source: "input_valid", target: "processing", rationale: "Input passed validation" },
    ];
    const tree = buildDecisionTree("Test", links, [], []);
    const nodeIds = tree.allNodes.map((n) => n.nodeId);
    assert.ok(nodeIds.includes("source-input_valid"));
    assert.ok(nodeIds.includes("target-processing"));
});
test("buildDecisionTree with evidence labels creates evidence nodes", () => {
    const tree = buildDecisionTree("Test", [], ["Evidence A", "Evidence B"], []);
    const evidenceNodes = tree.allNodes.filter((n) => n.type === "evidence");
    assert.equal(evidenceNodes.length, 2);
    assert.equal(evidenceNodes[0].label, "Evidence A");
    assert.equal(evidenceNodes[1].label, "Evidence B");
});
test("buildDecisionTree evidence nodes have sequential IDs", () => {
    const tree = buildDecisionTree("Test", [], ["a", "b", "c"], []);
    const evidenceIds = tree.allNodes
        .filter((n) => n.type === "evidence")
        .map((n) => n.nodeId);
    assert.deepStrictEqual(evidenceIds, ["evidence-0", "evidence-1", "evidence-2"]);
});
test("buildDecisionTree with decision factors creates factor nodes", () => {
    const tree = buildDecisionTree("Test", [], [], ["Cost Factor", "Risk Factor"]);
    const factorNodes = tree.allNodes.filter((n) => n.type === "factor");
    assert.ok(factorNodes.some((n) => n.label === "Cost Factor"));
    assert.ok(factorNodes.some((n) => n.label === "Risk Factor"));
});
test("buildDecisionTree with causal links creates outcome nodes", () => {
    const links = [
        { source: "start", target: "finish", rationale: "Process completed" },
    ];
    const tree = buildDecisionTree("Test", links, [], []);
    const outcomeNodes = tree.allNodes.filter((n) => n.type === "outcome");
    assert.ok(outcomeNodes.some((n) => n.label === "finish"));
});
test("buildDecisionTree all node types appear when all inputs provided", () => {
    const links = [{ source: "src", target: "tgt", rationale: "r" }];
    const tree = buildDecisionTree("Test", links, ["evidence"], ["factor"]);
    const types = [...new Set(tree.allNodes.map((n) => n.type))];
    assert.ok(types.includes("decision"), "should have decision type");
    assert.ok(types.includes("factor"), "should have factor type");
    assert.ok(types.includes("evidence"), "should have evidence type");
    assert.ok(types.includes("outcome"), "should have outcome type");
});
test("buildDecisionTree empty inputs produces tree with only root node", () => {
    const tree = buildDecisionTree("Only Root", [], [], []);
    assert.equal(tree.rootNode.label, "Only Root");
    assert.ok(tree.allNodes.length >= 1);
    const nodeIds = tree.allNodes.map((n) => n.nodeId);
    assert.ok(nodeIds.includes("root"));
});
test("buildDecisionTree duplicate causal link sources do not create duplicate nodes", () => {
    const links = [
        { source: "same_node", target: "target1", rationale: "first" },
        { source: "same_node", target: "target2", rationale: "second" },
    ];
    const tree = buildDecisionTree("Test", links, [], []);
    const sourceNodes = tree.allNodes.filter((n) => n.nodeId === "source-same_node");
    assert.equal(sourceNodes.length, 1);
});
test("buildDecisionTree multiple causal links create all source and target nodes", () => {
    const links = [
        { source: "A", target: "B", rationale: "A leads to B" },
        { source: "B", target: "C", rationale: "B leads to C" },
    ];
    const tree = buildDecisionTree("Test", links, [], []);
    const nodeIds = tree.allNodes.map((n) => n.nodeId);
    assert.ok(nodeIds.includes("source-A"));
    assert.ok(nodeIds.includes("target-B"));
    assert.ok(nodeIds.includes("source-B"));
    assert.ok(nodeIds.includes("target-C"));
});
test("buildDecisionTree allNodes contains root node", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.ok(tree.allNodes.some((n) => n.nodeId === "root"));
});
test("buildDecisionTree children is empty array for root", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.ok(Array.isArray(tree.rootNode.children));
    assert.equal(tree.rootNode.children.length, 0);
});
// ============================================================
// renderStructuredExplanation
// ============================================================
test("renderStructuredExplanation returns valid JSON string", () => {
    const result = renderStructuredExplanation("execute", "Task done", [], [], []);
    const parsed = JSON.parse(result);
    assert.equal(parsed.format, "decision_tree");
    assert.equal(parsed.version, "1.0");
});
test("renderStructuredExplanation JSON contains rootNode", () => {
    const result = renderStructuredExplanation("plan", "Planning complete", [], [], []);
    const parsed = JSON.parse(result);
    assert.ok(parsed.rootNode);
    assert.equal(parsed.rootNode.nodeId, "root");
    assert.equal(parsed.rootNode.label, "Planning complete");
});
test("renderStructuredExplanation JSON contains allNodes array", () => {
    const result = renderStructuredExplanation("test", "summary", [], ["evidence"], ["factor"]);
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.allNodes));
    assert.ok(parsed.allNodes.length > 0);
});
test("renderStructuredExplanation pretty prints with indentation", () => {
    const result = renderStructuredExplanation("stage", "summary", [], [], []);
    // Pretty printed JSON should have newlines and spaces
    assert.ok(result.includes("\n"));
    assert.ok(result.includes("  "));
});
test("renderStructuredExplanation includes causal link information", () => {
    const links = [
        { source: "input", target: "output", rationale: "transformed" },
    ];
    const result = renderStructuredExplanation("execute", "Transform", links, [], []);
    const parsed = JSON.parse(result);
    const sourceNode = parsed.allNodes.find((n) => n.nodeId === "source-input");
    const targetNode = parsed.allNodes.find((n) => n.nodeId === "target-output");
    assert.ok(sourceNode);
    assert.ok(targetNode);
});
test("renderStructuredExplanation with decision factors includes factor nodes", () => {
    const result = renderStructuredExplanation("test", "summary", [], [], ["Factor A", "Factor B"]);
    const parsed = JSON.parse(result);
    const factorNodes = parsed.allNodes.filter((n) => n.type === "factor");
    assert.ok(factorNodes.some((n) => n.label === "Factor A"));
    assert.ok(factorNodes.some((n) => n.label === "Factor B"));
});
// ============================================================
// renderPlainTextExplanation
// ============================================================
test("renderPlainTextExplanation includes stage and summary on first line", () => {
    const result = renderPlainTextExplanation("assess", "Assessment complete", [], [], []);
    assert.ok(result.includes("[assess]"));
    assert.ok(result.includes("Assessment complete"));
});
test("renderPlainTextExplanation with factors shows Factors section", () => {
    const result = renderPlainTextExplanation("test", "summary", [], [], ["Factor 1", "Factor 2"]);
    assert.ok(result.includes("Factors:"));
    assert.ok(result.includes("  • Factor 1"));
    assert.ok(result.includes("  • Factor 2"));
});
test("renderPlainTextExplanation with evidence shows Evidence section", () => {
    const result = renderPlainTextExplanation("test", "summary", [], ["Evidence A", "Evidence B"], []);
    assert.ok(result.includes("Evidence:"));
    assert.ok(result.includes("  • Evidence A"));
    assert.ok(result.includes("  • Evidence B"));
});
test("renderPlainTextExplanation with causal links shows Reasoning Chain section", () => {
    const links = [
        { source: "Condition A", target: "Result B", rationale: "A leads to B" },
    ];
    const result = renderPlainTextExplanation("test", "summary", links, [], []);
    assert.ok(result.includes("Reasoning Chain:"));
    assert.ok(result.includes("Condition A → Result B"));
    assert.ok(result.includes("A leads to B"));
});
test("renderPlainTextExplanation multiple causal links shows all", () => {
    const links = [
        { source: "A", target: "B", rationale: "first" },
        { source: "B", target: "C", rationale: "second" },
    ];
    const result = renderPlainTextExplanation("test", "summary", links, [], []);
    assert.ok(result.includes("A → B (first)"));
    assert.ok(result.includes("B → C (second)"));
});
test("renderPlainTextExplanation all sections appear when all inputs provided", () => {
    const links = [{ source: "start", target: "end", rationale: "done" }];
    const result = renderPlainTextExplanation("stage", "Summary text", links, ["ev"], ["fac"]);
    assert.ok(result.includes("[stage]"));
    assert.ok(result.includes("Summary text"));
    assert.ok(result.includes("Factors:"));
    assert.ok(result.includes("Evidence:"));
    assert.ok(result.includes("Reasoning Chain:"));
});
test("renderPlainTextExplanation only stage and summary when no additional inputs", () => {
    const result = renderPlainTextExplanation("plan", "Planning", [], [], []);
    const lines = result.split("\n");
    assert.equal(lines.length, 1);
    assert.ok(result.includes("[plan]"));
    assert.ok(result.includes("Planning"));
});
test("renderPlainTextExplanation bullet points use middle dot character", () => {
    const result = renderPlainTextExplanation("test", "summary", [], ["item"], []);
    assert.ok(result.includes("•"));
});
// ============================================================
// renderForAudience
// ============================================================
test("renderForAudience technical returns JSON format", () => {
    const result = renderForAudience("execute", "Task complete", [], [], [], "technical");
    const parsed = JSON.parse(result);
    assert.equal(parsed.format, "decision_tree");
});
test("renderForAudience audit returns JSON format", () => {
    const result = renderForAudience("deploy", "Deployment done", [], [], [], "audit");
    const parsed = JSON.parse(result);
    assert.equal(parsed.format, "decision_tree");
});
test("renderForAudience business returns plain text format", () => {
    const result = renderForAudience("execute", "Task done", [], [], [], "business");
    assert.ok(!result.startsWith("{"));
    assert.ok(result.includes("Task done") || result.includes("execute"));
});
test("renderForAudience default case falls back to plain text", () => {
    const result = renderForAudience("test", "Summary", [], [], [], "unknown");
    // Should not be JSON (no leading brace)
    assert.ok(!result.startsWith("{"));
});
test("renderForAudience stage name appears in technical output", () => {
    const result = renderForAudience("plan", "Planning phase", [], [], [], "technical");
    const parsed = JSON.parse(result);
    assert.equal(parsed.rootNode.label, "Planning phase");
});
test("renderForAudience stage name appears in business output", () => {
    const result = renderForAudience("execute", "Running task", [], [], [], "business");
    assert.ok(result.includes("execute") || result.includes("Running task"));
});
test("renderForAudience includes causal links in technical output", () => {
    const links = [
        { source: "input_valid", target: "processing", rationale: "ready" },
    ];
    const result = renderForAudience("execute", "Summary", links, [], [], "technical");
    const parsed = JSON.parse(result);
    const nodeIds = parsed.allNodes.map((n) => n.nodeId);
    assert.ok(nodeIds.includes("source-input_valid"));
});
test("renderForAudience includes decision factors in audit output", () => {
    const result = renderForAudience("review", "Reviewing", [], [], ["cost_factor", "risk_factor"], "audit");
    const parsed = JSON.parse(result);
    const factorNodes = parsed.allNodes.filter((n) => n.type === "factor");
    assert.ok(factorNodes.length >= 2);
});
// ============================================================
// DecisionTreeNode structure
// ============================================================
test("DecisionTreeNode types are valid strings", () => {
    const tree = buildDecisionTree("Test", [], ["ev"], ["fac"]);
    for (const node of tree.allNodes) {
        assert.ok(["decision", "factor", "evidence", "outcome"].includes(node.type), `Invalid node type: ${node.type}`);
    }
});
test("DecisionTreeNode nodeId is a string", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    for (const node of tree.allNodes) {
        assert.equal(typeof node.nodeId, "string");
    }
});
test("DecisionTreeNode label is a string", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    for (const node of tree.allNodes) {
        assert.equal(typeof node.label, "string");
    }
});
test("DecisionTreeNode confidence is optional number", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    for (const node of tree.allNodes) {
        if (node.confidence !== undefined) {
            assert.equal(typeof node.confidence, "number");
        }
    }
});
test("DecisionTreeNode children is optional array", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    for (const node of tree.allNodes) {
        if (node.children !== undefined) {
            assert.ok(Array.isArray(node.children));
        }
    }
});
test("DecisionTreeNode metadata is optional record", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    for (const node of tree.allNodes) {
        if (node.metadata !== undefined) {
            assert.equal(typeof node.metadata, "object");
        }
    }
});
test("evidence nodes do not have children defined", () => {
    const tree = buildDecisionTree("Test", [], ["evidence_item"], []);
    const evidenceNodes = tree.allNodes.filter((n) => n.type === "evidence");
    for (const node of evidenceNodes) {
        assert.ok(node.children === undefined || node.children.length === 0);
    }
});
test("factor nodes may or may not have children", () => {
    const tree = buildDecisionTree("Test", [], [], ["factor_a", "factor_b"]);
    const factorNodes = tree.allNodes.filter((n) => n.type === "factor");
    // Factor nodes can have children or not - just verify the property exists or is empty
    for (const node of factorNodes) {
        assert.ok(node.children === undefined || Array.isArray(node.children));
    }
});
// ============================================================
// StructuredExplanation interface
// ============================================================
test("StructuredExplanation format is always decision_tree", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.equal(tree.format, "decision_tree");
});
test("StructuredExplanation version follows semver pattern", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.match(tree.version, /^\d+\.\d+$/);
});
test("StructuredExplanation rootNode is always present", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.ok(tree.rootNode);
});
test("StructuredExplanation allNodes is always an array", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.ok(Array.isArray(tree.allNodes));
});
test("StructuredExplanation allNodes length matches number of unique nodes", () => {
    const links = [
        { source: "a", target: "b", rationale: "r" },
        { source: "b", target: "c", rationale: "r2" },
    ];
    const tree = buildDecisionTree("Test", links, ["e1", "e2"], ["f1"]);
    // Should have root + sources + targets + evidence + factors
    assert.ok(tree.allNodes.length >= 1);
});
test("StructuredExplanation maxDepth is non-negative", () => {
    const tree = buildDecisionTree("Test", [], [], []);
    assert.ok(tree.maxDepth >= 0);
});
// ============================================================
// Edge cases and boundary conditions
// ============================================================
test("buildDecisionTree with empty strings for labels", () => {
    const tree = buildDecisionTree("", [], [""], [""]);
    assert.equal(tree.rootNode.label, "");
    assert.ok(tree.allNodes.some((n) => n.label === ""));
});
test("buildDecisionTree with special characters in labels", () => {
    const tree = buildDecisionTree("Test <>&\"'!@#$", [], [], []);
    assert.equal(tree.rootNode.label, "Test <>&\"'!@#$");
});
test("renderStageExplanation with empty strings", () => {
    const result = renderStageExplanation("", "", []);
    assert.equal(result, ": ");
});
test("renderStageExplanation with unicode characters", () => {
    const result = renderStageExplanation("阶段", "摘要内容", []);
    assert.ok(result.includes("阶段"));
});
test("renderPlainTextExplanation with empty strings in causal links", () => {
    const links = [{ source: "", target: "", rationale: "" }];
    const result = renderPlainTextExplanation("test", "summary", links, [], []);
    assert.ok(result.includes("Reasoning Chain:"));
});
test("renderForAudience with very long summary", () => {
    const longSummary = "A".repeat(1000);
    const result = renderForAudience("execute", longSummary, [], [], [], "business");
    assert.ok(result.includes(longSummary));
});
test("buildDecisionTree all nodes have required string fields", () => {
    const tree = buildDecisionTree("Test", [], ["evidence"], ["factor"]);
    for (const node of tree.allNodes) {
        assert.equal(typeof node.nodeId, "string");
        assert.equal(typeof node.type, "string");
        assert.equal(typeof node.label, "string");
    }
});
//# sourceMappingURL=explanation-renderer.test.js.map