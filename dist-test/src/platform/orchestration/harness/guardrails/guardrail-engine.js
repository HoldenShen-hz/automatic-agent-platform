export class GuardrailEngine {
    assess(input) {
        const findings = [];
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
        }
        else if (input.riskScore >= input.escalationThreshold) {
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
        const hasBlocker = findings.some((finding) => finding.severity === "block");
        const requiresHuman = findings.some((finding) => finding.severity === "warn" && (finding.layer === "risk" || finding.layer === "evidence"));
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
//# sourceMappingURL=guardrail-engine.js.map