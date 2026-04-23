function isParentConstraintPreserved(childConstraints, parentConstraints) {
    return Object.entries(parentConstraints).every(([key, value]) => {
        if (!(key in childConstraints)) {
            return false;
        }
        return JSON.stringify(childConstraints[key]) === JSON.stringify(value);
    });
}
export class ACPInvariantEnforcer {
    checkPermissionSubset(child, parent) {
        const resourcesOk = child.resources.every((resource) => parent.resources.includes(resource));
        const actionsOk = child.actions.every((action) => parent.actions.includes(action));
        return resourcesOk && actionsOk;
    }
    checkRiskNotEscalated(childRisk, parentRisk) {
        return childRisk <= parentRisk;
    }
    checkConstraintNotRelaxed(childConstraints, parentConstraints) {
        return isParentConstraintPreserved(childConstraints, parentConstraints);
    }
    checkCompletionHasEvidence(message) {
        if (message.messageType !== "completion_report") {
            return true;
        }
        const evidence = message.payload.evidence;
        return Array.isArray(evidence) && evidence.length > 0;
    }
    checkTakeoverAudit(message) {
        if (message.messageType !== "takeover_notice") {
            return true;
        }
        return typeof message.payload.audit_trail_ref === "string" && message.payload.audit_trail_ref.length > 0;
    }
    checkBudgetNotExceeded(childBudget, parentBudget) {
        return childBudget <= parentBudget;
    }
    checkDepthLimit(depth, maxDepth) {
        return depth <= maxDepth;
    }
    enforceAll(message, context) {
        const childPermissions = message.payload.permissions;
        const childConstraints = message.payload.constraints;
        const violations = [];
        if (childPermissions && !this.checkPermissionSubset(childPermissions, context.parentPermissions)) {
            violations.push("acp.permission_not_subset");
        }
        if (!this.checkRiskNotEscalated(message.risk_level, context.parentRiskMode)) {
            violations.push("acp.risk_escalated");
        }
        if (childConstraints !== undefined && !this.checkConstraintNotRelaxed(childConstraints, context.parentConstraints)) {
            violations.push("acp.constraints_relaxed");
        }
        if (!this.checkCompletionHasEvidence(message)) {
            violations.push("acp.completion_missing_evidence");
        }
        if (!this.checkTakeoverAudit(message)) {
            violations.push("acp.takeover_missing_audit");
        }
        if (!this.checkBudgetNotExceeded(message.budget_remaining, context.parentBudgetRemaining)) {
            violations.push("acp.budget_exceeded");
        }
        if (!this.checkDepthLimit(message.depth, context.globalCallDepth)) {
            violations.push("acp.depth_exceeded");
        }
        return {
            passed: violations.length === 0,
            violations,
        };
    }
}
//# sourceMappingURL=invariant-enforcer.js.map