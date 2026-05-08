import type { OrgNode } from "../../org-model/org-node/index.js";
import { inheritPolicyLayers, type PolicyLayer } from "../inheritance/index.js";

export function resolveCompliancePolicyForNode(
  nodes: readonly OrgNode[],
  targetNodeId: string,
  policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>,
): Record<string, unknown> {
  const lineage: OrgNode[] = [];
  let current = nodes.find((item) => item.orgNodeId === targetNodeId) ?? null;
  while (current != null) {
    lineage.unshift(current);
    current = current.parentOrgNodeId == null
      ? null
      : nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
  }
  const orderedLayers = lineage.flatMap((item) => policiesByNodeId[item.orgNodeId] ?? []);
  return inheritPolicyLayers(orderedLayers);
}
