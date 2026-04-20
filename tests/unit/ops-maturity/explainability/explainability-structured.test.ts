import assert from "node:assert/strict";
import test from "node:test";

import {
  // From explanation-renderer
  renderStageExplanation,
  renderPlainTextExplanation,
  renderStructuredExplanation,
  renderForAudience,
  buildDecisionTree,
  type DecisionTreeNode,
  type StructuredExplanation,
  // From simplified-explainer
  simplifyExplanation,
  formatAsMarkdown,
  formatAsNotification,
  type SimplifiedExplanation,
  type AudienceType,
} from "../../../../src/ops-maturity/explainability/index.js";

describe("ExplanationRenderer - Structured Format", () => {
  describe("renderStageExplanation (legacy)", () => {
    test("should render plain text explanation", () => {
      const result = renderStageExplanation("execute", "Task completed successfully", ["ev-1", "ev-2"]);
      assert.ok(result.includes("execute"));
      assert.ok(result.includes("Task completed successfully"));
      assert.ok(result.includes("ev-1"));
    });

    test("should handle empty evidence", () => {
      const result = renderStageExplanation("plan", "Planning phase", []);
      assert.strictEqual(result, "plan: Planning phase");
    });
  });

  describe("buildDecisionTree", () => {
    test("should build decision tree from causal links", () => {
      const causalLinks = [
        { source: "input_validated", target: "processing_started", rationale: "Data passed validation" },
        { source: "processing_started", target: "task_completed", rationale: "All steps succeeded" },
      ];
      const evidenceLabels = ["ValidationReport: pass", "ExecutionLog: success"];
      const factors = ["cost_under_budget", "risk_level_low"];

      const result = buildDecisionTree("Task Execution Summary", causalLinks, evidenceLabels, factors);

      assert.strictEqual(result.format, "decision_tree");
      assert.strictEqual(result.version, "1.0");
      assert.strictEqual(result.rootNode.label, "Task Execution Summary");
      assert.ok(result.allNodes.length > 0);
    });

    test("should calculate max depth", () => {
      const result = buildDecisionTree("Test", [], [], []);
      assert.ok(typeof result.maxDepth === "number");
    });
  });

  describe("renderStructuredExplanation", () => {
    test("should return valid JSON", () => {
      const json = renderStructuredExplanation(
        "execute",
        "Task completed",
        [{ source: "a", target: "b", rationale: "reason" }],
        ["evidence1"],
        ["factor1"],
      );

      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.format, "decision_tree");
      assert.strictEqual(parsed.version, "1.0");
      assert.ok(parsed.rootNode);
      assert.ok(Array.isArray(parsed.allNodes));
    });
  });

  describe("renderPlainTextExplanation", () => {
    test("should render multi-line plain text", () => {
      const result = renderPlainTextExplanation(
        "assess",
        "Analysis completed",
        [{ source: "input", target: "output", rationale: "transformed" }],
        ["data_source_1"],
        ["performance_metric"],
      );

      assert.ok(result.includes("[assess]"));
      assert.ok(result.includes("Analysis completed"));
      assert.ok(result.includes("Factors:"));
      assert.ok(result.includes("Evidence:"));
      assert.ok(result.includes("Reasoning Chain:"));
    });
  });

  describe("renderForAudience", () => {
    test("should use structured format for technical audience", () => {
      const result = renderForAudience(
        "execute",
        "Task completed",
        [],
        [],
        [],
        "technical",
      );
      // Should be JSON
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.format, "decision_tree");
    });

    test("should use plain text for business audience", () => {
      const result = renderForAudience(
        "execute",
        "Task completed",
        [],
        [],
        [],
        "business",
      );
      assert.ok(!result.startsWith("{"));
      assert.ok(result.includes("Task completed"));
    });

    test("should use structured format for audit audience", () => {
      const result = renderForAudience(
        "execute",
        "Task completed",
        [],
        [],
        [],
        "audit",
      );
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.format, "decision_tree");
    });
  });
});

describe("SimplifiedExplainer - Non-Technical Users", () => {
  describe("simplifyExplanation", () => {
    test("should generate headline with stage name", () => {
      const result = simplifyExplanation(
        "execute",
        "Task completed successfully with all validations passed",
        ["cost_under_budget", "risk_level_low"],
        [],
        "low",
      );

      assert.ok(result.headline.includes("Execution") || result.headline.includes("execute"));
      assert.ok(result.headline.includes("completed"));
    });

    test("should map risk levels correctly", () => {
      const lowResult = simplifyExplanation("execute", "Task done", [], [], "low");
      assert.strictEqual(lowResult.riskLevel, "low");

      const highResult = simplifyExplanation("execute", "Task done", [], [], "high");
      assert.strictEqual(highResult.riskLevel, "high");

      const criticalResult = simplifyExplanation("execute", "Task done", [], [], "critical");
      assert.strictEqual(criticalResult.riskLevel, "critical");
    });

    test("should calculate confidence based on factors and links", () => {
      const withFewFactors = simplifyExplanation("execute", "Task done", ["factor1"], [], "low");
      const withManyFactors = simplifyExplanation(
        "execute",
        "Task done",
        ["factor1", "factor2", "factor3", "factor4", "factor5"],
        [],
        "low",
      );

      assert.ok(withManyFactors.confidencePercent > withFewFactors.confidencePercent);
    });

    test("should suggest action for approval stages", () => {
      const result = simplifyExplanation(
        "approval",
        "Review required for production deployment",
        [],
        [],
        "medium",
      );

      assert.ok(result.whatToDo.toLowerCase().includes("review") || result.whatToDo.toLowerCase().includes("approve"));
    });

    test("should suggest action for failed stages", () => {
      const result = simplifyExplanation("failed", "Execution failed due to timeout", [], [], "critical");

      assert.ok(result.whatToDo.toLowerCase().includes("attention") || result.whatToDo.toLowerCase().includes("investigate"));
    });

    test("should explain why it matters for cost-related factors", () => {
      const result = simplifyExplanation(
        "execute",
        "Budget analysis completed",
        ["cost_under_budget", "resource_usage_normal"],
        [],
        "low",
      );

      assert.ok(result.whyItMatters.includes("cost") || result.whyItMatters.includes("affect"));
    });
  });

  describe("formatAsMarkdown", () => {
    test("should format as markdown with sections", () => {
      const explanation = simplifyExplanation(
        "execute",
        "Task completed successfully",
        ["performance_good"],
        [],
        "low",
      );

      const markdown = formatAsMarkdown(explanation);

      assert.ok(markdown.includes("##"));
      assert.ok(markdown.includes("### What Happened"));
      assert.ok(markdown.includes("### Why It Matters"));
      assert.ok(markdown.includes("### Recommended Action"));
      assert.ok(markdown.includes("Risk Level:"));
    });
  });

  describe("formatAsNotification", () => {
    test("should format as compact notification", () => {
      const explanation = simplifyExplanation(
        "execute",
        "Task completed successfully",
        ["performance_good"],
        [],
        "low",
      );

      const notification = formatAsNotification(explanation);

      assert.ok(notification.includes("Execution"));
      assert.ok(notification.includes("Action:"));
      assert.ok(notification.includes("Risk:"));
      assert.ok(notification.includes("Confidence:"));
    });
  });

  describe("jargon simplification", () => {
    test("should replace technical terms", () => {
      const result = simplifyExplanation(
        "execute",
        "The workflow has been deployed and is now running in production",
        ["deployment_successful", "no_errors"],
        [],
        "low",
      );

      // Should use simplified terms
      assert.ok(
        result.whatHappened.includes("process") || result.whatHappened.includes("release") || !result.whatHappened.includes("workflow"),
      );
    });
  });
});

describe("DecisionTreeNode structure", () => {
  test("should have correct node types", () => {
    const tree = buildDecisionTree(
      "Test Decision",
      [{ source: "因子A", target: "结果B", rationale: "原因说明" }],
      ["证据1"],
      ["因素1"],
    );

    const nodes = tree.allNodes;
    const types = nodes.map((n) => n.type);

    assert.ok(types.includes("decision"));
    assert.ok(types.includes("factor"));
    assert.ok(types.includes("evidence"));
    assert.ok(types.includes("outcome"));
  });
});
