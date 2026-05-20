import { buildGovernanceAuditRecord, type GovernanceAuditRecord } from "../compliance-engine/audit-enforcer/index.js";
import { newId, nowIso, randomUUID } from "../../platform/contracts/types/ids.js";
import { type ApprovalDelegation, resolveDelegatedApprover } from "./delegation/index.js";
import {
  evaluateApprovalEscalation,
  type ApprovalEscalationEvaluationContext,
  type ApprovalEscalationRule,
} from "./escalation/index.js";
import {
  resolveApprovalRoute,
  type AmountThresholdRule,
  type ApprovalRouteDecision,
  type ApprovalRouteRequest,
} from "./route-engine/index.js";
import type { OrgNode } from "../org-model/org-node/index.js";

export interface ApprovalRoutingResult extends ApprovalRouteDecision {
  readonly escalatedTo: string | null;
  readonly escalationRuleId: string | null;
  readonly slaBreachNotificationTargetIds: readonly string[];
  readonly auditRecord: GovernanceAuditRecord;
}

export type ApprovalChainMode = "sequential" | "parallel" | "conditional";

export interface ApprovalChainStep {
  readonly stepId: string;
  readonly approverIds: readonly string[];
  readonly mode: ApprovalChainMode;
  readonly deadlineAt: string | null;
  readonly escalationTarget: string | null;
  readonly slaBreachNotificationTargetIds: readonly string[];
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
  readonly escalationContext?: ApprovalEscalationEvaluationContext;
}

export interface ApprovalRoutingServiceOptions {
  readonly orgNodes: readonly OrgNode[];
  readonly delegations?: readonly ApprovalDelegation[];
  readonly escalationRules?: readonly ApprovalEscalationRule[];
  readonly amountThresholdRules?: readonly AmountThresholdRule[];
  readonly routeSnapshotTtlMs?: number;
  readonly fxRatesToCny?: Readonly<Record<string, {
    readonly rate: number;
    readonly asOf?: string;
    readonly source?: string;
  }>>;
  readonly fallbackApproverIds?: readonly string[];
}

export class ApprovalRoutingService {
  private readonly orgNodes: readonly OrgNode[];
  private readonly delegations: readonly ApprovalDelegation[];
  private readonly escalationRules: readonly ApprovalEscalationRule[];
  private readonly amountThresholdRules: readonly AmountThresholdRule[];
  private readonly routeSnapshotTtlMs: number;
  private readonly fxRatesToCny: Readonly<Record<string, {
    readonly rate: number;
    readonly asOf?: string;
    readonly source?: string;
  }>>;
  private readonly fallbackApproverIds: readonly string[];

  public constructor(options: ApprovalRoutingServiceOptions) {
    this.orgNodes = options.orgNodes;
    this.delegations = options.delegations ?? [];
    this.escalationRules = options.escalationRules ?? [];
    this.amountThresholdRules = options.amountThresholdRules ?? [];
    this.routeSnapshotTtlMs = options.routeSnapshotTtlMs ?? 24 * 60 * 60 * 1000;
    this.fxRatesToCny = options.fxRatesToCny ?? {
      USD: {
        rate: 7.2,
        source: "approval-routing.default-usd-cny",
      },
      CNY: {
        rate: 1,
        source: "approval-routing.identity-cny",
      },
    };
    this.fallbackApproverIds = options.fallbackApproverIds ?? [];
  }

  public route(
    request: ApprovalRouteRequest,
    createdAtIso: string,
    nowIso: string,
    escalationContext: ApprovalEscalationEvaluationContext = {},
  ): ApprovalRoutingResult {
    const delegationMap = this.buildDelegationMap(request.orgNodeId, nowIso);
    let base: ApprovalRouteDecision;
    try {
      base = resolveApprovalRoute(this.orgNodes, request, delegationMap, this.amountThresholdRules);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("approval_route.empty_approver_chain:")) {
        throw error;
      }
      const matchedOrgNodeId = error.message.slice("approval_route.empty_approver_chain:".length) || request.orgNodeId;
      base = {
        matchedOrgNodeId,
        approverChain: [],
        delegated: false,
        routingStrategy: this.amountThresholdRules.length > 0 ? "amount_based" : "org_chart",
        routeSnapshot: {
          snapshotId: `approval_route_snapshot:${request.requesterId}:${matchedOrgNodeId}:empty`,
          createdAt: createdAtIso,
          expiresAt: new Date(Date.parse(createdAtIso) + this.routeSnapshotTtlMs).toISOString(),
          orgVersion: request.orgVersion ?? "org-chart/v2",
          policyVersion: request.policyVersion ?? "approval-routing/v2",
          requesterId: request.requesterId,
          matchedOrgNodeId,
          routingStrategy: this.amountThresholdRules.length > 0 ? "amount_based" : "org_chart",
          approverIds: [...this.fallbackApproverIds],
          amount: {
            ...this.buildAmountSnapshot(request),
          },
          evidenceRefs: request.evidenceRefs ?? [],
          sodSnapshot: {
            requesterManagerIds: request.requesterManagerIds ?? [],
            blockedApproverIds: [],
            budgetOwnerId: request.budgetOwnerId ?? null,
            executionOwnerId: request.executionOwnerId ?? request.requesterId,
          },
          coiSnapshot: {
            conflictedApproverIds: request.conflictedApproverIds ?? [],
            blockedApproverIds: request.conflictedApproverIds ?? [],
          },
          legalEntityApprovalRoles: [],
        },
      };
    }
    const escalation = this.resolveEscalation(createdAtIso, nowIso, request.riskLevel, escalationContext);
    const escalatedTo = escalation.escalatedTo;
    const approverChain = escalatedTo != null && !base.approverChain.includes(escalatedTo)
      ? [...base.approverChain, escalatedTo]
      : [...base.approverChain];
    if (approverChain.length === 0) {
      throw new Error(`approval_route.empty_approver_chain:${base.matchedOrgNodeId}`);
    }

    return {
      matchedOrgNodeId: base.matchedOrgNodeId,
      approverChain,
      delegated: base.delegated,
      routingStrategy: base.routingStrategy,
      routeSnapshot: {
        ...base.routeSnapshot,
        approverIds: approverChain,
        expiresAt: new Date(Date.parse(createdAtIso) + this.routeSnapshotTtlMs).toISOString(),
        amount: this.buildAmountSnapshot(request),
      },
      escalatedTo,
      escalationRuleId: escalation.escalationRuleId,
      slaBreachNotificationTargetIds: escalation.slaBreachNotificationTargetIds,
      auditRecord: buildGovernanceAuditRecord({
        recordId: `approval_route_audit_${request.requesterId}_${base.matchedOrgNodeId}_${Date.now()}_${randomUUID()}`,
        action: "approval.route",
        actorId: request.requesterId,
        orgNodeId: base.matchedOrgNodeId,
        allowed: approverChain.length > 0,
        reasonCodes: [
          ...(base.delegated ? ["approval.delegated"] : ["approval.direct_route"]),
          `approval.routing.${base.routingStrategy}`,
          ...(escalatedTo != null ? ["approval.escalated"] : []),
          ...(escalation.escalationRuleId != null ? [`approval.escalation_rule.${escalation.escalationRuleId}`] : []),
          ...(escalation.slaBreachNotificationTargetIds.length > 0 ? ["approval.sla_breach_notified"] : []),
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
    const routing = this.route(request, createdAtIso, nowIso, options.escalationContext);
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
        slaBreachNotificationTargetIds: routing.slaBreachNotificationTargetIds,
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
        slaBreachNotificationTargetIds: routing.slaBreachNotificationTargetIds,
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

  private buildAmountSnapshot(request: ApprovalRouteRequest): ApprovalRouteDecision["routeSnapshot"]["amount"] {
    const originalCurrency = request.amount?.currency?.toUpperCase() ?? "USD";
    const originalValue = request.amount?.value ?? request.amountUsd ?? 0;
    const normalizedCurrency = originalCurrency.trim().toUpperCase();
    const fxEntry = this.fxRatesToCny[normalizedCurrency];
    if (fxEntry == null || !Number.isFinite(fxEntry.rate) || fxEntry.rate <= 0) {
      throw new Error(`approval_route.fx_rate_missing:${normalizedCurrency}`);
    }
    return {
      originalValue,
      originalCurrency: normalizedCurrency,
      amountCny: Number((originalValue * fxEntry.rate).toFixed(2)),
      fxSnapshot: {
        baseCurrency: normalizedCurrency,
        quoteCurrency: "CNY",
        rate: fxEntry.rate,
        capturedAt: fxEntry.asOf ?? nowIso(),
        source: fxEntry.source ?? "approval-routing.configured-fx",
      },
    };
  }

  private resolveEscalation(
    createdAtIso: string,
    nowIso: string,
    riskLevel: ApprovalRouteRequest["riskLevel"],
    context: ApprovalEscalationEvaluationContext,
  ): {
    readonly escalatedTo: string | null;
    readonly escalationRuleId: string | null;
    readonly slaBreachNotificationTargetIds: readonly string[];
  } {
    const matchedRule = this.escalationRules
      .map((rule) => ({
        rule,
        decision: evaluateApprovalEscalation(rule, createdAtIso, nowIso, riskLevel, context),
      }))
      .filter((item) => item.decision.shouldEscalate)
      .sort((left, right) =>
        right.rule.triggerAfterMinutes - left.rule.triggerAfterMinutes ||
        (left.rule.maxEscalationDepth ?? 1) - (right.rule.maxEscalationDepth ?? 1),
      )[0];

    return {
      escalatedTo: matchedRule?.rule.escalateToApproverId ?? null,
      escalationRuleId: matchedRule?.rule.ruleId ?? null,
      slaBreachNotificationTargetIds: matchedRule?.decision.notificationTargetIds ?? [],
    };
  }
}
