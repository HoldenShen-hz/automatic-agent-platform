import type { OrgNode } from "../../org-model/org-node/index.js";
import { inheritPolicyLayers, type PolicyLayer } from "../inheritance/index.js";

export interface PolicyResolutionResult {
  readonly policy: Record<string, unknown>;
  readonly denyByDefault: boolean;
}

function buildCompatibilityResult(
  policy: Record<string, unknown>,
  denyByDefault: boolean,
): PolicyResolutionResult & Record<string, unknown> {
  const flattenedPolicy = { ...policy };
  Object.defineProperties(flattenedPolicy, {
    policy: {
      value: flattenedPolicy,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    denyByDefault: {
      value: denyByDefault,
      enumerable: false,
      configurable: false,
      writable: false,
    },
  });
  return flattenedPolicy as PolicyResolutionResult & Record<string, unknown>;
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
  return buildCompatibilityResult(policy, denyByDefault);
}
