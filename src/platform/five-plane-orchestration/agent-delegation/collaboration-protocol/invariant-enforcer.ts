import type { PermissionSet } from "../delegation-types.js";
import type { ACPMessage } from "./types.js";

export interface InvariantContext {
  readonly parentPermissions: PermissionSet;
  readonly parentRiskMode: number;
  readonly parentConstraints: Record<string, unknown>;
  readonly parentBudgetRemaining: number;
  readonly globalCallDepth: number;
}

function isParentConstraintPreserved(childConstraints: Record<string, unknown>, parentConstraints: Record<string, unknown>): boolean {
  return Object.entries(parentConstraints).every(([key, value]) => {
    if (!(key in childConstraints)) {
      return false;
    }
    return JSON.stringify(childConstraints[key]) === JSON.stringify(value);
  });
}

export class ACPInvariantEnforcer {
  public checkPermissionSubset(child: PermissionSet, parent: PermissionSet): boolean {
    const resourcesOk = child.resources.every((resource) => parent.resources.includes(resource));
    const actionsOk = child.actions.every((action) => parent.actions.includes(action));
    return resourcesOk && actionsOk;
  }

  public checkRiskNotEscalated(childRisk: number, parentRisk: number): boolean {
    return childRisk <= parentRisk;
  }

  public checkConstraintNotRelaxed(childConstraints: Record<string, unknown>, parentConstraints: Record<string, unknown>): boolean {
    return isParentConstraintPreserved(childConstraints, parentConstraints);
  }

  public checkCompletionHasEvidence(message: ACPMessage): boolean {
    if (message.messageType !== "completion_report") {
      return true;
    }
    const evidence = message.payload.evidence;
    return Array.isArray(evidence) && evidence.length > 0;
  }

  public checkTakeoverAudit(message: ACPMessage): boolean {
    if (message.messageType !== "takeover_notice") {
      return true;
    }
    return typeof message.payload.audit_trail_ref === "string" && message.payload.audit_trail_ref.length > 0;
  }

  public checkBudgetNotExceeded(childBudget: number, parentBudget: number): boolean {
    return childBudget <= parentBudget;
  }

  public checkDepthLimit(depth: number, maxDepth: number): boolean {
    return depth <= maxDepth;
  }

  public enforceAll(message: ACPMessage, context: InvariantContext): { passed: boolean; violations: string[] } {
    const childPermissions = message.payload.permissions as PermissionSet | undefined;
    const childConstraints = message.payload.constraints as Record<string, unknown> | undefined;
    const violations: string[] = [];

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
