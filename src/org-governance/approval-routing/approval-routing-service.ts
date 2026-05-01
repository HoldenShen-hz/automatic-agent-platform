import { buildGovernanceAuditRecord, type GovernanceAuditRecord } from "../compliance-engine/audit-enforcer/index.js";
import { type ApprovalDelegation, resolveDelegatedApprover } from "./delegation/index.js";
import { type ApprovalEscalationRule, shouldEscalateApproval } from "./escalation/index.js";
import {
  resolveApprovalRoute,
  type AmountThresholdRule,
  type ApprovalRouteDecision,
  type ApprovalRouteRequest,
} from "./route-engine/index.js";
import type { OrgNode } from "../org-model/org-node/index.js";

export interface ApprovalRoutingResult extends ApprovalRouteDecision {
  readonly escalatedTo: string | null;
  readonly auditRecord: GovernanceAuditRecord;
}

export type ApprovalChainMode = "sequential" | "parallel" | "conditional";

export interface ApprovalChainStep {
  readonly stepId: string;
  readonly approverIds: readonly string[];
  readonly mode: ApprovalChainMode;
  readonly deadlineAt: string | null;
  readonly escalationTarget: string | null;
  readonly reasonCodes: readonly string[];
}

export interface ApprovalChainPlan {
  readonly chainMode: ApprovalChainMode;
  readonly matchedOrgNodeId: string;
  readonly steps: readonly ApprovalChainStep[];
}

export interface ApprovalChainOptions {
  readonly chainMode?: ApprovalChainMode;
  readonly timeoutMinutes?: number;
  readonly conditionalApproverIds?: readonly string[];
}

export interface ApprovalRoutingServiceOptions {
  readonly orgNodes: readonly OrgNode[];
  readonly delegations?: readonly ApprovalDelegation[];
  readonly escalationRules?: readonly ApprovalEscalationRule[];
  readonly amountThresholdRules?: readonly AmountThresholdRule[];
}

export class ApprovalRoutingService {
  private readonly orgNodes: readonly OrgNode[];
  private readonly delegations: readonly ApprovalDelegation[];
  private readonly escalationRules: readonly ApprovalEscalationRule[];
  private readonly amountThresholdRules: readonly AmountThresholdRule[];

  public constructor(options: ApprovalRoutingServiceOptions) {
    this.orgNodes = options.orgNodes;
    this.delegations = options.delegations ?? [];
    this.escalationRules = options.escalationRules ?? [];
    this.amountThresholdRules = options.amountThresholdRules ?? [];
  }

  public route(request: ApprovalRouteRequest, createdAtIso: string, nowIso: string): ApprovalRoutingResult {
    const delegationMap = this.buildDelegationMap(request.orgNodeId, nowIso);
    const base = resolveApprovalRoute(this.orgNodes, request, delegationMap, this.amountThresholdRules);
    const escalation = this.resolveEscalation(createdAtIso, nowIso, request.riskLevel);
    // SECURITY FIX: In sequential mode, prepend escalated approver so they approve BEFORE chain
    // Previously appended to end, causing escalated approver to approve last in sequential chain
    const approverChain = escalation != null && !base.approverChain.includes(escalation)
      ? [escalation, ...base.approverChain]
      : [...base.approverChain];

    return {
      matchedOrgNodeId: base.matchedOrgNodeId,
      approverChain,
      delegated: base.delegated,
      routingStrategy: base.routingStrategy,
      approvalSteps: base.approvalSteps,
      routeSnapshot: {
        ...base.routeSnapshot,
        approverIds: approverChain,
      },
      escalatedTo: escalation,
      auditRecord: buildGovernanceAuditRecord({
        // R34-36 FIX #1979: Use crypto.randomUUID() for guaranteed uniqueness.
        // Date.now() only has ms precision; same requester+node within 1ms collides.
        // Math.random() alone is not cryptographically random enough for audit IDs.
        recordId: `audit_${request.requesterId}_${request.orgNodeId}_${Date.now()}_${crypto.randomUUID()}`,
        action: "approval.route",
        actorId: request.requesterId,
        orgNodeId: base.matchedOrgNodeId,
        allowed: approverChain.length > 0,
        reasonCodes: [
          ...(base.delegated ? ["approval.delegated"] : ["approval.direct_route"]),
          `approval.routing.${base.routingStrategy}`,
          ...(escalation != null ? ["approval.escalated"] : []),
        ],
        occurredAt: nowIso,
      }),
    };
  }

  public getAmountThresholdMatrix(): readonly AmountThresholdRule[] {
    return [...this.amountThresholdRules];
  }

  public planChain(
    request: ApprovalRouteRequest,
    createdAtIso: string,
    nowIso: string,
    options: ApprovalChainOptions = {},
  ): ApprovalChainPlan {
    const routing = this.route(request, createdAtIso, nowIso);
    const chainMode = options.chainMode ?? "sequential";
    const deadlineAt = options.timeoutMinutes == null
      ? null
      : new Date(Date.parse(nowIso) + options.timeoutMinutes * 60_000).toISOString();
    const conditionalApproverIds = [...(options.conditionalApproverIds ?? [])].filter((id) => id.length > 0);

    let steps: ApprovalChainStep[];
    if (chainMode === "parallel") {
      steps = [{
        stepId: `approval_step_${routing.matchedOrgNodeId}_1`,
        approverIds: routing.approverChain,
        mode: "parallel",
        deadlineAt,
        escalationTarget: routing.escalatedTo,
        reasonCodes: routing.auditRecord.reasonCodes,
      }];
    } else {
      const orderedApprovers = chainMode === "conditional"
        ? [...routing.approverChain, ...conditionalApproverIds.filter((id) => !routing.approverChain.includes(id))]
        : [...routing.approverChain];
      steps = orderedApprovers.map((approverId, index) => ({
        stepId: `approval_step_${routing.matchedOrgNodeId}_${index + 1}`,
        approverIds: [approverId],
        mode: chainMode,
        deadlineAt,
        escalationTarget: routing.escalatedTo,
        reasonCodes: chainMode === "conditional"
          ? [...routing.auditRecord.reasonCodes, "approval.routing.conditional"]
          : routing.auditRecord.reasonCodes,
      }));
    }

    return {
      chainMode,
      matchedOrgNodeId: routing.matchedOrgNodeId,
      steps,
    };
  }

  private buildDelegationMap(orgNodeId: string, nowIso: string): Record<string, string> {
    const node = this.orgNodes.find((item) => item.orgNodeId === orgNodeId) ?? null;
    const owners = node?.ownerUserIds ?? [];
    return owners.reduce<Record<string, string>>((acc, approverId) => {
      acc[approverId] = resolveDelegatedApprover(this.delegations, approverId, orgNodeId, nowIso);
      return acc;
    }, {});
  }

  private resolveEscalation(
    createdAtIso: string,
    nowIso: string,
    riskLevel: ApprovalRouteRequest["riskLevel"],
  ): string | null {
    const matchedRule = this.escalationRules.find((rule) =>
      shouldEscalateApproval(rule, createdAtIso, nowIso, riskLevel));
    return matchedRule?.escalateToApproverId ?? null;
  }
}
