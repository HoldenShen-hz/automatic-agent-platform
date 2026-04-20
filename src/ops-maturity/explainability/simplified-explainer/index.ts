/**
 * @fileoverview Simplified Explainer for Non-Technical Users
 *
 * Transforms complex technical explanations into simple, jargon-free language
 * that business stakeholders can understand.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §62 (可解释性增强)
 */

import type { CausalLink } from "../causal-chain-builder/index.js";

/**
 * Audience type for explanation tailoring.
 */
export type AudienceType = "executive" | "operator" | "auditor";

/**
 * Simplified explanation output.
 */
export interface SimplifiedExplanation {
  readonly headline: string;
  readonly whatHappened: string;
  readonly whyItMatters: string;
  readonly whatToDo: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly confidencePercent: number;
}

/**
 * Maps technical risk levels to business-friendly language.
 */
const RISK_MAPPING: Record<string, { level: SimplifiedExplanation["riskLevel"]; icon: string }> = {
  low: { level: "low", icon: "✓" },
  medium: { level: "medium", icon: "⚠" },
  high: { level: "high", icon: "⚠" },
  critical: { level: "critical", icon: "🚨" },
  unknown: { level: "medium", icon: "?" },
};

/**
 * Simplifies a technical stage explanation for business audiences.
 */
export function simplifyExplanation(
  stageName: string,
  summary: string,
  decisionFactors: readonly string[],
  causalLinks: readonly CausalLink[],
  riskLevel: string = "medium",
): SimplifiedExplanation {
  const riskInfo = RISK_MAPPING[riskLevel.toLowerCase()] ?? RISK_MAPPING.unknown;

  // Generate headline from stage and summary
  const headline = generateHeadline(stageName, summary, riskInfo.icon);

  // Simplify technical terms in what happened
  const whatHappened = simplifyWhatHappened(summary, decisionFactors);

  // Explain why it matters in business terms
  const whyItMatters = simplifyWhyItMatters(decisionFactors, causalLinks);

  // Generate recommended action
  const whatToDo = generateRecommendedAction(stageName, riskLevel);

  // Estimate confidence (based on having sufficient evidence)
  const confidencePercent = calculateConfidence(decisionFactors, causalLinks);

  return {
    headline,
    whatHappened,
    whyItMatters,
    whatToDo,
    riskLevel: riskInfo.level,
    confidencePercent,
  };
}

/**
 * Maps technical stage names to business-friendly terms.
 */
const STAGE_TERMS: Record<string, string> = {
  observe: "Data Collection",
  assess: "Analysis",
  plan: "Planning",
  execute: "Execution",
  feedback: "Review",
  learn: "Learning",
  improve: "Improvement",
  recover: "Recovery",
  decision: "Decision",
  approval: "Approval Required",
  execution: "Running Task",
  completed: "Completed",
  failed: "Failed",
};

/**
 * Maps technical jargon to simple language.
 */
const JARGON_MAP: Record<string, string> = {
  // Technical -> Simple
  "workflow": "process",
  "task": "job",
  "execution": "running",
  "deployment": "release",
  "orchestration": "coordination",
  "provisioning": "setup",
  "degradation": "reduced service",
  "fallback": "backup plan",
  "retry": "try again",
  "circuit_breaker": "safety switch",
  "deadlock": "stuck waiting",
  "timeout": "took too long",
  "latency": "delay",
  "throughput": "speed",
  "reliability": "uptime",
  "availability": "accessibility",
  "incident": "issue",
  "escalation": "getting help",
  "principal": "user account",
  "tenant": "organization",
};

/**
 * Generates a concise headline for the explanation.
 */
function generateHeadline(stageName: string, summary: string, icon: string): string {
  const friendlyStage = STAGE_TERMS[stageName.toLowerCase()] ?? stageName;
  // Truncate summary if too long
  const truncatedSummary = summary.length > 100 ? `${summary.slice(0, 97)}...` : summary;
  return `${icon} [${friendlyStage}] ${truncatedSummary}`;
}

/**
 * Simplifies technical summary into plain language.
 */
function simplifyWhatHappened(summary: string, factors: readonly string[]): string {
  let simplified = simplifyText(summary);

  // If we have decision factors, summarize them simply
  if (factors.length > 0) {
    const simpleFactors = factors.slice(0, 3).map((f) => simplifyText(f));
    if (factors.length > 3) {
      simplified += ` Key considerations: ${simpleFactors.join("; ")} and ${factors.length - 3} more factors.`;
    } else {
      simplified += ` Key considerations: ${simpleFactors.join("; ")}.`;
    }
  }

  return simplified;
}

/**
 * Converts technical explanation into business impact language.
 */
function simplifyWhyItMatters(
  factors: readonly string[],
  _causalLinks: readonly CausalLink[],
): string {
  if (factors.length === 0) {
    return "This action was evaluated based on system rules and completed normally.";
  }

  // Identify potential impacts from factors
  const impactKeywords = ["cost", "risk", "time", "quality", "performance", "security", "compliance"];
  const relevantFactors = factors.filter((f) =>
    impactKeywords.some((kw) => f.toLowerCase().includes(kw)),
  );

  if (relevantFactors.length === 0) {
    return "This affects system performance and may impact operational efficiency.";
  }

  // Map to business impacts
  const impacts = relevantFactors.slice(0, 2).map((f) => {
    const lower = f.toLowerCase();
    if (lower.includes("cost")) return "may affect costs";
    if (lower.includes("risk")) return "involves some level of risk";
    if (lower.includes("time") || lower.includes("delay")) return "may cause delays";
    if (lower.includes("security") || lower.includes("compliance")) return "has compliance implications";
    return simplifyText(f);
  });

  return `This matters because it ${impacts.join(" and ")}.`;
}

/**
 * Generates a recommended action based on stage and risk.
 */
function generateRecommendedAction(stageName: string, riskLevel: string): string {
  const lowerStage = stageName.toLowerCase();

  if (lowerStage.includes("approval") || lowerStage.includes("review")) {
    return "Your review is required before this action can proceed. Please evaluate and approve or reject.";
  }

  if (lowerStage.includes("failed") || riskLevel.toLowerCase() === "critical") {
    return "Immediate attention needed. Please investigate and take corrective action.";
  }

  if (lowerStage.includes("completed") || lowerStage.includes("success")) {
    return "No action required. This completed successfully.";
  }

  if (lowerStage.includes("observe") || lowerStage.includes("assess")) {
    return "Monitor the situation. Take action only if you notice unusual behavior.";
  }

  return "This is for your information. No immediate action is required.";
}

/**
 * Calculates confidence based on available information.
 */
function calculateConfidence(factors: readonly string[], causalLinks: readonly CausalLink[]): number {
  let confidence = 50; // Base confidence

  // More factors = higher confidence
  confidence += Math.min(factors.length * 5, 25);

  // Causal links provide additional confidence
  confidence += Math.min(causalLinks.length * 5, 25);

  return Math.min(Math.max(confidence, 0), 100);
}

/**
 * Replaces technical jargon with simple language.
 */
function simplifyText(text: string): string {
  let simplified = text;

  for (const [jargon, simple] of Object.entries(JARGON_MAP)) {
    simplified = simplified.replace(new RegExp(jargon, "gi"), simple);
  }

  // Remove excessive technical detail markers
  simplified = simplified.replace(/\([^)]*\d+[^)]*\)/g, ""); // Remove things like (count=5)

  // Clean up multiple spaces
  simplified = simplified.replace(/\s+/g, " ").trim();

  return simplified;
}

/**
 * Formats simplified explanation as markdown for display.
 */
export function formatAsMarkdown(explanation: SimplifiedExplanation): string {
  const lines: string[] = [];
  lines.push(`## ${explanation.headline}`);
  lines.push("");
  lines.push(`**Risk Level:** ${explanation.riskLevel.toUpperCase()} (${explanation.confidencePercent}% confidence)`);
  lines.push("");
  lines.push("### What Happened");
  lines.push(explanation.whatHappened);
  lines.push("");
  lines.push("### Why It Matters");
  lines.push(explanation.whyItMatters);
  lines.push("");
  lines.push("### Recommended Action");
  lines.push(explanation.whatToDo);
  lines.push("");

  return lines.join("\n");
}

/**
 * Formats simplified explanation as plain text for notifications.
 */
export function formatAsNotification(explanation: SimplifiedExplanation): string {
  return [
    explanation.headline,
    "",
    explanation.whatHappened,
    "",
    `Action: ${explanation.whatToDo}`,
    "",
    `Risk: ${explanation.riskLevel.toUpperCase()} | Confidence: ${explanation.confidencePercent}%`,
  ].join("\n");
}
