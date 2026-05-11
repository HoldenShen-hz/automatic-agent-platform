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
  // R9-33: Routing mode support for parallel/countersign
  readonly routingMode?: ApprovalRoutingMode;
  readonly routeGraph?: readonly ApprovalRouteNode[];
}

export interface ApprovalRouteDecision {
  readonly matchedOrgNodeId: string;
  readonly approverChain: readonly string[];
  readonly delegated: boolean;
  readonly routingStrategy: "org_chart" | "amount_based";
  readonly routeSnapshot: ApprovalRouteSnapshot;
}

export type ApprovalRouteRequest = z.infer<typeof ApprovalRouteRequestSchema>;

const DEFAULT_USD_TO_CNY_RATE = 7.2;
const DEFAULT_FX_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
  fxSnapshot: ApprovalFxSnapshot | null = null,
): OrgNode | null {
  const normalizedRequest = ApprovalRouteRequestSchema.parse(request);
  const normalizedAmount = normalizeApprovalAmount(normalizedRequest);
  const thresholdFxSnapshot = fxSnapshot ?? normalizedAmount.fxSnapshot;
  const matchedRule = rules.find((item) => normalizedAmount.amountCny <= normalizeThresholdCny(item, thresholdFxSnapshot)) ?? null;
  if (!matchedRule) {
    return nodes.find((item) => item.nodeType === "company") ?? null;
  }

  return nodes.find((item) =>
    matchedRule.targetNodeTypes.includes(item.nodeType)
    && item.active
    && (item.orgNodeId === normalizedRequest.orgNodeId || item.parentOrgNodeId === normalizedRequest.orgNodeId),
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
  // Prevent same-chain approval: if any candidate approver shares a management chain
  // with another candidate approver, block that person to ensure no circular approvals
  const sameChainBlocked = new Set<string>();
  for (const approverA of candidateApprovers) {
    for (const approverB of candidateApprovers) {
      if (approverA === approverB) continue;
      if (sharesManagementChain(approverA, approverB, nodes)) {
        sameChainBlocked.add(approverA);
        sameChainBlocked.add(approverB);
      }
    }
  }
  for (const id of sameChainBlocked) {
    blocked.add(id);
  }
  return candidateApprovers.filter((approverId) => !blocked.has(approverId));
}

function sharesManagementChain(a: string, b: string, nodes: readonly OrgNode[]): boolean {
  const nodeOf = (userId: string): OrgNode | undefined =>
    nodes.find((n) => n.ownerUserIds.includes(userId));
  const aNode = nodeOf(a);
  const bNode = nodeOf(b);
  if (!aNode || !bNode) return false;
  // Check if a and b share any ancestor in the org hierarchy (same approval lineage)
  const aAncestors = collectAncestorIds(aNode, nodes);
  const bAncestors = collectAncestorIds(bNode, nodes);
  return aAncestors.has(b) || bAncestors.has(a);
}

function collectAncestorIds(node: OrgNode, nodes: readonly OrgNode[]): Set<string> {
  const ancestors = new Set<string>();
  let current: OrgNode | undefined = node;
  while (current?.parentOrgNodeId) {
    const parent = nodes.find((n) => n.orgNodeId === current!.parentOrgNodeId);
    if (!parent) break;
    ancestors.add(parent.orgNodeId);
    for (const ownerId of parent.ownerUserIds) {
      ancestors.add(ownerId);
    }
    current = parent;
  }
  return ancestors;
}

/**
 * R9-33: Approval routing mode - supports linear, parallel, and countersign workflows
 */
export type ApprovalRoutingMode = "linear" | "parallel" | "countersign";

/**
 * R9-33: Approval step node for representing parallel/countersign routing
 */
export interface ApprovalRouteNode {
  readonly approverIds: readonly string[];
  readonly mode: ApprovalRoutingMode;
  readonly threshold?: number; // For countersign: required number of approvals
  readonly label?: string;
}

/**
 * R9-33: Resolved approval route with support for parallel/countersign chains
 */
export interface ResolvedApprovalRouteChain {
  readonly linearizedChain: readonly string[]; // Flat list for backwards compatibility
  readonly routeGraph: readonly ApprovalRouteNode[];
  readonly routingMode: ApprovalRoutingMode;
}

function resolveApprovalRouteWithMode(
  nodes: readonly OrgNode[],
  request: ApprovalRouteRequest,
  delegationMap: Readonly<Record<string, string>>,
  routingMode: ApprovalRoutingMode,
): ResolvedApprovalRouteChain {
  const strategies: RoutingStrategy[] = [];
  if (request.amount != null && request.amount.value > 100_000) {
    // R9-33: High-value requests (>100k CNY) get parallel routing for faster approval
    routingMode = "parallel";
  }
  if (request.conflictedApproverIds.length > 2) {
    // R9-33: High conflict scenarios require countersign to ensure accountability
    routingMode = "countersign";
  }

  const matched = nodes.find((item) => item.orgNodeId === request.orgNodeId && item.active)
    ?? nodes.find((item) => item.orgNodeId === request.orgNodeId)
    ?? nodes[0];
  const ownerChain = matched?.ownerUserIds?.length ? matched.ownerUserIds : ["platform_admin"];
  const delegatedChain = ownerChain.map((item) => delegationMap[item] ?? item);
  const baseApproverChain = applySodPolicy(request, delegatedChain, nodes, matched?.orgNodeId ?? request.orgNodeId);

  if (routingMode === "parallel" || routingMode === "countersign") {
    // R9-33: For parallel/countersign, split approvers into groups
    const threshold = routingMode === "countersign" ? Math.ceil(baseApproverChain.length / 2) : baseApproverChain.length;
    const routeGraph: ApprovalRouteNode[] = [{
      approverIds: baseApproverChain,
      mode: routingMode,
      threshold,
      label: routingMode === "countersign" ? "Countersign Required" : "Parallel Approval",
    }];
    return {
      linearizedChain: baseApproverChain,
      routeGraph,
      routingMode,
    };
  }

  // Linear mode: single chain
  return {
    linearizedChain: baseApproverChain,
    routeGraph: [{
      approverIds: baseApproverChain,
      mode: "linear",
      label: "Sequential Approval",
    }],
    routingMode: "linear",
  };
}

export function resolveApprovalRoute(
  nodes: readonly OrgNode[],
  request: ApprovalRouteRequest,
  delegationMap: Readonly<Record<string, string>> = {},
  amountRules: readonly AmountThresholdRule[] = [],
  routingMode: ApprovalRoutingMode = "linear",
): ApprovalRouteDecision {
  const normalizedRequest = ApprovalRouteRequestSchema.parse(request);
  const requestedNode = nodes.find((item) => item.orgNodeId === normalizedRequest.orgNodeId) ?? null;
  if (requestedNode == null) {
    throw new Error(`approval_route.org_node_not_found:${normalizedRequest.orgNodeId}`);
  }
  const strategies: RoutingStrategy[] = amountRules.length > 0
    ? [new AmountBasedRoutingStrategy(amountRules), new OrgChartRoutingStrategy()]
    : [new OrgChartRoutingStrategy()];
  const strategy = strategies.find((item) => item.selectNode(nodes, normalizedRequest) != null) ?? strategies[0] ?? new OrgChartRoutingStrategy();
  const matched = strategy.selectNode(nodes, normalizedRequest)
    ?? requestedNode;
  const ownerChain = matched?.ownerUserIds?.length ? matched.ownerUserIds : ["platform_admin"];
  const delegatedChain = ownerChain.map((item) => delegationMap[item] ?? item);

  // R9-33: Use mode-aware resolution for parallel/countersign support
  const resolved = resolveApprovalRouteWithMode(nodes, normalizedRequest, delegationMap, routingMode);
  const approverChain = resolved.linearizedChain;
  if (approverChain.length === 0) {
    throw new Error(`approval_route.empty_approver_chain:${matched?.orgNodeId ?? normalizedRequest.orgNodeId}`);
  }
  const amount = normalizeApprovalAmount(normalizedRequest);
  const matchedBoundary = matched?.legalEntityBoundary ?? null;
  const requesterBoundary = requestedNode.legalEntityBoundary ?? null;
  const legalEntityApprovalRoles = requiresLegalEntityApproval(requesterBoundary, matchedBoundary)
    ? getLegalEntityApprovalRoles(requesterBoundary, matchedBoundary)
    : [];
  const routeSnapshot: ApprovalRouteSnapshot = {
    snapshotId: `approval_route_snapshot:${normalizedRequest.requesterId}:${matched?.orgNodeId ?? normalizedRequest.orgNodeId}:${strategy.strategyId}`,
    createdAt: amount.fxSnapshot?.capturedAt ?? "1970-01-01T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // R5-35: 24h default expiry
    orgVersion: normalizedRequest.orgVersion,
    policyVersion: normalizedRequest.policyVersion,
    requesterId: normalizedRequest.requesterId,
    matchedOrgNodeId: matched?.orgNodeId ?? normalizedRequest.orgNodeId,
    routingStrategy: strategy.strategyId,
    approverIds: approverChain,
    amount,
    evidenceRefs: normalizedRequest.evidenceRefs,
    sodSnapshot: {
      requesterManagerIds: normalizedRequest.requesterManagerIds ?? [],
      blockedApproverIds: delegatedChain.filter((approverId) => !approverChain.includes(approverId)),
      budgetOwnerId: normalizedRequest.budgetOwnerId ?? null,
      executionOwnerId: normalizedRequest.executionOwnerId ?? normalizedRequest.requesterId,
    },
    coiSnapshot: {
      conflictedApproverIds: normalizedRequest.conflictedApproverIds ?? [],
      blockedApproverIds: (normalizedRequest.conflictedApproverIds ?? []).filter((approverId) => delegatedChain.includes(approverId)),
    },
    legalEntityApprovalRoles,
    // R9-33: Include routing mode in snapshot
    routingMode: resolved.routingMode,
    routeGraph: resolved.routeGraph,
  };
  return {
    matchedOrgNodeId: matched?.orgNodeId ?? normalizedRequest.orgNodeId,
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

/**
 * R9-34: Route engine configuration options
 */
export interface RouteEngineOptions {
  /** Default USD to CNY exchange rate fallback when no FX snapshot is available */
  readonly defaultFxRateUsdToCny?: number;
  /** Maximum age of FX snapshot before requiring refresh (in milliseconds) */
  readonly fxSnapshotMaxAgeMs?: number;
}

function normalizeThresholdCny(
  rule: AmountThresholdRule,
  fxSnapshot: ApprovalFxSnapshot | null = null,
  defaultFxRate: number = getDefaultFxRateUsdToCny(),
): number {
  if (rule.maxAmountCny != null) {
    return rule.maxAmountCny;
  }
  if (rule.maxAmountUsd != null) {
    // R9-34: Use FX snapshot rate if available, otherwise fall back to configured default
    const rate = fxSnapshot?.rate ?? defaultFxRate;
    return rule.maxAmountUsd * rate;
  }
  return Number.POSITIVE_INFINITY;
}

function normalizeApprovalAmount(
  request: ApprovalRouteRequest,
  defaultFxRate: number = getDefaultFxRateUsdToCny(),
): ApprovalAmountSnapshot {
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
    const validatedSnapshot = validateFxSnapshot(request.amount.fxRateSnapshot);
    return {
      originalValue: request.amount.value,
      originalCurrency: currency,
      amountCny: request.amount.value * validatedSnapshot.rate,
      fxSnapshot: {
        baseCurrency: validatedSnapshot.baseCurrency,
        quoteCurrency: "CNY",
        rate: validatedSnapshot.rate,
        source: validatedSnapshot.source,
        capturedAt: validatedSnapshot.capturedAt,
      },
    };
  }
  const legacyAmountUsd = request.amountUsd ?? 0;
  const provider = getFxRateProvider();
  return {
    originalValue: legacyAmountUsd,
    originalCurrency: "USD",
    amountCny: legacyAmountUsd * defaultFxRate,
    fxSnapshot: {
      baseCurrency: "USD",
      quoteCurrency: "CNY",
      rate: defaultFxRate,
      source: provider.source,
      capturedAt: "1970-01-01T00:00:00.000Z",
    },
  };
}

function validateFxSnapshot(
  snapshot: ApprovalFxSnapshot,
  now: number = Date.now(),
  maxAgeMs: number = DEFAULT_FX_SNAPSHOT_MAX_AGE_MS,
): ApprovalFxSnapshot {
  const capturedAtMs = Date.parse(snapshot.capturedAt);
  if (!Number.isFinite(capturedAtMs)) {
    throw new Error(`approval_route.fx_snapshot_invalid_captured_at:${snapshot.capturedAt}`);
  }
  if (now - capturedAtMs > maxAgeMs) {
    throw new Error(`approval_route.fx_snapshot_stale:${snapshot.baseCurrency.toUpperCase()}`);
  }
  return {
    baseCurrency: snapshot.baseCurrency.toUpperCase(),
    quoteCurrency: "CNY",
    rate: snapshot.rate,
    source: snapshot.source,
    capturedAt: snapshot.capturedAt,
  };
}

function getDefaultFxRateUsdToCny(env: NodeJS.ProcessEnv = process.env): number {
  const configured = env["APPROVAL_ROUTE_USD_CNY_RATE"]?.trim();
  if (!configured) {
    return DEFAULT_USD_TO_CNY_RATE;
  }
  const parsed = Number.parseFloat(configured);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_CNY_RATE;
}

export interface FxRateProvider {
  readonly source: string;
  getRate(baseCurrency: string, quoteCurrency: string): Promise<number>;
}

export function getFxRateProvider(env: NodeJS.ProcessEnv = process.env): FxRateProvider {
  return {
    source: env["APPROVAL_ROUTE_FX_RATE_SOURCE"]?.trim() || "legacy_amount_usd_default",
    async getRate(baseCurrency: string, quoteCurrency: string): Promise<number> {
      if (baseCurrency.toUpperCase() !== "USD" || quoteCurrency.toUpperCase() !== "CNY") {
        throw new Error(`approval_route.fx_pair_unsupported:${baseCurrency}_${quoteCurrency}`);
      }
      return getDefaultFxRateUsdToCny(env);
    },
  };
}
