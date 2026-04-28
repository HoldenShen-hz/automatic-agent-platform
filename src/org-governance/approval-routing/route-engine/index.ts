import { z } from "zod";

import type { OrgNode } from "../../org-model/org-node/index.js";
import { getLegalEntityApprovalRoles, requiresLegalEntityApproval } from "../../org-model/org-node/index.js";

export const ApprovalRouteRequestSchema = z.object({
  requesterId: z.string().min(1),
  orgNodeId: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  amountUsd: z.number().nonnegative().optional(),
  amount: z.object({
    value: z.number().nonnegative(),
    currency: z.string().min(3).max(3).default("CNY"),
    fxRateSnapshot: z.object({
      baseCurrency: z.string().min(3).max(3),
      quoteCurrency: z.literal("CNY"),
      rate: z.number().positive(),
      source: z.string().min(1),
      capturedAt: z.string().min(1),
    }).optional(),
  }).optional(),
  requesterManagerIds: z.array(z.string().min(1)).default([]),
  conflictedApproverIds: z.array(z.string().min(1)).default([]),
  budgetOwnerId: z.string().min(1).optional(),
  executionOwnerId: z.string().min(1).optional(),
  policyVersion: z.string().min(1).default("approval-routing/v2"),
  orgVersion: z.string().min(1).default("org-chart/v2"),
  evidenceRefs: z.array(z.string().min(1)).default([]),
});

export interface ApprovalFxSnapshot {
  readonly baseCurrency: string;
  readonly quoteCurrency: "CNY";
  readonly rate: number;
  readonly source: string;
  readonly capturedAt: string;
}

export interface ApprovalAmountSnapshot {
  readonly originalValue: number;
  readonly originalCurrency: string;
  readonly amountCny: number;
  readonly fxSnapshot: ApprovalFxSnapshot | null;
}

export interface ApprovalRouteSnapshot {
  readonly snapshotId: string;
  readonly createdAt: string;
  readonly orgVersion: string;
  readonly policyVersion: string;
  readonly requesterId: string;
  readonly matchedOrgNodeId: string;
  readonly routingStrategy: "org_chart" | "amount_based";
  readonly approverIds: readonly string[];
  readonly amount: ApprovalAmountSnapshot;
  readonly evidenceRefs: readonly string[];
  readonly sodSnapshot: {
    readonly requesterManagerIds: readonly string[];
    readonly blockedApproverIds: readonly string[];
    readonly budgetOwnerId: string | null;
    readonly executionOwnerId: string | null;
  };
  readonly coiSnapshot: {
    readonly conflictedApproverIds: readonly string[];
    readonly blockedApproverIds: readonly string[];
  };
  readonly legalEntityApprovalRoles: readonly string[];
}

export interface ApprovalRouteDecision {
  readonly matchedOrgNodeId: string;
  readonly approverChain: readonly string[];
  readonly delegated: boolean;
  readonly routingStrategy: "org_chart" | "amount_based";
  readonly routeSnapshot: ApprovalRouteSnapshot;
}

export type ApprovalRouteRequest = z.infer<typeof ApprovalRouteRequestSchema>;

export interface AmountThresholdRule {
  readonly maxAmountCny?: number;
  readonly maxAmountUsd?: number;
  readonly targetNodeTypes: readonly OrgNode["nodeType"][];
}

export interface RoutingStrategy {
  readonly strategyId: ApprovalRouteDecision["routingStrategy"];
  selectNode(nodes: readonly OrgNode[], request: ApprovalRouteRequest): OrgNode | null;
}

export class OrgChartRoutingStrategy implements RoutingStrategy {
  public readonly strategyId = "org_chart" as const;

  public selectNode(nodes: readonly OrgNode[], request: ApprovalRouteRequest): OrgNode | null {
    return nodes.find((item) => item.orgNodeId === request.orgNodeId && item.active)
      ?? nodes.find((item) => item.orgNodeId === request.orgNodeId)
      ?? nodes[0]
      ?? null;
  }
}

export class AmountBasedRoutingStrategy implements RoutingStrategy {
  public readonly strategyId = "amount_based" as const;

  public constructor(private readonly rules: readonly AmountThresholdRule[]) {}

  public selectNode(nodes: readonly OrgNode[], request: ApprovalRouteRequest): OrgNode | null {
    return resolveAmountRoute(nodes, request, this.rules);
  }
}

export function resolveAmountRoute(
  nodes: readonly OrgNode[],
  request: ApprovalRouteRequest,
  rules: readonly AmountThresholdRule[],
): OrgNode | null {
  const normalizedAmount = normalizeApprovalAmount(request);
  const matchedRule = rules.find((item) => normalizedAmount.amountCny < normalizeThresholdCny(item)) ?? null;
  if (!matchedRule) {
    return nodes.find((item) => item.nodeType === "company") ?? null;
  }

  return nodes.find((item) =>
    matchedRule.targetNodeTypes.includes(item.nodeType)
    && item.active
    && (item.orgNodeId === request.orgNodeId || item.parentOrgNodeId === request.orgNodeId),
  ) ?? nodes.find((item) => matchedRule.targetNodeTypes.includes(item.nodeType) && item.active) ?? null;
}

export function applySodPolicy(
  request: ApprovalRouteRequest,
  candidateApprovers: readonly string[],
  nodes: readonly OrgNode[],
  orgNodeId: string,
): string[] {
  const blocked = new Set<string>([
    request.requesterId,
    ...(request.requesterManagerIds ?? []),
    ...(request.conflictedApproverIds ?? []),
  ]);
  const executionOwnerId = request.executionOwnerId ?? request.requesterId;
  const budgetOwnerId = request.budgetOwnerId ?? null;
  if (budgetOwnerId != null && executionOwnerId === budgetOwnerId) {
    blocked.add(budgetOwnerId);
  }
  const matchedNode = nodes.find((item) => item.orgNodeId === orgNodeId) ?? null;
  if (matchedNode?.ownerUserIds.includes(request.requesterId)) {
    for (const ownerId of matchedNode.ownerUserIds) {
      blocked.add(ownerId);
    }
  }
  return candidateApprovers.filter((approverId) => !blocked.has(approverId));
}

export function resolveApprovalRoute(
  nodes: readonly OrgNode[],
  request: ApprovalRouteRequest,
  delegationMap: Readonly<Record<string, string>> = {},
  amountRules: readonly AmountThresholdRule[] = [],
): ApprovalRouteDecision {
  const strategies: RoutingStrategy[] = amountRules.length > 0
    ? [new AmountBasedRoutingStrategy(amountRules), new OrgChartRoutingStrategy()]
    : [new OrgChartRoutingStrategy()];
  const strategy = strategies.find((item) => item.selectNode(nodes, request) != null) ?? strategies[0] ?? new OrgChartRoutingStrategy();
  const matched = strategy.selectNode(nodes, request)
    ?? nodes.find((item) => item.orgNodeId === request.orgNodeId)
    ?? nodes[0];
  const ownerChain = matched?.ownerUserIds?.length ? matched.ownerUserIds : ["platform_admin"];
  const delegatedChain = ownerChain.map((item) => delegationMap[item] ?? item);
  const approverChain = applySodPolicy(request, delegatedChain, nodes, matched?.orgNodeId ?? request.orgNodeId);
  const amount = normalizeApprovalAmount(request);
  const matchedBoundary = matched?.legalEntityBoundary ?? null;
  const requesterBoundary = nodes.find((item) => item.orgNodeId === request.orgNodeId)?.legalEntityBoundary ?? null;
  const legalEntityApprovalRoles = requiresLegalEntityApproval(requesterBoundary, matchedBoundary)
    ? getLegalEntityApprovalRoles(requesterBoundary, matchedBoundary)
    : [];
  const routeSnapshot: ApprovalRouteSnapshot = {
    snapshotId: `approval_route_snapshot:${request.requesterId}:${matched?.orgNodeId ?? request.orgNodeId}:${strategy.strategyId}`,
    createdAt: amount.fxSnapshot?.capturedAt ?? "1970-01-01T00:00:00.000Z",
    orgVersion: request.orgVersion,
    policyVersion: request.policyVersion,
    requesterId: request.requesterId,
    matchedOrgNodeId: matched?.orgNodeId ?? request.orgNodeId,
    routingStrategy: strategy.strategyId,
    approverIds: approverChain,
    amount,
    evidenceRefs: request.evidenceRefs,
    sodSnapshot: {
      requesterManagerIds: request.requesterManagerIds ?? [],
      blockedApproverIds: delegatedChain.filter((approverId) => !approverChain.includes(approverId)),
      budgetOwnerId: request.budgetOwnerId ?? null,
      executionOwnerId: request.executionOwnerId ?? request.requesterId,
    },
    coiSnapshot: {
      conflictedApproverIds: request.conflictedApproverIds ?? [],
      blockedApproverIds: (request.conflictedApproverIds ?? []).filter((approverId) => delegatedChain.includes(approverId)),
    },
    legalEntityApprovalRoles,
  };
  return {
    matchedOrgNodeId: matched?.orgNodeId ?? request.orgNodeId,
    approverChain,
    delegated: delegatedChain.some((item, index) => item !== ownerChain[index]),
    routingStrategy: strategy.strategyId,
    routeSnapshot,
  };
}

export type ApprovalRouteLifecycleEvent = "submitted" | "expired" | "revoked";

export interface ApprovalRouteRevalidationResult {
  readonly valid: boolean;
  readonly event: ApprovalRouteLifecycleEvent;
  readonly reasons: readonly string[];
  readonly routeSnapshot: ApprovalRouteSnapshot | null;
}

export function revalidateApprovalRoute(
  nodes: readonly OrgNode[],
  request: ApprovalRouteRequest,
  existingDecision: ApprovalRouteDecision,
  event: ApprovalRouteLifecycleEvent,
  delegationMap: Readonly<Record<string, string>> = {},
  amountRules: readonly AmountThresholdRule[] = [],
): ApprovalRouteRevalidationResult {
  if (event === "expired") {
    return { valid: false, event, reasons: ["approval_route.expired"], routeSnapshot: null };
  }
  if (event === "revoked") {
    return { valid: false, event, reasons: ["approval_route.revoked"], routeSnapshot: null };
  }
  const refreshed = resolveApprovalRoute(nodes, request, delegationMap, amountRules);
  const reasons: string[] = [];
  if (refreshed.routeSnapshot.orgVersion !== existingDecision.routeSnapshot.orgVersion) {
    reasons.push("approval_route.org_version_changed");
  }
  if (refreshed.routeSnapshot.policyVersion !== existingDecision.routeSnapshot.policyVersion) {
    reasons.push("approval_route.policy_version_changed");
  }
  if (refreshed.approverChain.join(",") !== existingDecision.approverChain.join(",")) {
    reasons.push("approval_route.approver_chain_changed");
  }
  return {
    valid: reasons.length === 0,
    event,
    reasons,
    routeSnapshot: refreshed.routeSnapshot,
  };
}

function normalizeThresholdCny(rule: AmountThresholdRule): number {
  if (rule.maxAmountCny != null) {
    return rule.maxAmountCny;
  }
  if (rule.maxAmountUsd != null) {
    return rule.maxAmountUsd * 7.2;
  }
  return Number.POSITIVE_INFINITY;
}

function normalizeApprovalAmount(request: ApprovalRouteRequest): ApprovalAmountSnapshot {
  if (request.amount != null) {
    const currency = request.amount.currency.toUpperCase();
    if (currency === "CNY") {
      return {
        originalValue: request.amount.value,
        originalCurrency: currency,
        amountCny: request.amount.value,
        fxSnapshot: null,
      };
    }
    if (request.amount.fxRateSnapshot == null) {
      throw new Error(`approval_route.fx_snapshot_required:${currency}`);
    }
    return {
      originalValue: request.amount.value,
      originalCurrency: currency,
      amountCny: request.amount.value * request.amount.fxRateSnapshot.rate,
      fxSnapshot: {
        baseCurrency: request.amount.fxRateSnapshot.baseCurrency.toUpperCase(),
        quoteCurrency: "CNY",
        rate: request.amount.fxRateSnapshot.rate,
        source: request.amount.fxRateSnapshot.source,
        capturedAt: request.amount.fxRateSnapshot.capturedAt,
      },
    };
  }
  const legacyAmountUsd = request.amountUsd ?? 0;
  return {
    originalValue: legacyAmountUsd,
    originalCurrency: "USD",
    amountCny: legacyAmountUsd * 7.2,
    fxSnapshot: {
      baseCurrency: "USD",
      quoteCurrency: "CNY",
      rate: 7.2,
      source: "legacy_amount_usd_default",
      capturedAt: "1970-01-01T00:00:00.000Z",
    },
  };
}
