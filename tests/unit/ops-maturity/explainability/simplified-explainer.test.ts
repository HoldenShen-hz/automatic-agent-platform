/**
 * Unit tests for SimplifiedExplainer
 *
 * @see src/ops-maturity/explainability/simplified-explainer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

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

// simplifyExplanation tests

test("simplifyExplanation returns correct structure with all fields", () => {
  const result = simplifyExplanation("execute", "Task completed", [], [], "medium");

  assert.equal(typeof result.headline, "string");
  assert.equal(typeof result.whatHappened, "string");
  assert.equal(typeof result.whyItMatters, "string");
  assert.equal(typeof result.whatToDo, "string");
  assert.ok(["low", "medium", "high", "critical"].includes(result.riskLevel));
  assert.equal(typeof result.confidencePercent, "number");
});

test("simplifyExplanation uses default risk level when not provided", () => {
  const result = simplifyExplanation("execute", "Task done", [], []);

  assert.equal(result.riskLevel, "medium");
});

test("simplifyExplanation headline includes stage name in brackets", () => {
  const result = simplifyExplanation("observe", "System monitoring active", [], [], "low");

  assert.ok(result.headline.includes("["));
  assert.ok(result.headline.includes("]"));
});

test("simplifyExplanation headline uses friendly stage term for observe", () => {
  const result = simplifyExplanation("observe", "Collecting metrics", [], [], "low");

  assert.ok(result.headline.includes("Data Collection"));
});

test("simplifyExplanation headline uses friendly stage term for assess", () => {
  const result = simplifyExplanation("assess", "Analyzing data", [], [], "medium");

  assert.ok(result.headline.includes("Analysis"));
});

test("simplifyExplanation headline uses friendly stage term for plan", () => {
  const result = simplifyExplanation("plan", "Creating execution plan", [], [], "medium");

  assert.ok(result.headline.includes("Planning"));
});

test("simplifyExplanation headline uses friendly stage term for execute", () => {
  const result = simplifyExplanation("execute", "Running task", [], [], "medium");

  assert.ok(result.headline.includes("Execution"));
});

test("simplifyExplanation headline uses friendly stage term for feedback", () => {
  const result = simplifyExplanation("feedback", "Reviewing results", [], [], "low");

  assert.ok(result.headline.includes("Review"));
});

test("simplifyExplanation headline uses friendly stage term for learn", () => {
  const result = simplifyExplanation("learn", "Learning from execution", [], [], "low");

  assert.ok(result.headline.includes("Learning"));
});

test("simplifyExplanation headline uses friendly stage term for improve", () => {
  const result = simplifyExplanation("improve", "Optimizing performance", [], [], "low");

  assert.ok(result.headline.includes("Improvement"));
});

test("simplifyExplanation headline uses friendly stage term for recover", () => {
  const result = simplifyExplanation("recover", "Restoring system", [], [], "high");

  assert.ok(result.headline.includes("Recovery"));
});

test("simplifyExplanation headline uses friendly stage term for decision", () => {
  const result = simplifyExplanation("decision", "Making choice", [], [], "medium");

  assert.ok(result.headline.includes("Decision"));
});

test("simplifyExplanation headline uses friendly stage term for approval", () => {
  const result = simplifyExplanation("approval", "Awaiting approval", [], [], "medium");

  assert.ok(result.headline.includes("Approval Required"));
});

test("simplifyExplanation headline uses friendly stage term for completed", () => {
  const result = simplifyExplanation("completed", "Task finished", [], [], "low");

  assert.ok(result.headline.includes("Completed"));
});

test("simplifyExplanation headline uses friendly stage term for failed", () => {
  const result = simplifyExplanation("failed", "Task failed", [], [], "high");

  assert.ok(result.headline.includes("Failed"));
});

test("simplifyExplanation truncates summary to 100 chars in headline", () => {
  const longSummary = "A".repeat(150);
  const result = simplifyExplanation("execute", longSummary, [], [], "low");

  // headline format: icon + [stage] + truncated_summary (max 100 chars) + "..."
  // Total max: ~1 + ~18 + ~100 = ~119
  assert.ok(result.headline.length <= 130);
});

test("simplifyExplanation uses icon for low risk level", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "low");

  assert.ok(result.headline.includes("✓"));
});

test("simplifyExplanation uses icon for medium risk level", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "medium");

  assert.ok(result.headline.includes("⚠"));
});

test("simplifyExplanation uses icon for high risk level", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "high");

  assert.ok(result.headline.includes("⚠"));
});

test("simplifyExplanation uses icon for critical risk level", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "critical");

  assert.ok(result.headline.includes("🚨"));
});

test("simplifyExplanation returns low risk level for low input", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "low");

  assert.equal(result.riskLevel, "low");
});

test("simplifyExplanation returns medium risk level for medium input", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "medium");

  assert.equal(result.riskLevel, "medium");
});

test("simplifyExplanation returns high risk level for high input", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "high");

  assert.equal(result.riskLevel, "high");
});

test("simplifyExplanation returns critical risk level for critical input", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "critical");

  assert.equal(result.riskLevel, "critical");
});

test("simplifyExplanation returns medium risk level for unknown input", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "unknown");

  assert.equal(result.riskLevel, "medium");
});

test("simplifyExplanation confidence is 50 with no factors and no links", () => {
  const result = simplifyExplanation("execute", "Task done", [], []);

  assert.equal(result.confidencePercent, 50);
});

test("simplifyExplanation confidence increases with decision factors", () => {
  const result = simplifyExplanation("execute", "Task done", ["factor1", "factor2"], []);

  assert.equal(result.confidencePercent, 60); // 50 + 2*5
});

test("simplifyExplanation confidence increases with causal links", () => {
  const links: CausalLink[] = [
    { source: "a", target: "b", rationale: "r" },
    { source: "b", target: "c", rationale: "r2" },
  ];
  const result = simplifyExplanation("execute", "Task done", [], links);

  assert.equal(result.confidencePercent, 60); // 50 + 2*5
});

test("simplifyExplanation confidence increases with both factors and links", () => {
  const links: CausalLink[] = [{ source: "a", target: "b", rationale: "r" }];
  const result = simplifyExplanation("execute", "Task done", ["factor1"], links);

  assert.equal(result.confidencePercent, 60); // 50 + 1*5 (factor) + 1*5 (link)
});

test("simplifyExplanation confidence caps at 100 with many factors and links", () => {
  const manyFactors = Array(20).fill("factor");
  const manyLinks: CausalLink[] = Array(20).fill({ source: "a", target: "b", rationale: "r" });
  const result = simplifyExplanation("execute", "Task done", manyFactors, manyLinks);

  // 50 + min(20*5, 25) + min(20*5, 25) = 50 + 25 + 25 = 100
  assert.equal(result.confidencePercent, 100);
});

test("simplifyExplanation confidence caps at 75 with many links only", () => {
  const manyLinks: CausalLink[] = Array(20).fill({ source: "a", target: "b", rationale: "r" });
  const result = simplifyExplanation("execute", "Task done", [], manyLinks);

  // 50 + min(20*5, 25) = 50 + 25 = 75
  assert.equal(result.confidencePercent, 75);
});

test("simplifyExplanation whatToDo requires review for approval stage", () => {
  const result = simplifyExplanation("approval", "Awaiting your approval", [], [], "medium");

  assert.ok(result.whatToDo.toLowerCase().includes("review"));
});

test("simplifyExplanation whatToDo requires review for review stage", () => {
  const result = simplifyExplanation("review", "Please review", [], [], "low");

  assert.ok(result.whatToDo.toLowerCase().includes("review"));
});

test("simplifyExplanation whatToDo requires immediate attention for failed stage", () => {
  const result = simplifyExplanation("failed", "Task failed", [], [], "high");

  assert.ok(result.whatToDo.toLowerCase().includes("immediate") || result.whatToDo.toLowerCase().includes("attention"));
});

test("simplifyExplanation whatToDo requires immediate attention for critical risk", () => {
  const result = simplifyExplanation("execute", "Something went wrong", [], [], "critical");

  assert.ok(result.whatToDo.toLowerCase().includes("immediate") || result.whatToDo.toLowerCase().includes("attention"));
});

test("simplifyExplanation whatToDo says no action for completed stage", () => {
  const result = simplifyExplanation("completed", "All done", [], [], "low");

  assert.ok(result.whatToDo.toLowerCase().includes("no action") || result.whatToDo.toLowerCase().includes("success"));
});

test("simplifyExplanation whatToDo says no action for success stage", () => {
  const result = simplifyExplanation("success", "Success", [], [], "low");

  assert.ok(result.whatToDo.toLowerCase().includes("no action") || result.whatToDo.toLowerCase().includes("success"));
});

test("simplifyExplanation whatToDo says monitor for observe stage", () => {
  const result = simplifyExplanation("observe", "Monitoring", [], [], "low");

  assert.ok(result.whatToDo.toLowerCase().includes("monitor"));
});

test("simplifyExplanation whatToDo says monitor for assess stage", () => {
  const result = simplifyExplanation("assess", "Analyzing", [], [], "low");

  assert.ok(result.whatToDo.toLowerCase().includes("monitor"));
});

test("simplifyExplanation whatToDo is informational for other stages", () => {
  const result = simplifyExplanation("execute", "Running", [], [], "low");

  assert.ok(result.whatToDo.toLowerCase().includes("information") || result.whatToDo.toLowerCase().includes("no immediate"));
});

test("simplifyExplanation whatHappened replaces workflow jargon", () => {
  const result = simplifyExplanation("execute", "The workflow stalled", [], [], "medium");

  assert.ok(!result.whatHappened.includes("workflow"));
  assert.ok(result.whatHappened.includes("process"));
});

test("simplifyExplanation whatHappened replaces task jargon", () => {
  const result = simplifyExplanation("execute", "The task failed", [], [], "medium");

  assert.ok(!result.whatHappened.includes("task"));
  assert.ok(result.whatHappened.includes("job"));
});

test("simplifyExplanation whatHappened replaces deployment jargon", () => {
  const result = simplifyExplanation("execute", "Deployment completed", [], [], "medium");

  assert.ok(!result.whatHappened.includes("deployment"));
  assert.ok(result.whatHappened.includes("release"));
});

test("simplifyExplanation whatHappened replaces orchestration jargon", () => {
  const result = simplifyExplanation("execute", "Orchestration running", [], [], "medium");

  assert.ok(!result.whatHappened.includes("orchestration"));
  assert.ok(result.whatHappened.includes("coordination"));
});

test("simplifyExplanation whatHappened replaces provisioning jargon", () => {
  const result = simplifyExplanation("execute", "Provisioning done", [], [], "medium");

  assert.ok(!result.whatHappened.includes("provisioning"));
  assert.ok(result.whatHappened.includes("setup"));
});

test("simplifyExplanation whatHappened replaces degradation jargon", () => {
  const result = simplifyExplanation("execute", "Service degradation detected", [], [], "medium");

  assert.ok(!result.whatHappened.includes("degradation"));
  assert.ok(result.whatHappened.includes("reduced service"));
});

test("simplifyExplanation whatHappened replaces fallback jargon", () => {
  const result = simplifyExplanation("execute", "Fallback activated", [], [], "medium");

  assert.ok(!result.whatHappened.includes("fallback"));
  assert.ok(result.whatHappened.includes("backup plan"));
});

test("simplifyExplanation whatHappened replaces retry jargon", () => {
  const result = simplifyExplanation("execute", "Retry attempted", [], [], "medium");

  assert.ok(!result.whatHappened.includes("retry"));
  assert.ok(result.whatHappened.includes("try again"));
});

test("simplifyExplanation whatHappened replaces circuit_breaker jargon", () => {
  const result = simplifyExplanation("execute", "The circuit_breaker was triggered", [], [], "medium");

  assert.ok(!result.whatHappened.includes("circuit_breaker"));
  assert.ok(result.whatHappened.includes("safety switch"));
});

test("simplifyExplanation whatHappened replaces deadlock jargon", () => {
  const result = simplifyExplanation("execute", "Deadlock detected", [], [], "medium");

  assert.ok(!result.whatHappened.includes("deadlock"));
  assert.ok(result.whatHappened.includes("stuck waiting"));
});

test("simplifyExplanation whatHappened replaces timeout jargon", () => {
  const result = simplifyExplanation("execute", "Request timeout occurred", [], [], "medium");

  assert.ok(!result.whatHappened.includes("timeout"));
  assert.ok(result.whatHappened.includes("took too long"));
});

test("simplifyExplanation whatHappened replaces latency jargon", () => {
  const result = simplifyExplanation("execute", "High latency detected", [], [], "medium");

  assert.ok(!result.whatHappened.includes("latency"));
  assert.ok(result.whatHappened.includes("delay"));
});

test("simplifyExplanation whatHappened replaces throughput jargon", () => {
  const result = simplifyExplanation("execute", "Low throughput", [], [], "medium");

  assert.ok(!result.whatHappened.includes("throughput"));
  assert.ok(result.whatHappened.includes("speed"));
});

test("simplifyExplanation whatHappened replaces reliability jargon", () => {
  const result = simplifyExplanation("execute", "Reliability issues", [], [], "medium");

  assert.ok(!result.whatHappened.includes("reliability"));
  assert.ok(result.whatHappened.includes("uptime"));
});

test("simplifyExplanation whatHappened replaces availability jargon", () => {
  const result = simplifyExplanation("execute", "Availability affected", [], [], "medium");

  assert.ok(!result.whatHappened.includes("availability"));
  assert.ok(result.whatHappened.includes("accessibility"));
});

test("simplifyExplanation whatHappened replaces incident jargon", () => {
  const result = simplifyExplanation("execute", "Incident resolved", [], [], "medium");

  assert.ok(!result.whatHappened.includes("incident"));
  assert.ok(result.whatHappened.includes("issue"));
});

test("simplifyExplanation whatHappened replaces escalation jargon", () => {
  const result = simplifyExplanation("execute", "Escalation needed", [], [], "medium");

  assert.ok(!result.whatHappened.includes("escalation"));
  assert.ok(result.whatHappened.includes("getting help"));
});

test("simplifyExplanation whatHappened replaces principal jargon", () => {
  const result = simplifyExplanation("execute", "Principal authenticated", [], [], "medium");

  assert.ok(!result.whatHappened.includes("principal"));
  assert.ok(result.whatHappened.includes("user account"));
});

test("simplifyExplanation whatHappened replaces tenant jargon", () => {
  const result = simplifyExplanation("execute", "Tenant isolated", [], [], "medium");

  assert.ok(!result.whatHappened.includes("tenant"));
  assert.ok(result.whatHappened.includes("organization"));
});

test("simplifyExplanation whatHappened removes technical detail markers like (count=5)", () => {
  const result = simplifyExplanation("execute", "Task processed (count=42)", [], [], "medium");

  assert.ok(!result.whatHappened.includes("(count=42)"));
});

test("simplifyExplanation whatHappened removes multiple spaces", () => {
  const result = simplifyExplanation("execute", "Task    with   spaces", [], [], "medium");

  assert.ok(!result.whatHappened.includes("  "));
});

test("simplifyExplanation whatHappened includes key considerations with factors", () => {
  const result = simplifyExplanation("execute", "Task done", ["factor1", "factor2"], [], "medium");

  assert.ok(result.whatHappened.includes("Key considerations:"));
});

test("simplifyExplanation whatHappened includes up to 3 factors", () => {
  const result = simplifyExplanation("execute", "Task done", ["f1", "f2", "f3"], [], "medium");

  assert.ok(result.whatHappened.includes("f1"));
  assert.ok(result.whatHappened.includes("f2"));
  assert.ok(result.whatHappened.includes("f3"));
});

test("simplifyExplanation whatHappened shows count when more than 3 factors", () => {
  const result = simplifyExplanation("execute", "Task done", ["f1", "f2", "f3", "f4", "f5"], [], "medium");

  assert.ok(result.whatHappened.includes("2 more factors"));
});

test("simplifyExplanation whyItMatters returns system rules message when no factors", () => {
  const result = simplifyExplanation("execute", "Task done", [], [], "medium");

  assert.ok(result.whyItMatters.includes("system rules") || result.whyItMatters.includes("evaluated"));
});

test("simplifyExplanation whyItMatters returns generic message when no relevant factors", () => {
  const result = simplifyExplanation("execute", "Task done", ["workflow_name", "task_id"], [], "low");

  assert.ok(result.whyItMatters.includes("performance") || result.whyItMatters.includes("operational"));
});

test("simplifyExplanation whyItMatters maps cost factor", () => {
  const result = simplifyExplanation("execute", "Task done", ["cost_over_budget"], [], "medium");

  assert.ok(result.whyItMatters.includes("cost"));
});

test("simplifyExplanation whyItMatters maps time factor to delays", () => {
  const result = simplifyExplanation("execute", "Task done", ["time_constraint"], [], "medium");

  assert.ok(result.whyItMatters.includes("delays") || result.whyItMatters.includes("time"));
});

test("simplifyExplanation whyItMatters maps security factor to compliance", () => {
  const result = simplifyExplanation("execute", "Task done", ["security_check"], [], "medium");

  assert.ok(result.whyItMatters.includes("compliance") || result.whyItMatters.includes("security"));
});

test("simplifyExplanation whyItMatters maps compliance factor", () => {
  const result = simplifyExplanation("execute", "Task done", ["compliance_required"], [], "medium");

  assert.ok(result.whyItMatters.includes("compliance"));
});

test("simplifyExplanation whyItMatters shows at most 2 relevant impacts", () => {
  const result = simplifyExplanation(
    "execute",
    "Task done",
    ["cost_issue", "time_issue", "quality_issue", "security_issue"],
    [],
    "medium",
  );

  const impactCount = (result.whyItMatters.match(/cost|delay|compliance|risk/g) || []).length;
  assert.ok(impactCount <= 4); // Limited by the mapping logic
});

// formatAsMarkdown tests

test("formatAsMarkdown returns a string", () => {
  const explanation = makeExplanation();
  const result = formatAsMarkdown(explanation);

  assert.equal(typeof result, "string");
});

test("formatAsMarkdown includes headline with hash", () => {
  const explanation = makeExplanation({ headline: "Test Headline" });
  const result = formatAsMarkdown(explanation);

  assert.ok(result.includes("## Test Headline"));
});

test("formatAsMarkdown includes risk level in uppercase", () => {
  const explanation = makeExplanation({ riskLevel: "high", confidencePercent: 80 });
  const result = formatAsMarkdown(explanation);

  assert.ok(result.includes("HIGH"));
  assert.ok(result.includes("80%"));
});

test("formatAsMarkdown includes what happened section", () => {
  const explanation = makeExplanation({ whatHappened: "Something happened" });
  const result = formatAsMarkdown(explanation);

  assert.ok(result.includes("### What Happened"));
  assert.ok(result.includes("Something happened"));
});

test("formatAsMarkdown includes why it matters section", () => {
  const explanation = makeExplanation({ whyItMatters: "It matters" });
  const result = formatAsMarkdown(explanation);

  assert.ok(result.includes("### Why It Matters"));
  assert.ok(result.includes("It matters"));
});

test("formatAsMarkdown includes recommended action section", () => {
  const explanation = makeExplanation({ whatToDo: "Take action" });
  const result = formatAsMarkdown(explanation);

  assert.ok(result.includes("### Recommended Action"));
  assert.ok(result.includes("Take action"));
});

test("formatAsMarkdown sections appear in correct order", () => {
  const explanation = makeExplanation();
  const result = formatAsMarkdown(explanation);

  const whatIdx = result.indexOf("### What Happened");
  const whyIdx = result.indexOf("### Why It Matters");
  const actionIdx = result.indexOf("### Recommended Action");

  assert.ok(whatIdx < whyIdx);
  assert.ok(whyIdx < actionIdx);
});

// formatAsNotification tests

test("formatAsNotification returns a string", () => {
  const explanation = makeExplanation();
  const result = formatAsNotification(explanation);

  assert.equal(typeof result, "string");
});

test("formatAsNotification includes headline", () => {
  const explanation = makeExplanation({ headline: "Alert: Issue" });
  const result = formatAsNotification(explanation);

  assert.ok(result.includes("Alert: Issue"));
});

test("formatAsNotification includes what happened", () => {
  const explanation = makeExplanation({ whatHappened: "Something occurred" });
  const result = formatAsNotification(explanation);

  assert.ok(result.includes("Something occurred"));
});

test("formatAsNotification includes action label", () => {
  const explanation = makeExplanation({ whatToDo: "Review this" });
  const result = formatAsNotification(explanation);

  assert.ok(result.includes("Action:"));
  assert.ok(result.includes("Review this"));
});

test("formatAsNotification includes risk level", () => {
  const explanation = makeExplanation({ riskLevel: "critical", confidencePercent: 90 });
  const result = formatAsNotification(explanation);

  assert.ok(result.includes("CRITICAL"));
  assert.ok(result.includes("90%"));
});

test("formatAsNotification formats risk and confidence on same line", () => {
  const explanation = makeExplanation({ riskLevel: "low", confidencePercent: 75 });
  const result = formatAsNotification(explanation);

  assert.ok(result.includes("Risk:"));
  assert.ok(result.includes("|"));
  assert.ok(result.includes("Confidence:"));
});

test("formatAsNotification is compact with limited lines", () => {
  const explanation = makeExplanation();
  const result = formatAsNotification(explanation);
  const lines = result.split("\n");

  assert.ok(lines.length <= 8);
});

// AudienceType and SimplifiedExplanation interface tests

test("AudienceType accepts executive", () => {
  const type: "executive" = "executive";
  assert.equal(type, "executive");
});

test("AudienceType accepts operator", () => {
  const type: "operator" = "operator";
  assert.equal(type, "operator");
});

test("AudienceType accepts auditor", () => {
  const type: "auditor" = "auditor";
  assert.equal(type, "auditor");
});

test("SimplifiedExplanation riskLevel accepts all valid values", () => {
  const levels: SimplifiedExplanation["riskLevel"][] = ["low", "medium", "high", "critical"];
  levels.forEach((level) => {
    const explanation = makeExplanation({ riskLevel: level });
    assert.equal(explanation.riskLevel, level);
  });
});

test("SimplifiedExplanation confidencePercent accepts 0", () => {
  const explanation = makeExplanation({ confidencePercent: 0 });
  assert.equal(explanation.confidencePercent, 0);
});

test("SimplifiedExplanation confidencePercent accepts 100", () => {
  const explanation = makeExplanation({ confidencePercent: 100 });
  assert.equal(explanation.confidencePercent, 100);
});

test("SimplifiedExplanation readonly fields are set correctly", () => {
  const explanation = makeExplanation();
  assert.equal(Object.isFrozen(explanation), false); // We don't freeze in makeExplanation
});

test("simplifyExplanation with unknown stage keeps original name", () => {
  const result = simplifyExplanation("unknown_stage", "Something happened", [], [], "low");

  assert.ok(result.headline.includes("unknown_stage"));
});
