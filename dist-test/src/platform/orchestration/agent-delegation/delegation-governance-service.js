/**
 * Delegation Governance Service
 *
 * Implements governance rules for agent delegation:
 * - Delegation authorization based on policies
 * - Permission boundary enforcement
 * - Delegation audit trail
 *
 * Architecture: §51 Delegation Governance
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
const DEFAULT_GOVERNANCE_RULES = [
    {
        ruleId: "max_depth",
        name: "Maximum Delegation Depth",
        description: "Prevents delegation chains deeper than 5 levels",
        enabled: true,
        priority: 10,
        condition: { delegationDepth: 5 },
        effect: { decision: "deny", reasonCode: "delegation.max_depth_exceeded" },
    },
    {
        ruleId: "system_agent_restricted",
        name: "System Agent Restrictions",
        description: "System agents cannot delegate to external agents",
        enabled: true,
        priority: 20,
        condition: { subjectType: "system" },
        effect: { decision: "deny", reasonCode: "delegation.system_agent_restricted" },
    },
    {
        ruleId: "high_risk_requires_approval",
        name: "High Risk Delegation Approval",
        description: "High risk delegations require human approval",
        enabled: true,
        priority: 30,
        condition: { riskLevel: "high" },
        effect: { decision: "require_approval", reasonCode: "delegation.high_risk_requires_approval" },
    },
    {
        ruleId: "critical_risk_denied",
        name: "Critical Risk Delegation Denied",
        description: "Critical risk delegations are always denied",
        enabled: true,
        priority: 5,
        condition: { riskLevel: "critical" },
        effect: { decision: "deny", reasonCode: "delegation.critical_risk_denied" },
    },
    {
        ruleId: "allow_default",
        name: "Default Allow",
        description: "Default policy to allow delegation",
        enabled: true,
        priority: 100,
        condition: {},
        effect: { decision: "allow", reasonCode: "delegation.allowed" },
    },
];
export class DelegationGovernanceService {
    rules;
    auditRecords = [];
    constructor(rules = DEFAULT_GOVERNANCE_RULES) {
        this.rules = [...rules].sort((a, b) => a.priority - b.priority);
    }
    evaluate(request) {
        const evaluatedRules = [];
        let constraints = {};
        for (const rule of this.rules) {
            if (!rule.enabled)
                continue;
            if (this.matchesCondition(request, rule.condition)) {
                evaluatedRules.push(rule.ruleId);
                if (rule.effect.decision === "deny") {
                    return {
                        decision: "deny",
                        reasonCode: rule.effect.reasonCode,
                        evaluatedRules,
                        constraints: {},
                        requiresApproval: false,
                    };
                }
                if (rule.effect.decision === "require_approval") {
                    return {
                        decision: "require_approval",
                        reasonCode: rule.effect.reasonCode,
                        evaluatedRules,
                        constraints: rule.effect.constraints ?? {},
                        requiresApproval: true,
                    };
                }
                if (rule.effect.decision === "allow_with_constraints" && rule.effect.constraints) {
                    constraints = { ...constraints, ...rule.effect.constraints };
                }
            }
        }
        return {
            decision: "allow",
            reasonCode: "delegation.allowed",
            evaluatedRules,
            constraints,
            requiresApproval: false,
        };
    }
    recordDecision(request, decision, approvedBy) {
        const record = {
            id: newId("dlg_gov"),
            request,
            decision: decision.decision,
            reasonCode: decision.reasonCode,
            evaluatedRules: decision.evaluatedRules,
            approvedBy: approvedBy ?? null,
            createdAt: nowIso(),
        };
        this.auditRecords.push(record);
        return record;
    }
    getAuditRecords(agentId) {
        if (!agentId)
            return [...this.auditRecords];
        return this.auditRecords.filter((r) => r.request.parentContext.agentId === agentId);
    }
    getRules() {
        return [...this.rules];
    }
    addRule(rule) {
        this.rules.push(rule);
        this.rules.sort((a, b) => a.priority - b.priority);
    }
    removeRule(ruleId) {
        const index = this.rules.findIndex((r) => r.ruleId === ruleId);
        if (index >= 0) {
            this.rules.splice(index, 1);
            return true;
        }
        return false;
    }
    enableRule(ruleId) {
        const rule = this.rules.find((r) => r.ruleId === ruleId);
        if (rule) {
            rule.enabled = true;
            return true;
        }
        return false;
    }
    disableRule(ruleId) {
        const rule = this.rules.find((r) => r.ruleId === ruleId);
        if (rule) {
            rule.enabled = false;
            return true;
        }
        return false;
    }
    matchesCondition(request, condition) {
        if (condition.subjectType && request.parentContext.agentType !== condition.subjectType) {
            return false;
        }
        if (condition.targetAgentType && request.delegationSpec.targetAgentType !== condition.targetAgentType) {
            return false;
        }
        if (condition.delegationDepth !== undefined) {
            if (request.parentContext.delegationDepth >= condition.delegationDepth) {
                return true;
            }
            return false;
        }
        if (condition.permissionActions && condition.permissionActions.length > 0) {
            const hasPermission = condition.permissionActions.some((action) => request.delegationSpec.requiredPermissions.actions.includes(action));
            if (!hasPermission)
                return false;
        }
        if (condition.riskLevel && request.riskLevel !== condition.riskLevel) {
            return false;
        }
        return true;
    }
}
export const defaultDelegationGovernanceService = new DelegationGovernanceService();
//# sourceMappingURL=delegation-governance-service.js.map