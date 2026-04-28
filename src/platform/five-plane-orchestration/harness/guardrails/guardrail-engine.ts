import type { HarnessToolbelt } from "../toolbelt-assembler.js";

export type GuardrailSeverity = "info" | "warn" | "block";

export interface GuardrailFinding {
  readonly layer:
    | "input"
    | "planning"
    | "tool"
    | "memory"
    | "output"
    | "policy"
    | "risk"
    | "evidence"
    | "budget";
  readonly severity: GuardrailSeverity;
  readonly code: string;
  readonly message: string;
}

export interface GuardrailAssessment {
  readonly passed: boolean;
  readonly requiresHuman: boolean;
  readonly suggestedAction: "proceed" | "retry_same_plan" | "escalate_to_human" | "abort";
  readonly findings: readonly GuardrailFinding[];
}

export interface GuardrailAssessmentInput {
  readonly toolbelt: HarnessToolbelt;
  readonly evidenceRefs: readonly string[];
  readonly riskScore: number;
  readonly maxRiskScore: number;
  readonly escalationThreshold: number;
  readonly currentStepCount: number;
  readonly maxSteps: number;
  /** Raw input prompt to check for injection attacks */
  readonly inputPrompt?: string;
  /** Memory access pattern to check for self-enhancement risks */
  readonly memoryAccessPattern?: readonly string[];
}

export class GuardrailEngine {
  public assess(input: GuardrailAssessmentInput): GuardrailAssessment {
    const findings: GuardrailFinding[] = [];

    // Input layer: prompt injection defense
    if (input.inputPrompt) {
      const injectionPatterns = [
        /__import__\s*\(/,
        /<script[^>]*>/i,
        /javascript:/i,
        /data:text\/html/i,
        /\$\{.*\}/,
      ];
      for (const pattern of injectionPatterns) {
        if (pattern.test(input.inputPrompt)) {
          findings.push({
            layer: "input",
            severity: "block",
            code: "harness.guardrail.prompt_injection_detected",
            message: "Potential prompt injection detected in input",
          });
          break;
        }
      }
    }

    if (input.toolbelt.blockedTools.length > 0) {
      findings.push({
        layer: "tool",
        severity: "block",
        code: "harness.guardrail.blocked_tool_requested",
        message: `Blocked tools requested: ${input.toolbelt.blockedTools.join(", ")}`,
      });
    }

    for (const evidenceRef of input.toolbelt.requiredEvidence) {
      if (!input.evidenceRefs.includes(evidenceRef)) {
        findings.push({
          layer: "evidence",
          severity: "warn",
          code: "harness.guardrail.required_evidence_missing",
          message: `Missing required evidence: ${evidenceRef}`,
        });
      }
    }

    if (input.riskScore > input.maxRiskScore) {
      findings.push({
        layer: "risk",
        severity: "block",
        code: "harness.guardrail.max_risk_exceeded",
        message: `Risk score ${input.riskScore} exceeds max ${input.maxRiskScore}`,
      });
    } else if (input.riskScore >= input.escalationThreshold) {
      findings.push({
        layer: "risk",
        severity: "warn",
        code: "harness.guardrail.risk_requires_human",
        message: `Risk score ${input.riskScore} reached escalation threshold ${input.escalationThreshold}`,
      });
    }

    if (input.currentStepCount >= input.maxSteps) {
      findings.push({
        layer: "budget",
        severity: "block",
        code: "harness.guardrail.step_budget_exhausted",
        message: `Step budget exhausted at ${input.currentStepCount}/${input.maxSteps}`,
      });
    }

    // Memory layer: anti-self-enhancement safeguard
    if (input.memoryAccessPattern && input.memoryAccessPattern.length > 0) {
      const selfEnhancementIndicators = [
        "modify_own_prompt",
        "update_own_instructions",
        "change_own_role",
        "escalate_own_permissions",
      ];
      const accessedKeys = new Set(input.memoryAccessPattern);
      for (const indicator of selfEnhancementIndicators) {
        if (accessedKeys.has(indicator)) {
          findings.push({
            layer: "memory",
            severity: "block",
            code: "harness.guardrail.self_enhancement_detected",
            message: "Potential self-enhancement attempt detected in memory access",
          });
          break;
        }
      }
    }

    const hasBlocker = findings.some((finding) => finding.severity === "block");
    const requiresHuman = findings.some((finding) =>
      finding.severity === "warn" && (finding.layer === "risk" || finding.layer === "evidence")
    );

    return {
      passed: !hasBlocker,
      requiresHuman,
      suggestedAction: hasBlocker
        ? "abort"
        : requiresHuman
          ? "escalate_to_human"
          : "proceed",
      findings,
    };
  }
}
