import type {
  OrgNode,
  OrgChangeEvent,
  OrgPrincipalAssignment,
} from "../org-node/index.js";
import { validateHierarchyDepth } from "../org-node/index.js";

export interface OrgMergeConflictReport {
  readonly reportId: string;
  readonly sourceDeptId: string;
  readonly targetDeptId: string;
  readonly conflictingOwnerUserIds: readonly string[];
  readonly conflictingCostCenters: readonly string[];
  readonly conflictBoundaryIds: readonly string[];
}

export interface ApprovalRerouteOnOrgChange {
  readonly rerouteId: string;
  readonly affectedNodeIds: readonly string[];
  readonly previousApproverIds: readonly string[];
  readonly reroutedApproverIds: readonly string[];
  readonly reason: "org_restructure" | "owner_change" | "department_merge";
}

export interface OrphanAgentFreezePolicy {
  readonly policyId: string;
  readonly orphanedNodeIds: readonly string[];
  readonly freezeMode: "deny_new_execution" | "deny_and_suspend";
  readonly requiredApproverRoles: readonly string[];
}

export interface IdentityDeprovisioningReport {
  readonly reportId: string;
  readonly deprovisionUserIds: readonly string[];
  readonly affectedHomeNodeIds: readonly string[];
  readonly legalEntityBoundaryIds: readonly string[];
}

export interface OrgChangeImpactArtifacts {
  readonly mergeConflictReports: readonly OrgMergeConflictReport[];
  readonly approvalReroutes: readonly ApprovalRerouteOnOrgChange[];
  readonly orphanAgentFreezePolicies: readonly OrphanAgentFreezePolicy[];
  readonly identityDeprovisioningReports: readonly IdentityDeprovisioningReport[];
}

export function validateOrgHierarchy(nodes: readonly OrgNode[]): string[] {
  const findings: string[] = [];
  const ids = new Set(nodes.map((item) => item.orgNodeId));
  const roots = nodes.filter((node) => node.parentOrgNodeId === null);

  if (roots.length !== 1) {
    findings.push(`org_hierarchy.invalid_root_count:${roots.length}`);
  }

  for (const node of nodes) {
    if (node.parentOrgNodeId != null && !ids.has(node.parentOrgNodeId)) {
      findings.push(`org_hierarchy.missing_parent:${node.orgNodeId}`);
    }
    if (node.parentOrgNodeId === node.orgNodeId) {
      findings.push(`org_hierarchy.self_cycle:${node.orgNodeId}`);
    }
  }

  // Validate depth doesn't exceed 5 levels
  const { valid, depth } = validateHierarchyDepth(nodes);
  if (!valid) {
    findings.push(`org_hierarchy.exceeds_max_depth:${depth}`);
  }

  return findings;
}

export function listAncestorNodeIds(nodes: readonly OrgNode[], nodeId: string): string[] {
  const ancestors: string[] = [];
  const visited = new Set<string>(); // SECURITY FIX: Track visited nodes to detect cycles
  let current = nodes.find((item) => item.orgNodeId === nodeId) ?? null;
  while (current?.parentOrgNodeId != null) {
    // SECURITY FIX: Detect circular references to prevent infinite loops
    if (visited.has(current.parentOrgNodeId)) {
      throw new Error(`org_hierarchy.circular_reference_detected:${nodeId}`);
    }
    visited.add(current.parentOrgNodeId);
    ancestors.push(current.parentOrgNodeId);
    current = nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
  }
  return ancestors;
}

/**
 * Lists all descendant node IDs of a given node.
 */
export function listDescendantNodeIds(nodes: readonly OrgNode[], nodeId: string): string[] {
  const descendants: string[] = [];
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = nodes.filter((n) => n.parentOrgNodeId === current);
    for (const child of children) {
      descendants.push(child.orgNodeId);
      stack.push(child.orgNodeId);
    }
  }

  return descendants;
}

/**
 * Finds the root node (company level) in the org chart.
 */
export function findRootNode(nodes: readonly OrgNode[]): OrgNode | null {
  return nodes.find((node) => node.parentOrgNodeId === null) ?? null;
}

/**
 * Gets all nodes at a specific level in the hierarchy.
 */
export function getNodesAtLevel(nodes: readonly OrgNode[], level: number): OrgNode[] {
  return nodes.filter((node) => {
    const depth = getNodeDepth(nodes, node.orgNodeId);
    return depth === level;
  });
}

/**
 * Calculates the depth of a node in the hierarchy (root = 0).
 */
export function getNodeDepth(nodes: readonly OrgNode[], nodeId: string): number {
  const ancestors = listAncestorNodeIds(nodes, nodeId);
  return ancestors.length;
}

/**
 * Finds the lowest common ancestor of two nodes.
 */
export function findLowestCommonAncestor(
  nodes: readonly OrgNode[],
  nodeId1: string,
  nodeId2: string,
): string | null {
  const ancestors1 = new Set(listAncestorNodeIds(nodes, nodeId1));
  ancestors1.add(nodeId1);

  const ancestors2 = [nodeId2, ...listAncestorNodeIds(nodes, nodeId2)];

  for (const ancestor of ancestors2) {
    if (ancestors1.has(ancestor)) {
      return ancestor;
    }
  }

  return null;
}

/**
 * Builds a reporting chain for an employee.
 */
export function buildReportingChain(
  nodes: readonly OrgNode[],
  employeeId: string,
  memberNodeId: string,
): string[] {
  const chain: string[] = [];
  let current = nodes.find((n) => n.orgNodeId === memberNodeId) ?? null;

  if (current?.ownerUserIds.length) {
    for (const ownerId of current.ownerUserIds) {
      if (ownerId !== employeeId && !chain.includes(ownerId)) {
        chain.push(ownerId);
      }
    }
  }

  while (current?.parentOrgNodeId != null) {
    const parent = nodes.find((n) => n.orgNodeId === current?.parentOrgNodeId) ?? null;
    if (parent && parent.ownerUserIds.length > 0) {
      const ownerId = parent.ownerUserIds[0]!;
      if (ownerId !== employeeId && !chain.includes(ownerId)) {
        chain.push(ownerId);
      }
    }
    current = parent;
  }

  return chain;
}

/**
 * Determines the org change events that would result from a proposed restructure.
 */
export function detectOrgChangeEvents(
  before: readonly OrgNode[],
  after: readonly OrgNode[],
  principalAssignments: readonly OrgPrincipalAssignment[] = [],
): OrgChangeEvent[] {
  const events: OrgChangeEvent[] = [];
  const beforeById = new Map(before.map((n) => [n.orgNodeId, n]));
  const afterById = new Map(after.map((n) => [n.orgNodeId, n]));
  const assignmentsByNodeId = new Map(principalAssignments.map((assignment) => [assignment.homeNodeId, assignment]));

  for (const assignment of principalAssignments) {
    if (assignment.active && !afterById.has(assignment.homeNodeId)) {
      const previousNode = beforeById.get(assignment.homeNodeId) ?? null;
      events.push({
        type: "employee_offboarding",
        userId: assignment.userId,
        teamId: assignment.homeNodeId,
        legalEntityBoundaryId: previousNode?.legalEntityBoundary?.boundaryId ?? null,
      });
    }
  }

  for (const assignment of principalAssignments) {
    if (assignment.active && afterById.has(assignment.homeNodeId) && !beforeById.has(assignment.homeNodeId)) {
      events.push({
        type: "employee_onboarding",
        userId: assignment.userId,
        teamId: assignment.homeNodeId,
        managerId: assignment.managerUserId,
      });
    }
  }

  for (const assignment of principalAssignments) {
    const beforeNode = beforeById.get(assignment.homeNodeId);
    const afterNode = afterById.get(assignment.homeNodeId);
    if (beforeNode && afterNode && afterNode.parentOrgNodeId !== beforeNode.parentOrgNodeId) {
      events.push({
        type: "employee_transfer",
        userId: assignment.userId,
        fromTeamId: beforeNode.orgNodeId,
        // SECURITY FIX: toTeamId should be the target team node, not the parent ID.
        // When an employee transfers, they go TO the new team node (afterNode),
        // not to the parent's node (which is the parent's org node, not the target team).
        toTeamId: afterNode.orgNodeId,
        newManagerId: assignment.managerUserId,
      });
    }
  }

  for (const node of before) {
    const afterNode = afterById.get(node.orgNodeId);
    if (node.nodeType === "department" && afterNode && afterNode.parentOrgNodeId !== node.parentOrgNodeId) {
      events.push({
        type: "department_merge",
        sourceDeptId: node.orgNodeId,
        targetDeptId: afterNode.orgNodeId,
        conflictBoundaryIds: [
          ...(node.legalEntityBoundary?.boundaryId ? [node.legalEntityBoundary.boundaryId] : []),
          ...(afterNode.legalEntityBoundary?.boundaryId ? [afterNode.legalEntityBoundary.boundaryId] : []),
        ].filter((value, index, list) => list.indexOf(value) === index),
      });
    }
  }

  const restructureNodes = before
    .filter((node) => {
      const afterNode = afterById.get(node.orgNodeId);
      return afterNode != null
        && (afterNode.parentOrgNodeId !== node.parentOrgNodeId
          || afterNode.displayName !== node.displayName
          || afterNode.ownerUserIds.join(",") !== node.ownerUserIds.join(","));
    })
    .map((node) => node.orgNodeId);
  if (restructureNodes.length > 0) {
    events.push({
      type: "org_restructure",
      affectedNodeIds: restructureNodes,
    });
  }

  return events;
}

export function buildOrgChangeImpactArtifacts(
  before: readonly OrgNode[],
  after: readonly OrgNode[],
  principalAssignments: readonly OrgPrincipalAssignment[] = [],
): OrgChangeImpactArtifacts {
  const events = detectOrgChangeEvents(before, after, principalAssignments);
  const beforeById = new Map(before.map((node) => [node.orgNodeId, node]));
  const afterById = new Map(after.map((node) => [node.orgNodeId, node]));
  const mergeConflictReports: OrgMergeConflictReport[] = [];
  const approvalReroutes: ApprovalRerouteOnOrgChange[] = [];
  const orphanAgentFreezePolicies: OrphanAgentFreezePolicy[] = [];
  const identityDeprovisioningReports: IdentityDeprovisioningReport[] = [];

  for (const event of events) {
    if (event.type === "department_merge") {
      const source = beforeById.get(event.sourceDeptId) ?? null;
      const target = afterById.get(event.targetDeptId) ?? null;
      mergeConflictReports.push({
        reportId: `org_merge_conflict:${event.sourceDeptId}:${event.targetDeptId}`,
        sourceDeptId: event.sourceDeptId,
        targetDeptId: event.targetDeptId,
        conflictingOwnerUserIds: [...new Set([...(source?.ownerUserIds ?? []), ...(target?.ownerUserIds ?? [])])],
        conflictingCostCenters: [...new Set([source?.costCenter ?? "", target?.costCenter ?? ""])].filter((item) => item.length > 0),
        conflictBoundaryIds: event.conflictBoundaryIds,
      });
      approvalReroutes.push({
        rerouteId: `approval_reroute:${event.sourceDeptId}:${event.targetDeptId}`,
        affectedNodeIds: [event.sourceDeptId, event.targetDeptId],
        previousApproverIds: source?.ownerUserIds ?? [],
        reroutedApproverIds: target?.ownerUserIds ?? [],
        reason: "department_merge",
      });
    }

    if (event.type === "org_restructure") {
      for (const nodeId of event.affectedNodeIds) {
        const previous = beforeById.get(nodeId) ?? null;
        const current = afterById.get(nodeId) ?? null;
        approvalReroutes.push({
          rerouteId: `approval_reroute:${nodeId}`,
          affectedNodeIds: [nodeId],
          previousApproverIds: previous?.ownerUserIds ?? [],
          reroutedApproverIds: current?.ownerUserIds ?? [],
          reason: previous?.ownerUserIds.join(",") === current?.ownerUserIds.join(",")
            ? "org_restructure"
            : "owner_change",
        });
      }
    }

    if (event.type === "employee_offboarding") {
      identityDeprovisioningReports.push({
        reportId: `identity_deprovision:${event.userId}:${event.teamId}`,
        deprovisionUserIds: [event.userId],
        affectedHomeNodeIds: [event.teamId],
        legalEntityBoundaryIds: event.legalEntityBoundaryId == null ? [] : [event.legalEntityBoundaryId],
      });
    }
  }

  const orphanedNodeIds = after
    .filter((node) => node.parentOrgNodeId != null && !afterById.has(node.parentOrgNodeId))
    .map((node) => node.orgNodeId);
  if (orphanedNodeIds.length > 0) {
    orphanAgentFreezePolicies.push({
      policyId: `orphan_agent_freeze:${orphanedNodeIds.sort().join(",")}`,
      orphanedNodeIds,
      freezeMode: "deny_and_suspend",
      requiredApproverRoles: ["platform_admin", "identity_admin"],
    });
    const orphanedUsers = principalAssignments
      .filter((assignment) => assignment.active && orphanedNodeIds.includes(assignment.homeNodeId))
      .map((assignment) => assignment.userId);
    if (orphanedUsers.length > 0) {
      identityDeprovisioningReports.push({
        reportId: `identity_deprovision:orphaned:${orphanedNodeIds.sort().join(",")}`,
        deprovisionUserIds: [...new Set(orphanedUsers)],
        affectedHomeNodeIds: orphanedNodeIds,
        legalEntityBoundaryIds: orphanedNodeIds.flatMap((nodeId) => {
          const node = afterById.get(nodeId) ?? beforeById.get(nodeId) ?? null;
          return node?.legalEntityBoundary?.boundaryId == null ? [] : [node.legalEntityBoundary.boundaryId];
        }),
      });
    }
  }

  return {
    mergeConflictReports,
    approvalReroutes,
    orphanAgentFreezePolicies,
    identityDeprovisioningReports,
  };
}
