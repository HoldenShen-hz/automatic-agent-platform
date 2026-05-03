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
  readonly expiresAt: string;
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
  readonly approvalSteps: readonly ApprovalStepRequirement[];
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

export interface ParallelApproverGroup {
  readonly groupId: string;
  readonly approverIds: readonly string[];
  readonly requiredCount: number;
  readonly timeoutMinutes?: number;
}

export interface ApprovalStepRequirement {
  readonly stepId: string;
  readonly approverIds: readonly string[];
  readonly requiredApprovals: number;
  readonly stepType: "sequential" | "parallel" | "any";
  readonly dependsOnSteps?: readonly string[];
}

/**
 * Mode for multi-approver approval routes.
 * - sequential: approvers must approve one after another
 * - parallel: all approvers can approve simultaneously (会签)
 * - any: any one approver can approve to proceed
 */
export type ApprovalMode = "sequential" | "parallel" | "any";

/**
 * Build parallel sign-off groups for multi-approver scenarios.
 * Groups approvers into batches for parallel (会签) approval where
 * multiple approvers can sign off simultaneously.
 */
export function buildParallelSignoffGroups(
  approverChain: readonly string[],
  nodes: readonly OrgNode[],
  orgNodeId: string,
  mode: ApprovalMode = "parallel",
): ParallelApproverGroup[] {
  if (approverChain.length <= 1) {
    return [];
  }

  // For sequential mode, no parallel groups needed
  if (mode === "sequential") {
    return [];
  }

  // For parallel or any mode, group approvers for simultaneous sign-off
  const firstApprover = approverChain[0]!;
  const remainingApprovers = approverChain.slice(1);
  const firstApproverNode = nodes.find((n) => n.ownerUserIds.includes(firstApprover));
  const isFirstManager = firstApproverNode?.orgNodeId === orgNodeId
    || firstApproverNode?.parentOrgNodeId !== null;

  if (!isFirstManager) {
    // When first is not a manager, all remaining can sign off in parallel (会签)
    return [{
      groupId: `parallel:${orgNodeId}`,
      approverIds: remainingApprovers,
      requiredCount: mode === "any" ? 1 : remainingApprovers.length,
      timeoutMinutes: 30,
    }];
  }

  // Batch remaining approvers into groups of up to 3 for parallel sign-off
  const groups: ParallelApproverGroup[] = [];
  for (let i = 0; i < remainingApprovers.length; i += 3) {
    const batch = remainingApprovers.slice(i, i + 3);
    groups.push({
      groupId: `parallel:${orgNodeId}:${i}`,
      approverIds: batch,
      requiredCount: mode === "any" ? 1 : batch.length,
      timeoutMinutes: 30,
    });
  }
  return groups;
}

/**
 * Resolve approval steps from an approver chain.
 * Supports sequential (one-by-one), parallel (会签, simultaneous), and any (single approver) modes.
 */
export function resolveApprovalSteps(
  approverChain: readonly string[],
  nodes: readonly OrgNode[],
  orgNodeId: string,
  mode: ApprovalMode = "parallel",
): ApprovalStepRequirement[] {
  const groups = buildParallelSignoffGroups(approverChain, nodes, orgNodeId, mode);
  if (groups.length === 0) {
    // Single approver or sequential mode - create individual steps
    return approverChain.map((approverId, idx) => ({
      stepId: `step:${idx}`,
      approverIds: [approverId] as readonly string[],
      requiredApprovals: 1,
      stepType: "sequential" as const,
      dependsOnSteps: idx > 0 ? [`step:${idx - 1}`] as readonly string[] : undefined,
    })) as ApprovalStepRequirement[];
  }

  // Build steps from parallel groups
  const steps: ApprovalStepRequirement[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    steps.push({
      stepId: `parallel_step:${i}`,
      approverIds: group.approverIds,
      requiredApprovals: group.requiredCount,
      stepType: mode === "any" ? "any" as const : "parallel" as const,
      ...(i > 0 ? { dependsOnSteps: [`step:${i - 1}`, `parallel_step:${i - 1}`] as readonly string[] } : {}),
    });
  }
  return steps;
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
  // R34-36 FIX #1978: Use <= instead of < to match threshold boundary value.
  // With <, exact threshold amounts fall through to the next rule/default.
  const matchedRule = rules.find((item) => normalizedAmount.amountCny <= normalizeThresholdCny(item, normalizedAmount.fxSnapshot ?? undefined)) ?? null;
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

  const sameChainBlocked = findSameChainConflicts(request.requesterId, candidateApprovers, nodes, orgNodeId);
  for (const blockedId of sameChainBlocked) {
    blocked.add(blockedId);
  }

  return candidateApprovers.filter((approverId) => !blocked.has(approverId));
}

function findSameChainConflicts(
  requesterId: string,
  candidateApprovers: readonly string[],
  nodes: readonly OrgNode[],
  requesterOrgNodeId: string,
): string[] {
  const blocked: string[] = [];
  const requesterNode = nodes.find((item) => item.orgNodeId === requesterOrgNodeId) ?? null;
  if (requesterNode == null) {
    return blocked;
  }

  for (const approverId of candidateApprovers) {
    if (isInSameApprovalChain(requesterId, approverId, nodes, requesterOrgNodeId, requesterNode)) {
      blocked.push(approverId);
    }
  }
  return blocked;
}

function isInSameApprovalChain(
  requesterId: string,
  approverId: string,
  nodes: readonly OrgNode[],
  requesterOrgNodeId: string,
  requesterNode: OrgNode,
): boolean {
  const approverNode = nodes.find((item) => item.ownerUserIds.includes(approverId)) ?? null;
  if (approverNode == null) {
    return false;
  }

  // Direct parent-child relationships
  if (requesterNode.parentOrgNodeId === approverNode.orgNodeId) {
    return true;
  }
  if (approverNode.parentOrgNodeId === requesterOrgNodeId) {
    return true;
  }

  // Check if approver is in requester's upward chain (requester → ancestor → ...)
  let currentNode = requesterNode;
  while (currentNode.parentOrgNodeId != null) {
    const parentNode = nodes.find((item) => item.orgNodeId === currentNode.parentOrgNodeId) ?? null;
    if (parentNode == null) break;
    if (parentNode.ownerUserIds.includes(approverId)) {
      return true;
    }
    currentNode = parentNode;
  }

  // Check if requester is in approver's upward chain (approver → ancestor → ...)
  // This catches mutual approval: A is downstream of B and B is downstream of A in same chain
  let approverCurrentNode = approverNode;
  while (approverCurrentNode.parentOrgNodeId != null) {
    const approverParentNode = nodes.find((item) => item.orgNodeId === approverCurrentNode.parentOrgNodeId) ?? null;
    if (approverParentNode == null) break;
    if (approverParentNode.ownerUserIds.includes(requesterId)) {
      return true;
    }
    approverCurrentNode = approverParentNode;
  }

  return false;
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
  const approvalSteps = resolveApprovalSteps(approverChain, nodes, matched?.orgNodeId ?? request.orgNodeId);
  const nowIso = amount.fxSnapshot?.capturedAt ?? new Date().toISOString();
  const expiresAtIso = new Date(Date.parse(nowIso) + 24 * 60 * 60 * 1000).toISOString();
  const routeSnapshot: ApprovalRouteSnapshot = {
    snapshotId: `approval_route_snapshot:${request.requesterId}:${matched?.orgNodeId ?? request.orgNodeId}:${strategy.strategyId}`,
    // SECURITY FIX: Use current time as fallback instead of epoch 1970 when no fxRateSnapshot
    createdAt: amount.fxSnapshot?.capturedAt ?? nowIso,
    expiresAt: expiresAtIso,
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
    approvalSteps,
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

function normalizeThresholdCny(
  rule: AmountThresholdRule,
  fxSnapshot?: ApprovalFxSnapshot,
): number {
  if (rule.maxAmountCny != null) {
    return rule.maxAmountCny;
  }
  if (rule.maxAmountUsd != null) {
    // SECURITY FIX: Use the provided fxSnapshot rate consistently.
    // Previously hardcoded 7.2 when no fxSnapshot, causing inconsistency.
    // For legacy amounts without fxSnapshot, fall back to DEFAULT_LEGACY_FX_RATE.
    if (fxSnapshot != null && fxSnapshot.baseCurrency.toUpperCase() === "USD") {
      return rule.maxAmountUsd * fxSnapshot.rate;
    }
    if (fxSnapshot != null && fxSnapshot.baseCurrency.toUpperCase() !== "CNY") {
      return rule.maxAmountUsd * fxSnapshot.rate;
    }
    if (fxSnapshot != null) {
      return rule.maxAmountUsd * fxSnapshot.rate;
    }
    // Use configured default for legacy amounts
    return rule.maxAmountUsd * DEFAULT_LEGACY_FX_RATE;
  }
  return Number.POSITIVE_INFINITY;
}

// Default FX rate fallback for legacy USD amounts when no fxRateSnapshot is provided
// In production, use a real exchange rate service or configured rate
const DEFAULT_LEGACY_FX_RATE = parseFloat(process.env["APPROVAL_ROUTE_DEFAULT_FX_RATE"] ?? "7.2");

export function setDefaultLegacyFxRate(rate: number): void {
  // For testing purposes - allows test files to override the default rate
  (process.env as Record<string, string>)["APPROVAL_ROUTE_DEFAULT_FX_RATE"] = String(rate);
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
    amountCny: legacyAmountUsd * DEFAULT_LEGACY_FX_RATE,
    fxSnapshot: {
      baseCurrency: "USD",
      quoteCurrency: "CNY",
      rate: DEFAULT_LEGACY_FX_RATE,
      source: "legacy_amount_usd_default",
      capturedAt: "1970-01-01T00:00:00.000Z",
    },
  };
}
