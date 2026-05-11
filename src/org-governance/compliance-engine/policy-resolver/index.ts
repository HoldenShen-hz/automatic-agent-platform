import type { OrgNode } from "../../org-model/org-node/index.js";
import { inheritPolicyLayers, type PolicyLayer } from "../inheritance/index.js";

export interface PolicyResolutionResult {
  readonly policy: Record<string, unknown>;
  readonly denyByDefault: boolean;
}

export function resolveCompliancePolicyForNode(
  nodes: readonly OrgNode[],
  targetNodeId: string,
  policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>,
): PolicyResolutionResult {
  const lineage: OrgNode[] = [];
  let current = nodes.find((item) => item.orgNodeId === targetNodeId) ?? null;
  while (current != null) {
    lineage.unshift(current);
    current = current.parentOrgNodeId == null
      ? null
      : nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
  }
  const orderedLayers = lineage.flatMap((item) => policiesByNodeId[item.orgNodeId] ?? []);
  const policy = inheritPolicyLayers(orderedLayers);
  const denyByDefault = orderedLayers.length === 0;
  return { policy, denyByDefault };
}
