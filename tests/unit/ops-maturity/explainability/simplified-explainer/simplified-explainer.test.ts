import assert from "node:assert/strict";
import test from "node:test";

import {
  simplifyExplanation,
  formatAsMarkdown,
  formatAsNotification,
} from "../../../../../src/ops-maturity/explainability/simplified-explainer/index.js";
import type { CausalLink } from "../../../../../src/ops-maturity/explainability/causal-chain-builder/index.js";

const emptyCausalLinks: CausalLink[] = [];

test("simplifyExplanation generates headline with stage name", () => {
  const result = simplifyExplanation(
    "observe",
    "System detected anomaly in metrics",
    [],
    emptyCausalLinks,
    "medium"
  );

  assert.ok(result.headline.includes("Data Collection"));
});

test("simplifyExplanation defaults risk level to medium", () => {
  const result = simplifyExplanation(
    "execute",
    "Task completed",
    [],
    emptyCausalLinks
  );

  assert.equal(result.riskLevel, "medium");
});

test("simplifyExplanation maps low risk correctly", () => {
  const result = simplifyExplanation(
    "completed",
    "Task finished",
    [],
    emptyCausalLinks,
    "low"
  );

  assert.equal(result.riskLevel, "low");
});

test("simplifyExplanation maps critical risk correctly", () => {
  const result = simplifyExplanation(
    "failed",
    "Task failed",
    [],
    emptyCausalLinks,
    "critical"
  );

  assert.equal(result.riskLevel, "critical");
});

test("simplifyExplanation includes decision factors in whatHappened", () => {
  const factors = ["Cost exceeded budget", "Time overrun detected", "Quality below threshold"];
  const result = simplifyExplanation(
    "decision",
    "Evaluation completed",
    factors,
    emptyCausalLinks
  );

  assert.ok(result.whatHappened.includes("Key considerations"));
});

test("simplifyExplanation limits decision factors to 3", () => {
  const factors = [
    "Factor 1",
    "Factor 2",
    "Factor 3",
    "Factor 4",
    "Factor 5",
  ];
  const result = simplifyExplanation(
    "decision",
    "Evaluation completed",
    factors,
    emptyCausalLinks
  );

  assert.ok(result.whatHappened.includes("and 2 more factors"));
});

test("simplifyExplanation provides default whyItMatters when no factors", () => {
  const result = simplifyExplanation(
    "execute",
    "Task completed",
    [],
    emptyCausalLinks
  );

  assert.ok(result.whyItMatters.length > 0);
});

test("simplifyExplanation identifies cost-related factors", () => {
  const factors = ["Cost exceeded budget by 20%"];
  const result = simplifyExplanation(
    "decision",
    "Budget review",
    factors,
    emptyCausalLinks
  );

  assert.ok(result.whyItMatters.includes("may affect costs"));
});

test("simplifyExplanation identifies risk-related factors", () => {
  const factors = ["Security risk identified"];
  const result = simplifyExplanation(
    "decision",
    "Security review",
    factors,
    emptyCausalLinks
  );

  assert.ok(result.whyItMatters.includes("involves some level of risk"));
});

test("simplifyExplanation identifies compliance-related factors", () => {
  const factors = ["Compliance violation detected"];
  const result = simplifyExplanation(
    "decision",
    "Compliance review",
    factors,
    emptyCausalLinks
  );

  assert.ok(result.whyItMatters.includes("has compliance implications"));
});

test("simplifyExplanation returns approval action for approval stage", () => {
  const result = simplifyExplanation(
    "approval",
    "Review required",
    [],
    emptyCausalLinks
  );

  assert.ok(result.whatToDo.includes("review"));
});

test("simplifyExplanation returns immediate attention for failed stage", () => {
  const result = simplifyExplanation(
    "failed",
    "Task failed",
    [],
    emptyCausalLinks
  );

  assert.ok(result.whatToDo.includes("Immediate attention"));
});

test("simplifyExplanation returns no action for completed stage", () => {
  const result = simplifyExplanation(
    "completed",
    "Task finished",
    [],
    emptyCausalLinks
  );

  assert.ok(result.whatToDo.includes("No action required"));
});

test("simplifyExplanation calculates confidence from factors and causal links", () => {
  const factors = ["Factor 1", "Factor 2", "Factor 3"];
  const causalLinks: CausalLink[] = [
    { cause: "a", effect: "b", confidence: 0.5, evidence: [] },
    { cause: "b", effect: "c", confidence: 0.5, evidence: [] },
  ];
  const result = simplifyExplanation(
    "assess",
    "Analysis complete",
    factors,
    causalLinks
  );

  // Base 50 + 3*5=15 + 2*5=10 = 75
  assert.equal(result.confidencePercent, 75);
});

test("simplifyExplanation caps confidence at 100", () => {
  const factors = ["Factor 1", "Factor 2", "Factor 3", "Factor 4", "Factor 5"];
  const causalLinks: CausalLink[] = [
    { cause: "a", effect: "b", confidence: 0.5, evidence: [] },
    { cause: "b", effect: "c", confidence: 0.5, evidence: [] },
    { cause: "c", effect: "d", confidence: 0.5, evidence: [] },
    { cause: "d", effect: "e", confidence: 0.5, evidence: [] },
    { cause: "e", effect: "f", confidence: 0.5, evidence: [] },
  ];
  const result = simplifyExplanation(
    "assess",
    "Analysis complete",
    factors,
    causalLinks
  );

  assert.ok(result.confidencePercent <= 100);
});

test("simplifyExplanation replaces technical jargon with simple terms", () => {
  const result = simplifyExplanation(
    "execution",
    "Workflow deployment completed with orchestration",
    [],
    emptyCausalLinks
  );

  assert.ok(!result.whatHappened.includes("workflow"));
  assert.ok(!result.whatHappened.includes("deployment"));
});

test("formatAsMarkdown generates valid markdown", () => {
  const explanation = simplifyExplanation(
    "execute",
    "Task completed successfully",
    [],
    emptyCausalLinks,
    "low"
  );

  const markdown = formatAsMarkdown(explanation);

  assert.ok(markdown.includes("##"));
  assert.ok(markdown.includes("**Risk Level:**"));
  assert.ok(markdown.includes("### What Happened"));
  assert.ok(markdown.includes("### Why It Matters"));
  assert.ok(markdown.includes("### Recommended Action"));
});

test("formatAsNotification generates notification text", () => {
  const explanation = simplifyExplanation(
    "execute",
    "Task completed",
    [],
    emptyCausalLinks,
    "low"
  );

  const notification = formatAsNotification(explanation);

  assert.ok(notification.includes(explanation.headline));
  assert.ok(notification.includes("Action:"));
  assert.ok(notification.includes("Risk:"));
  assert.ok(notification.includes("Confidence:"));
});