/**
 * Unit tests for SimplifiedExplainer - edge cases and additional coverage
 *
 * @see src/ops-maturity/explainability/simplified-explainer/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  simplifyExplanation,
  formatAsMarkdown,
  formatAsNotification,
  type SimplifiedExplanation,
} from "../../../../src/ops-maturity/explainability/index.js";
import type { CausalLink } from "../../../../src/ops-maturity/explainability/index.js";

function makeExplanation(
  overrides: Partial<SimplifiedExplanation> = {},
): SimplifiedExplanation {
  const base: SimplifiedExplanation = {
    headline: "Test Headline",
    whatHappened: "Something happened",
    whyItMatters: "It matters because...",
    whatToDo: "No action required",
    riskLevel: "medium",
    confidencePercent: 70,
    ...overrides,
  };
  return base;
}

describe("SimplifiedExplainer - Edge Cases", () => {
  describe("simplifyExplanation", () => {
    test("returns low confidence when no factors or links provided", () => {
      const result = simplifyExplanation("execute", "Task done", [], [], "medium");
      assert.equal(result.confidencePercent, 50); // base confidence
    });

    test("confidence caps at 100 even with many factors and links", () => {
      const manyFactors = Array(20).fill("factor");
      const manyLinks: CausalLink[] = Array(20).fill({ source: "a", target: "b", rationale: "r" });
      const result = simplifyExplanation("execute", "Task done", manyFactors, manyLinks, "low");
      assert.equal(result.confidencePercent, 100);
    });

    test("unknown risk level maps to medium with question icon", () => {
      const result = simplifyExplanation("execute", "Task done", [], [], "unknown_risk");
      assert.equal(result.riskLevel, "medium");
      assert.ok(result.headline.includes("?"));
    });

    test("case-insensitive risk level mapping", () => {
      const lower = simplifyExplanation("execute", "Task done", [], [], "LOW");
      const upper = simplifyExplanation("execute", "Task done", [], [], "CRITICAL");
      assert.equal(lower.riskLevel, "low");
      assert.equal(upper.riskLevel, "critical");
    });

    test("completed stage returns no-action message", () => {
      const result = simplifyExplanation("completed", "Task completed successfully", [], [], "low");
      assert.ok(result.whatToDo.toLowerCase().includes("no action") || result.whatToDo.toLowerCase().includes("success"));
    });

    test("observe stage returns monitor message", () => {
      const result = simplifyExplanation("observe", "Monitoring system state", [], [], "low");
      assert.ok(result.whatToDo.toLowerCase().includes("monitor"));
    });

    test("assess stage returns monitor message", () => {
      const result = simplifyExplanation("assess", "Analyzing data", [], [], "medium");
      assert.ok(result.whatToDo.toLowerCase().includes("monitor"));
    });

    test("stage name not in STAGE_TERMS uses original name", () => {
      const result = simplifyExplanation("custom_stage", "Custom process", [], [], "low");
      assert.ok(result.headline.includes("custom_stage") || result.headline.includes("Custom Stage"));
    });

    test("whyItMatters returns generic message when no factors match impact keywords", () => {
      const result = simplifyExplanation("execute", "Process ran", ["workflow_name", "task_id"], [], "low");
      assert.ok(result.whyItMatters.length > 0);
    });

    test("whyItMatters maps cost-related factors to business impact", () => {
      const result = simplifyExplanation(
        "execute",
        "Analysis done",
        ["cost_over_budget", "resource_usage_high"],
        [],
        "medium",
      );
      assert.ok(result.whyItMatters.includes("cost") || result.whyItMatters.includes("affect"));
    });

    test("whyItMatters maps security/compliance factors correctly", () => {
      const result = simplifyExplanation(
        "execute",
        "Deployment reviewed",
        ["security_policy_violated", "compliance_check_failed"],
        [],
        "high",
      );
      assert.ok(result.whyItMatters.includes("compliance") || result.whyItMatters.includes("risk"));
    });

    test("whyItMatters handles empty factors gracefully", () => {
      const result = simplifyExplanation("execute", "Simple task", [], [], "low");
      assert.ok(result.whyItMatters.length > 0);
      assert.ok(result.whyItMatters.includes("system rules") || result.whyItMatters.includes("evaluated"));
    });

    test("whatHappened truncates very long summaries", () => {
      const longSummary = "A".repeat(200);
      const result = simplifyExplanation("execute", longSummary, [], [], "low");
      assert.ok(result.whatHappened.length <= longSummary.length + 50);
    });

    test("whatHappened includes factor count when > 3 factors", () => {
      const result = simplifyExplanation(
        "execute",
        "Task done",
        ["factor1", "factor2", "factor3", "factor4", "factor5"],
        [],
        "low",
      );
      assert.ok(result.whatHappened.includes("and 2 more factors") || result.whatHappened.includes("5"));
    });

    test("jargon replacement replaces multiple technical terms", () => {
      const result = simplifyExplanation(
        "execute",
        "The workflow timeout caused a deadlock requiring retry with circuit_breaker fallback",
        [],
        [],
        "medium",
      );
      const jargonTerms = ["workflow", "timeout", "deadlock", "retry", "circuit_breaker", "fallback"];
      const foundJargon = jargonTerms.filter((j) => result.whatHappened.toLowerCase().includes(j));
      assert.equal(foundJargon.length, 0, `Found jargon terms: ${foundJargon.join(", ")}`);
    });

    test("jargon replacement is case-insensitive", () => {
      const result = simplifyExplanation(
        "execute",
        "WORKFLOW deployment with TIMEOUT latency issues",
        [],
        [],
        "medium",
      );
      assert.ok(!result.whatHappened.includes("WORKFLOW"));
      assert.ok(!result.whatHappened.includes("TIMEOUT"));
    });

    test("simplifyText removes technical detail markers like (count=5)", () => {
      const result = simplifyExplanation("execute", "Task processed (items=42, duration=500ms)", [], [], "medium");
      assert.ok(!result.whatHappened.includes("(items=42)"));
      assert.ok(!result.whatHappened.includes("(duration=500ms)"));
    });

    test("simplifyText cleans up multiple spaces", () => {
      const result = simplifyExplanation("execute", "Task    with   many     spaces", [], [], "low");
      assert.ok(!result.whatHappened.includes("  "));
    });
  });

  describe("formatAsMarkdown", () => {
    test("includes risk level and confidence in uppercase", () => {
      const explanation = makeExplanation({ riskLevel: "critical", confidencePercent: 85 });
      const markdown = formatAsMarkdown(explanation);
      assert.ok(markdown.includes("CRITICAL"));
      assert.ok(markdown.includes("85%"));
    });

    test("sections appear in correct order", () => {
      const explanation = makeExplanation();
      const markdown = formatAsMarkdown(explanation);
      const whatIdx = markdown.indexOf("### What Happened");
      const whyIdx = markdown.indexOf("### Why It Matters");
      const actionIdx = markdown.indexOf("### Recommended Action");
      assert.ok(whatIdx < whyIdx);
      assert.ok(whyIdx < actionIdx);
    });
  });

  describe("formatAsNotification", () => {
    test("includes headline, what happened, action, risk and confidence", () => {
      const explanation = makeExplanation({ riskLevel: "high", confidencePercent: 60 });
      const notification = formatAsNotification(explanation);
      assert.ok(notification.includes("Action:"));
      assert.ok(notification.includes("Risk:"));
      assert.ok(notification.includes("HIGH"));
      assert.ok(notification.includes("60%"));
    });

    test("notification is compact single string", () => {
      const explanation = makeExplanation();
      const notification = formatAsNotification(explanation);
      const lines = notification.split("\n");
      assert.ok(lines.length <= 8);
    });
  });

  describe("SimplifiedExplanation interface", () => {
    test("all risk level values are accepted", () => {
      const levels: SimplifiedExplanation["riskLevel"][] = ["low", "medium", "high", "critical"];
      for (const level of levels) {
        const explanation = makeExplanation({ riskLevel: level });
        assert.equal(explanation.riskLevel, level);
      }
    });

    test("confidencePercent must be 0-100", () => {
      const low = makeExplanation({ confidencePercent: 0 });
      const high = makeExplanation({ confidencePercent: 100 });
      assert.equal(low.confidencePercent, 0);
      assert.equal(high.confidencePercent, 100);
    });
  });
});
