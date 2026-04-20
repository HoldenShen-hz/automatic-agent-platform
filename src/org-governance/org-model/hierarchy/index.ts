import type { OrgNode } from "../org-node/index.js";

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
