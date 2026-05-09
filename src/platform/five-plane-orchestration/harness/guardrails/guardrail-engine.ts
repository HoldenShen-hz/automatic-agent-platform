import type { HarnessToolbelt } from "../toolbelt-assembler.js";

export type GuardrailSeverity = "info" | "warn" | "block";

export interface GuardrailFinding {
  readonly layer:
    // R3-1 fix: Add explicit Input and Memory guardrail layers
    | "input"
    | "memory"
    | "planning"
    | "tool"
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
  readonly suggestedAction: "proceed" | "escalate_to_human" | "abort" | "retry_same_plan";
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
  /** Generated plan/strategy to check for planning-layer risks */
  readonly planningOutput?: string;
  /** Generated output/response to check for output-layer risks */
  readonly generatedOutput?: string;
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

    // Planning layer: check generated plan for dangerous instructions or goal injection
    if (input.planningOutput) {
      const planningRiskPatterns = [
        /ignore.*(safety|guardrail|policy)/i,
        /disable.*(safety|guardrail|policy)/i,
        /override.*(safety|guardrail|policy)/i,
        /bypass.*(safety|guardrail|policy)/i,
        /set.*role.*to.*admin/i,
        /grant.*admin.*privileges/i,
        /escalate.*(own)?.*permissions/i,
      ];
      for (const pattern of planningRiskPatterns) {
        if (pattern.test(input.planningOutput)) {
          findings.push({
            layer: "planning",
            severity: "block",
            code: "harness.guardrail.planning_policy_violation",
            message: "Generated plan contains potential policy-violating instructions",
          });
          break;
        }
      }
    }

    // Output layer: check generated output for sensitive data leakage or injection
    if (input.generatedOutput) {
      const outputRiskPatterns = [
        /(password|secret|token|api[_-]?key).*[:=]\s*\S+/i,
        /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
        /sk-[a-zA-Z0-9]{20,}/, // OpenAI API key pattern
      ];
      for (const pattern of outputRiskPatterns) {
        if (pattern.test(input.generatedOutput)) {
          findings.push({
            layer: "output",
            severity: "warn",
            code: "harness.guardrail.output_sensitive_data",
            message: "Generated output may contain sensitive data patterns",
          });
          break;
        }
      }
    }

    const hasBlocker = findings.some((finding) => finding.severity === "block");
    const hasRiskWarning = findings.some((finding) => finding.severity === "warn" && finding.layer === "risk");
    const hasRetryableWarning = findings.some((finding) => finding.severity === "warn" && finding.layer === "evidence");
    const hasRetryableFinding = findings.some((finding) => finding.code === "harness.guardrail.required_evidence_missing");
    const requiresHuman = hasRiskWarning;

    // R9-28 fix: GuardrailEngine can return retry_same_plan action when:
    // - No blockers (passed=true)
    // - Only retryable warnings (evidence missing)
    // - No human-required risk warnings
    // This allows LoopController to retry the same plan without escalation
    const canRetrySamePlan = !hasBlocker && hasRetryableFinding && !requiresHuman;

    return {
      passed: !hasBlocker,
      requiresHuman,
      suggestedAction: hasBlocker
        ? "abort"
        : canRetrySamePlan
          ? "retry_same_plan"
          : requiresHuman
            ? "escalate_to_human"
            : "proceed",
      findings,
    };
  }
}
