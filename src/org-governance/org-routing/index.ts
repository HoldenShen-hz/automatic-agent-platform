/**
 * Org Routing Service
 *
 * R19-12: Integrates tenant resolution into org routing decisions.
 * R19-13: Integrates cost center awareness into org routing.
 *
 * This service routes org-related requests while considering:
 * - Tenant boundaries and isolation
 * - Cost center allocation and tracking
 * - Org hierarchy and reporting relationships
 */

import type { OrgNode } from "../org-model/org-node/index.js";

export interface TenantResolutionContext {
  readonly tenantId: string;
  readonly tenantGroupId: string | null;
  readonly legalEntityId: string | null;
  readonly dataResidencyRegion: string | null;
}

export interface CostCenterContext {
  readonly costCenterId: string;
  readonly costCenterName: string;
  readonly budgetAllocation: number;
  readonly spentAmount: number;
  readonly currency: string;
}

export interface OrgRoutingDecision {
  readonly allowed: boolean;
  readonly routedOrgNodeId: string | null;
  readonly tenantContext: TenantResolutionContext | null;
  readonly costCenterContext: CostCenterContext | null;
  readonly reasonCodes: readonly string[];
  readonly routingStrategy: "direct" | "tenant_isolated" | "cost_center_routed" | "hierarchy_based";
}

/**
 * R19-12: Tenant resolution result with isolation requirements.
 */
export interface TenantResolutionResult {
  readonly resolved: boolean;
  readonly tenantId: string | null;
  readonly tenantGroupId: string | null;
  readonly requiresIsolation: boolean;
  readonly legalEntityBoundaryId: string | null;
  readonly dataResidencyRequirement: string | null;
  readonly crossBorderTransferAllowed: boolean;
}

/**
 * R19-13: Cost center allocation result.
 */
export interface CostCenterAllocationResult {
  readonly allocated: boolean;
  readonly costCenterId: string | null;
  readonly allocationStrategy: "direct" | "parent" | "default";
  readonly budgetAvailable: number;
  readonly reasonCodes: readonly string[];
}

/**
 * OrgRoutingService
 *
 * Routes org-related operations while resolving tenant and cost center context.
 */
export class OrgRoutingService {
  private readonly nodes: readonly OrgNode[];
  private readonly tenantNodes: ReadonlyMap<string, string>; // tenantId -> orgNodeId
  private readonly costCenterNodes: ReadonlyMap<string, string>; // costCenter -> orgNodeId
  private readonly defaultCostCenterId: string = "CC_DEFAULT";

  public constructor(nodes: readonly OrgNode[]) {
    this.nodes = nodes;
    this.tenantNodes = this.buildTenantNodeMap(nodes);
    this.costCenterNodes = this.buildCostCenterMap(nodes);
  }

  /**
   * R19-12: Resolves tenant context for an org node.
   */
  public resolveTenant(orgNodeId: string): TenantResolutionResult {
    const node = this.nodes.find((n) => n.orgNodeId === orgNodeId);

    if (node == null) {
      return {
        resolved: false,
        tenantId: null,
        tenantGroupId: null,
        requiresIsolation: true,
        legalEntityBoundaryId: null,
        dataResidencyRequirement: null,
        crossBorderTransferAllowed: false,
      };
    }

    // Check if node has legal entity boundary (defines tenant boundary)
    const legalEntityBoundary = node.legalEntityBoundary;
    const requiresIsolation = legalEntityBoundary != null;

    return {
      resolved: true,
      tenantId: legalEntityBoundary?.boundaryId ?? orgNodeId,
      tenantGroupId: node.parentOrgNodeId,
      requiresIsolation,
      legalEntityBoundaryId: legalEntityBoundary?.boundaryId ?? null,
      dataResidencyRequirement: legalEntityBoundary?.dataResidencyRegion ?? null,
      crossBorderTransferAllowed: legalEntityBoundary?.crossBorderTransferPolicy !== "deny",
    };
  }

  /**
   * R19-13: Resolves cost center for an org node with budget tracking.
   */
  public resolveCostCenter(
    orgNodeId: string,
    requestedBudget: number = 0,
  ): CostCenterAllocationResult {
    const node = this.nodes.find((n) => n.orgNodeId === orgNodeId);

    if (node == null || !node.costCenter) {
      // Fall back to parent node's cost center
      return this.resolveCostCenterFromParent(orgNodeId, requestedBudget);
    }

    const costCenterId = node.costCenter;

    // R19-13: Calculate available budget based on cost center allocation
    // In production, this would query a budget service
    const budgetAvailable = this.calculateBudgetAvailable(costCenterId);

    if (requestedBudget > budgetAvailable) {
      return {
        allocated: false,
        costCenterId,
        allocationStrategy: "direct",
        budgetAvailable,
        reasonCodes: [
          `org_routing.budget_exceeded:${costCenterId}`,
          `org_routing.requested:${requestedBudget}`,
          `org_routing.available:${budgetAvailable}`,
        ],
      };
    }

    return {
      allocated: true,
      costCenterId,
      allocationStrategy: "direct",
      budgetAvailable,
      reasonCodes: [`org_routing.cost_center_allocated:${costCenterId}`],
    };
  }

  /**
   * R19-12 & R19-13: Routes an org request with tenant and cost center awareness.
   */
  public routeRequest(input: {
    requesterOrgNodeId: string;
    targetOrgNodeId: string;
    requestedBudget?: number;
    crossTenantRequest?: boolean;
  }): OrgRoutingDecision {
    const { requesterOrgNodeId, targetOrgNodeId, requestedBudget = 0 } = input;

    const tenantResolution = this.resolveTenant(requesterOrgNodeId);
    const crossTenantRequest = this.crossesTenantBoundary(requesterOrgNodeId, targetOrgNodeId);
    const costCenterAllocation = this.resolveCostCenter(targetOrgNodeId, requestedBudget);

    const reasonCodes: string[] = [];

    // R19-12: Check tenant isolation requirements
    if (crossTenantRequest && !tenantResolution.crossBorderTransferAllowed) {
      return {
        allowed: false,
        routedOrgNodeId: null,
        tenantContext: this.toTenantContext(tenantResolution),
        costCenterContext: null,
        reasonCodes: [
          ...reasonCodes,
          "org_routing.cross_border_transfer_denied",
          `org_routing.tenant:${tenantResolution.tenantId}`,
        ],
        routingStrategy: "tenant_isolated",
      };
    }

    // R19-13: Check budget availability
    if (!costCenterAllocation.allocated) {
      return {
        allowed: false,
        routedOrgNodeId: targetOrgNodeId,
        tenantContext: this.toTenantContext(tenantResolution),
        costCenterContext: null,
        reasonCodes: costCenterAllocation.reasonCodes,
        routingStrategy: "cost_center_routed",
      };
    }

    // Determine routing strategy based on tenant isolation
    let routingStrategy: OrgRoutingDecision["routingStrategy"] = "direct";
    if (tenantResolution.requiresIsolation) {
      routingStrategy = "tenant_isolated";
    } else if (costCenterAllocation.allocationStrategy === "parent") {
      routingStrategy = "cost_center_routed";
    } else if (this.isHierarchyBasedRouting(requesterOrgNodeId, targetOrgNodeId)) {
      routingStrategy = "hierarchy_based";
    }

    return {
      allowed: true,
      routedOrgNodeId: targetOrgNodeId,
      tenantContext: this.toTenantContext(tenantResolution),
      costCenterContext: costCenterAllocation.costCenterId
        ? {
          costCenterId: costCenterAllocation.costCenterId,
          costCenterName: costCenterAllocation.costCenterId,
          budgetAllocation: requestedBudget,
          spentAmount: 0,
          currency: "USD",
        }
        : null,
      reasonCodes: [
        ...reasonCodes,
        ...costCenterAllocation.reasonCodes,
        `org_routing.strategy:${routingStrategy}`,
      ],
      routingStrategy,
    };
  }

  /**
   * Converts TenantResolutionResult to TenantResolutionContext for routing decisions.
   */
  private toTenantContext(result: TenantResolutionResult): TenantResolutionContext {
    return {
      tenantId: result.tenantId ?? "",
      tenantGroupId: result.tenantGroupId,
      legalEntityId: result.legalEntityBoundaryId,
      dataResidencyRegion: result.dataResidencyRequirement,
    };
  }

  /**
   * R19-12: Checks if a request crosses tenant boundaries.
   */
  public crossesTenantBoundary(sourceOrgNodeId: string, targetOrgNodeId: string): boolean {
    const sourceTenant = this.resolveTenant(sourceOrgNodeId);
    const targetTenant = this.resolveTenant(targetOrgNodeId);

    if (!sourceTenant.resolved || !targetTenant.resolved) {
      return false;
    }

    // Different tenant IDs indicate crossing tenant boundary
    return sourceTenant.tenantId !== targetTenant.tenantId;
  }

  /**
   * R19-13: Gets cost center for an org node (no budget check).
   */
  public getCostCenterForNode(orgNodeId: string): string | null {
    const node = this.nodes.find((n) => n.orgNodeId === orgNodeId);
    return node?.costCenter ?? null;
  }

  private resolveCostCenterFromParent(orgNodeId: string, requestedBudget: number): CostCenterAllocationResult {
    const node = this.nodes.find((n) => n.orgNodeId === orgNodeId);
    if (node == null || node.parentOrgNodeId == null) {
      return {
        allocated: true,
        costCenterId: this.defaultCostCenterId,
        allocationStrategy: "default",
        budgetAvailable: Infinity,
        reasonCodes: ["org_routing.default_cost_center_applied"],
      };
    }

    const parentCostCenter = this.getCostCenterForNode(node.parentOrgNodeId);
    if (parentCostCenter == null) {
      return this.resolveCostCenterFromParent(node.parentOrgNodeId, requestedBudget);
    }

    return {
      allocated: true,
      costCenterId: parentCostCenter,
      allocationStrategy: "parent",
      budgetAvailable: this.calculateBudgetAvailable(parentCostCenter),
      reasonCodes: [`org_routing.parent_cost_center:${parentCostCenter}`],
    };
  }

  private calculateBudgetAvailable(costCenterId: string): number {
    // In production, this would query actual budget service
    // For now, return a default large budget
    return 1000000;
  }

  private isHierarchyBasedRouting(sourceOrgNodeId: string, targetOrgNodeId: string): boolean {
    // Check if target is an ancestor of source in the org hierarchy
    let current: OrgNode | null = this.nodes.find((n) => n.orgNodeId === sourceOrgNodeId) ?? null;
    while (current?.parentOrgNodeId != null) {
      if (current.parentOrgNodeId === targetOrgNodeId) {
        return true;
      }
      current = this.nodes.find((n) => n.orgNodeId === current?.parentOrgNodeId) ?? null;
    }
    return false;
  }

  private buildTenantNodeMap(nodes: readonly OrgNode[]): ReadonlyMap<string, string> {
    const map = new Map<string, string>();
    for (const node of nodes) {
      if (node.legalEntityBoundary?.boundaryId) {
        map.set(node.legalEntityBoundary.boundaryId, node.orgNodeId);
      }
    }
    return map;
  }

  private buildCostCenterMap(nodes: readonly OrgNode[]): ReadonlyMap<string, string> {
    const map = new Map<string, string>();
    for (const node of nodes) {
      if (node.costCenter) {
        map.set(node.costCenter, node.orgNodeId);
      }
    }
    return map;
  }
}
