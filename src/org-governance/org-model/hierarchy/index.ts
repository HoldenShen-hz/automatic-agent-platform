import type { OrgNode, OrgChangeEvent } from "../org-node/index.js";
import { validateHierarchyDepth } from "../org-node/index.js";

export function validateOrgHierarchy(nodes: readonly OrgNode[]): string[] {
  const findings: string[] = [];
  const ids = new Set(nodes.map((item) => item.orgNodeId));

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
  let current = nodes.find((item) => item.orgNodeId === nodeId) ?? null;
  while (current?.parentOrgNodeId != null) {
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

  const ancestors2 = listAncestorNodeIds(nodes, nodeId2);
  ancestors2.push(nodeId2);

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

  while (current?.parentOrgNodeId != null) {
    const parent = nodes.find((n) => n.orgNodeId === current?.parentOrgNodeId) ?? null;
    if (parent && parent.ownerUserIds.length > 0) {
      chain.push(parent.ownerUserIds[0]!);
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
): OrgChangeEvent[] {
  const events: OrgChangeEvent[] = [];
  const beforeById = new Map(before.map((n) => [n.orgNodeId, n]));
  const afterById = new Map(after.map((n) => [n.orgNodeId, n]));

  // Detect removals (offboarding)
  for (const node of before) {
    if (!afterById.has(node.orgNodeId) && node.nodeType === "member") {
      events.push({
        type: "employee_offboarding",
        userId: node.ownerUserIds[0] ?? node.orgNodeId,
        teamId: node.parentOrgNodeId ?? "",
      });
    }
  }

  // Detect additions (onboarding)
  for (const node of after) {
    if (!beforeById.has(node.orgNodeId) && node.nodeType === "member") {
      events.push({
        type: "employee_onboarding",
        userId: node.ownerUserIds[0] ?? node.orgNodeId,
        teamId: node.parentOrgNodeId ?? "",
        managerId: "",
      });
    }
  }

  // Detect moves (transfer)
  for (const node of before) {
    const afterNode = afterById.get(node.orgNodeId);
    if (afterNode && afterNode.parentOrgNodeId !== node.parentOrgNodeId && node.nodeType === "member") {
      events.push({
        type: "employee_transfer",
        userId: node.ownerUserIds[0] ?? node.orgNodeId,
        fromTeamId: node.parentOrgNodeId ?? "",
        toTeamId: afterNode.parentOrgNodeId ?? "",
        newManagerId: "",
      });
    }
  }

  return events;
}
