export class EscalationService {
    decide(input) {
        if (input.riskLevel === "critical" && input.affectsProduction) {
            return {
                decision: "panic_stop",
                reasonCode: "escalation.critical_prod_stop",
                requiresOperatorAction: true,
            };
        }
        if (input.riskLevel === "critical" || (input.riskLevel === "high" && input.stage === "execute")) {
            return {
                decision: "takeover",
                reasonCode: "escalation.human_takeover_required",
                requiresOperatorAction: true,
            };
        }
        if (input.affectsProduction || (input.estimatedCostUsd ?? 0) >= 10 || input.riskLevel === "high") {
            return {
                decision: "approval",
                reasonCode: "escalation.approval_required",
                requiresOperatorAction: true,
            };
        }
        return {
            decision: "none",
            reasonCode: "escalation.not_required",
            requiresOperatorAction: false,
        };
    }
}
//# sourceMappingURL=index.js.map