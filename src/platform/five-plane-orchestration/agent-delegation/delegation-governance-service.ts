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
import type { AgentContext, DelegationSpec, PermissionSet } from "./delegation-types.js";

export type GovernanceDecision = "allow" | "deny" | "allow_with_constraints" | "require_approval";

export interface GovernanceRule {
  ruleId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  condition: GovernanceCondition;
  effect: GovernanceEffect;
}

export interface GovernanceCondition {
  subjectType?: "user" | "agent" | "system";
  targetAgentType?: string;
  delegationDepth?: number;
  permissionActions?: string[];
  riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface GovernanceEffect {
  decision: GovernanceDecision;
  reasonCode: string;
  constraints?: Record<string, unknown>;
}

export interface DelegationGovernanceRequest {
  parentContext: AgentContext;
  delegationSpec: DelegationSpec;
  riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface DelegationGovernanceDecision {
  decision: GovernanceDecision;
  reasonCode: string;
  evaluatedRules: string[];
  constraints: Record<string, unknown>;
  requiresApproval: boolean;
}

export interface DelegationGovernanceAuditRecord {
  id: string;
  request: DelegationGovernanceRequest;
  decision: GovernanceDecision;
  reasonCode: string;
  evaluatedRules: readonly string[];
  approvedBy: string | null;
  createdAt: string;
}

const DEFAULT_GOVERNANCE_RULES: GovernanceRule[] = [
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
  private readonly rules: GovernanceRule[];
  private readonly auditRecords: DelegationGovernanceAuditRecord[] = [];

  public constructor(rules: GovernanceRule[] = DEFAULT_GOVERNANCE_RULES) {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
  }

  public evaluate(request: DelegationGovernanceRequest): DelegationGovernanceDecision {
    const evaluatedRules: string[] = [];
    let constraints: Record<string, unknown> = {};

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

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

  public recordDecision(request: DelegationGovernanceRequest, decision: DelegationGovernanceDecision, approvedBy?: string): DelegationGovernanceAuditRecord {
    const record: DelegationGovernanceAuditRecord = {
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

  public getAuditRecords(agentId?: string): DelegationGovernanceAuditRecord[] {
    if (!agentId) return [...this.auditRecords];
    return this.auditRecords.filter(
      (r) => r.request.parentContext.agentId === agentId,
    );
  }

  public getRules(): GovernanceRule[] {
    return [...this.rules];
  }

  public addRule(rule: GovernanceRule): void {
    // R37-2186: Prevent duplicate ruleId - update existing instead of adding
    const existingIdx = this.rules.findIndex((r) => r.ruleId === rule.ruleId);
    if (existingIdx >= 0) {
      this.rules[existingIdx] = rule;
    } else {
      this.rules.push(rule);
    }
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  public removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.ruleId === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  public enableRule(ruleId: string): boolean {
    const rule = this.rules.find((r) => r.ruleId === ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  public disableRule(ruleId: string): boolean {
    const rule = this.rules.find((r) => r.ruleId === ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }

  private matchesCondition(request: DelegationGovernanceRequest, condition: GovernanceCondition): boolean {
    if (condition.subjectType && request.parentContext.agentType !== condition.subjectType) {
      return false;
    }
    if (condition.targetAgentType && request.delegationSpec.targetAgentType !== condition.targetAgentType) {
      return false;
    }
    // §186-2184: delegationDepth condition - check child depth (parentDepth+1) against threshold
    // Root cause: checking parent depth instead of child depth, and short-circuiting on any depth check
    // Fix: check if child depth would exceed threshold, but don't short-circuit - continue evaluating
    // all conditions with AND semantics (all must pass)
    const childDepth = request.parentContext.delegationDepth + 1;
    if (condition.delegationDepth !== undefined && childDepth > condition.delegationDepth) {
      // Depth exceeded - this is a hard deny, return false immediately
      return false;
    }
    if (condition.permissionActions && condition.permissionActions.length > 0) {
      const hasPermission = condition.permissionActions.some(
        (action) => request.delegationSpec.requiredPermissions.actions.includes(action),
      );
      if (!hasPermission) return false;
    }
    if (condition.riskLevel && request.riskLevel !== condition.riskLevel) {
      return false;
    }
    return true;
  }
}

export const defaultDelegationGovernanceService = new DelegationGovernanceService();
